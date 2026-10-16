"""
Classificador de custos TOTVS -> EAP  (protótipo, obra Flats BH)
Uso: python classificador.py <relatorio_totvs.xlsx> <pasta_com_relatorios_OC>
Saída: lancamentos.csv, pendencias.csv

Fechamento pelo ACUMULADO do TOTVS (decisão de 14/10/2026), chave = Ref. Lançamento:
    py classificador.py entrada/TOTVS_acumulado_AAAA-MM-DD.xlsx oc --fechamento AAAA-MM --refs refs_no_banco.csv
  refs_no_banco.csv vem do importar.js --refs-do-banco (só leitura). Entram só os títulos PAGOS
  (Valor Baixado > 0, baixa até o fim do mês) cujo ref ainda não está no banco, mais a Taxa ADM (regra
  de sempre). Baixa em mês já fechado entra no mês do fechamento marcada como baixa retroativa.
  Gera também conferencia.json (total pago = já importado + novos + NAO_CUSTO + fora do dashboard).
"""
import sys, glob, re
import pandas as pd, unicodedata

def colunas(df):
    df.columns = [unicodedata.normalize('NFC', str(c)).strip() for c in df.columns]
    return df
from util import norm, raiz_cnpj, similaridade, padronizar as _padronizar

CENTRO_CUSTO = 'FLAT BH'
EXCLUIR_DOCS = {'000000229/01'}          # títulos que você retira do fechamento (ex.: cartório)

# nomes de coluna variam entre exportações do TOTVS: mapeia por sinônimo, não por posição
SINONIMOS = {
    'documento':  ['numero do documento', 'numero documento'],
    'nome':       ['nome'],
    'historico':  ['historico'],
    'emissao':    ['data de emissao', 'emissao'],
    'vencimento': ['data de vencimento', 'vencimento'],
    'cc':         ['centro de custo', 'centro custo', 'descricao centro de custo'],
    'original':   ['valor original'],
    'liquido':    ['valor liquido', 'valor liquido-quitado'],
    'cnpj':       ['cnpj/cpf'],
    'baixa':      ['data de baixa'],
    'prev_baixa': ['data de previsao de baixa', 'previsao de baixa', 'previsaobaixa'],
    'pago':       ['valor pago'],
    'baixado':    ['valor baixado'],
    'ref':        ['ref. lancamento', 'ref lancamento'],   # chave única do título/parcela no TOTVS
}
OBRIGATORIAS = ['documento', 'nome', 'vencimento', 'cc', 'liquido', 'cnpj']

def padronizar(df, sin=None, obrig=None, origem='TOTVS'):
    if sin is None: return _padronizar(df, SINONIMOS, OBRIGATORIAS, origem)
    return _padronizar(df, sin, obrig, origem)

def competencia(t):
    c = pd.Series(pd.NaT, index=t.index)
    for col in ['baixa', 'prev_baixa', 'vencimento']:
        if col in t:
            c = c.fillna(pd.to_datetime(t[col], errors='coerce'))
    return c.dt.date

def ler_totvs(path):
    t = padronizar(pd.read_excel(path)).dropna(subset=['documento'])      # descarta linha de total
    t = t[t['cc'].astype(str).str.strip() == CENTRO_CUSTO]
    t = t[~t['documento'].astype(str).str.strip().isin(EXCLUIR_DOCS)]
    sem_liq = t['liquido'].isna()
    if sem_liq.any():
        print(f'AVISO: {sem_liq.sum()} linha(s) sem Valor líquido ignorada(s): {t.loc[sem_liq, "documento"].tolist()}')
    t = t[~sem_liq]
    return pd.DataFrame({
        'documento': t['documento'].astype(str).str.strip(),
        'fornecedor': t['nome'].map(norm),
        'cnpj': t['cnpj'].map(raiz_cnpj),
        'historico': t['historico'].map(norm) if 'historico' in t else '',
        'emissao': pd.to_datetime(t['emissao']).dt.date if 'emissao' in t else None,
        'competencia': competencia(t),   # Data de Baixa > Previsão de Baixa > Vencimento (decisão set/26)
        'vencimento': pd.to_datetime(t['vencimento'], errors='coerce').dt.date,
        'valor_original': t['original'].astype(float) if 'original' in t else None,
        'valor': t['liquido'].astype(float).round(2),
        'pago': pago(t),
        'ref_totvs': pd.to_numeric(t['ref'], errors='coerce').astype('Int64') if 'ref' in t else pd.NA,
        'data_baixa': pd.to_datetime(t['baixa'], errors='coerce').dt.date if 'baixa' in t else None,
    }).reset_index(drop=True)

def pago(t):
    """True/False por título; None se o relatório não tem a coluna VALOR PAGO (não dá para conferir).
    Acumulado (sem VALOR PAGO, com Valor Baixado): pago = Valor Baixado > 0 (decisão de 14/10/2026);
    zerado com Data de Baixa = NF que quitou adiantamento; zerado sem Data de Baixa = a pagar."""
    if 'pago' not in t:
        if 'baixado' in t:
            return pd.to_numeric(t['baixado'], errors='coerce').fillna(0) > 0
        return None
    p = pd.to_numeric(t['pago'], errors='coerce').fillna(0) > 0
    if 'baixado' in t:
        p |= pd.to_numeric(t['baixado'], errors='coerce').fillna(0) > 0
    if 'baixa' in t:
        p |= pd.to_datetime(t['baixa'], errors='coerce').notna()
    return p

# Taxa ADM da Fonseca & Lage (decisão out/26): entra no mês do relatório mesmo sem marcação de pago;
# no máximo uma por mês — a prévia avisa se vier nenhuma ou mais de uma.
CNPJ_TAXA_ADM = '03556279'
def e_taxa_adm(tit):
    texto = tit.documento.str.upper() + ' ' + tit.historico.astype(str)
    return (tit.cnpj == CNPJ_TAXA_ADM) & texto.str.contains(r'TAXA\s*ADM', regex=True)

def avisos_taxa_adm(tit, avisar_ausente=True):
    tx = tit[e_taxa_adm(tit)]
    if len(tx) == 0 and avisar_ausente:
        print('AVISO: nenhuma Taxa ADM da Fonseca & Lage no relatório — confira (a do mês anterior entra neste mês)')
    elif len(tx) > 1:
        print(f'AVISO: {len(tx)} Taxas ADM no relatório (deveria ser no máximo uma): '
              + '; '.join(f'{r.documento} R$ {r.valor:,.2f}' for r in tx.itertuples()))
    for r in tx.itertuples():
        if r.pago is not None and not r.pago:
            print(f'Taxa ADM incluída sem marcação de pago: {r.documento} R$ {r.valor:,.2f}')

# Mês de referência da Taxa ADM pelo histórico/documento ("TAXA ADM AGO-2026", "TAXA ADM 08-2026",
# "TAXA ADM FEV/2026 A JUN/2026" -> o último mês citado). A do mês M entra em M+1; se aparecer depois
# (ex.: a de setembro ainda não emitida no fechamento de outubro), entra no fechamento em que aparecer,
# marcada com atraso (decisão de 16/10/2026).
MESES = {'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4, 'MAI': 5, 'JUN': 6, 'JUL': 7, 'AGO': 8, 'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12}
def mes_ref_taxa(texto):
    achados = [(int(a), MESES[m] if m in MESES else int(m))
               for m, a in re.findall(r'\b(' + '|'.join(MESES) + r'|0?[1-9]|1[0-2])\s*[-/.]\s*(20\d\d)\b', norm(texto))]
    return pd.Period(year=achados[-1][0], month=achados[-1][1], freq='M') if achados else None

def atrasos_taxa_adm(cand, fechamento):
    """{ref_totvs: texto do alerta} das Taxas ADM que entram depois de M+1; avisa também a que falta."""
    m = pd.Period(fechamento, freq='M')
    tx = cand[e_taxa_adm(cand)]
    alertas = {}
    if len(tx) == 0:
        print(f'AVISO: a Taxa ADM de {m - 1} não está no acumulado (ainda não emitida?): o fechamento de {m} segue sem ela; '
              f'ela entra no fechamento em que aparecer, marcada com atraso')
    for r in tx.itertuples():
        ref = mes_ref_taxa(f'{r.documento} {r.historico}')
        if ref is None:
            print(f'AVISO: Taxa ADM {r.documento} sem mês de referência no histórico — confira')
        elif ref + 1 < m:
            alertas[r.ref_totvs] = f'Taxa ADM de {ref} com atraso: entra em {m} (deveria em {ref + 1})'
            print(f'AVISO: {alertas[r.ref_totvs]}')
    return alertas

# não são custo (decisão out/26): previsão financeira de OC ainda sem NF e aporte de sócio.
# Saem da classificação e vão para nao_custo.csv (base do futuro card de contas a pagar).
NAO_CUSTO = {'previsão financeira': r'PREV\.?\s*FINANC', 'aporte': r'\bAPORTE\b'}

def decisoes_nao_custo():
    """decisoes_pontuais.csv com eap = NAO_CUSTO. Coluna opcional ref_totvs (Ref. Lançamento do TOTVS):
    preenchida, a decisão vale para aquele título pelo ref (decisão de 14/10/2026); vazia, vale pelo
    cnpj + documento, como as decisões antigas."""
    try:
        dp = pd.read_csv('decisoes_pontuais.csv', dtype=str).fillna('')
    except FileNotFoundError:
        return pd.DataFrame(columns=['cnpj', 'documento', 'eap', 'obs', 'ref_totvs'])
    if 'ref_totvs' not in dp:
        dp['ref_totvs'] = ''
    dp['ref_totvs'] = dp.ref_totvs.str.replace(r'\.0$', '', regex=True).str.strip()
    return dp[dp.eap == 'NAO_CUSTO']

def mascara_decisao(tit, r):
    """títulos de uma linha de decisoes_pontuais.csv: pelo ref quando a decisão tem ref, senão cnpj + documento"""
    if r.ref_totvs and 'ref_totvs' in tit:
        return tit.ref_totvs.astype('Int64').astype(str) == r.ref_totvs
    return (tit.cnpj == r.cnpj) & (tit.documento == r.documento)

def separar_nao_custo(tit):
    tipo = pd.Series('', index=tit.index)
    for nome, padrao in NAO_CUSTO.items():
        tipo[(tipo == '') & tit.historico.str.contains(padrao, regex=True)] = nome
    # título que você marcou em decisoes_pontuais.csv com eap = NAO_CUSTO (ex.: NF já paga por adiantamento)
    for r in decisoes_nao_custo().itertuples():
        tipo[(tipo == '') & mascara_decisao(tit, r)] = r.obs or 'decisão: não é custo'
    # só entra como custo o que consta como pago no relatório (decisão out/26), exceto a Taxa ADM
    if tit.pago.notna().all():
        tipo[(tipo == '') & (tit.pago == False) & ~e_taxa_adm(tit)] = 'sem pagamento no relatório'
    else:
        print('AVISO: relatório sem a coluna VALOR PAGO — não foi possível conferir o pagamento dos títulos')
    fora = tit[tipo != ''].assign(tipo=tipo[tipo != ''])
    return tit[tipo == ''].reset_index(drop=True), fora.reset_index(drop=True)

SIN_OC = {
    'oc': ['no oc'], 'cnpj': ['cnpj'], 'fornecedor': ['razao social'], 'item': ['nome prod'],
    'total_item': ['total do item'], 'nf': ['no nf'], 'status': ['desc_status'],
    'cc': ['descricao c.custo'], 'emissao': ['data emissao'], 'sc': ['no sc fluig'],
}

def ler_ocs(pasta):
    dfs = []
    for f in sorted(glob.glob(f'{pasta}/*.xls*')):
        o = padronizar(pd.read_excel(f, engine='xlrd' if f.lower().endswith('.xls') else None),
                       SIN_OC, ['oc', 'cnpj', 'item', 'total_item', 'nf'], f)
        if 'cc' in o:
            o = o[o['cc'].astype(str).str.strip() == CENTRO_CUSTO]
        else:
            print(f'AVISO: {f} não tem centro de custo — considerando todas as OCs como {CENTRO_CUSTO}')
        o['arquivo'] = f
        dfs.append(o)
    o = pd.concat(dfs)
    o = pd.DataFrame({
        'oc': o['oc'].astype(str).str.lstrip('0'),
        'cnpj': o['cnpj'].map(raiz_cnpj),
        'fornecedor': o['fornecedor'].map(norm),
        'item': o['item'].map(norm),
        'total_item': pd.to_numeric(o['total_item'], errors='coerce').fillna(0),
        'nf': pd.to_numeric(o['nf'], errors='coerce'),
        'status': o.get('status'),
        # SC (solicitação de compra) da OC: liga a compra de aço ao pedido (pedidos_aco.csv)
        'sc': o['sc'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip() if 'sc' in o else '',
        'emissao': pd.to_datetime(o.get('emissao'), errors='coerce'),
        'arquivo': o['arquivo'],
    })
    # a mesma OC aparece em vários relatórios mensais: fica a versão do relatório mais recente
    o = o.sort_values('arquivo')   # nomeie os arquivos OC_AAAA-MM.xls
    return o.drop_duplicates(subset=['oc', 'item', 'total_item', 'nf'], keep='last')

def vincular_oc(tit, ocs):
    """Retorna (linhas da OC, confiança) para um título."""
    m = re.match(r'^OC\s*(\d+)', tit.documento)
    if m:
        g = ocs[ocs.oc == m.group(1)]
        return (g, 'ALTA') if len(g) else (None, None)
    # "Prev. Financ. OC 000001826 ...": a OC vem no histórico; abre pelos itens dela (decisão out/26)
    m = re.search(r'PREV\.?\s*FINANC.*\bOC\s*0*(\d+)', str(tit.historico))
    if m:
        g = ocs[(ocs.oc == m.group(1)) & (ocs.total_item > 0)]
        if len(g):
            return g, 'ALTA (OC no histórico)'
    m = re.match(r'^0*(\d+)/\d+$', tit.documento)
    if m:
        g = ocs[(ocs.nf == int(m.group(1))) & (ocs.cnpj == tit.cnpj)]
        g = g[g.total_item > 0]
        if len(g):
            return g, 'ALTA'
    # sem NF na OC: procura OC PENDENTE do mesmo fornecedor cujo total (ou soma de duas) = valor original do título
    alvo = round(tit.valor_original or tit.valor, 2)
    pend = ocs[(ocs.cnpj == tit.cnpj) & (ocs.nf.isna()) & (ocs.total_item > 0)]
    tot = pend.groupby('oc').total_item.sum().round(2)
    unicas = tot[tot == alvo]
    if len(unicas) == 1:
        return pend[pend.oc == unicas.index[0]], f'MÉDIA (valor = OC {unicas.index[0]})'
    from itertools import combinations
    pares = [(a, b) for a, b in combinations(tot.index, 2) if round(tot[a] + tot[b], 2) == alvo]
    if len(pares) == 1:
        a, b = pares[0]
        return pend[pend.oc.isin([a, b])], f'MÉDIA (valor = OC {a} + OC {b})'
    return None, None

def carregar_regras(path='regras.csv', manuais='regras_manuais.csv'):
    """regras_manuais.csv = decisões suas; têm prioridade e não são apagadas quando gerar_regras roda de novo"""
    r = pd.read_csv(path, dtype=str).fillna('')
    r['alerta'] = ''
    try:
        m = pd.read_csv(manuais, dtype=str).fillna('')
    except FileNotFoundError:
        m = r.iloc[0:0]
    return m, r

LIMIAR_SIMILARIDADE = 0.5

def _aplicar(regras, cnpj, fornecedor, item, valor, competencia=None):
    if 'vigente_desde' in regras and competencia is not None:
        c = str(competencia)
        regras = regras[(regras.vigente_desde == '') | (regras.vigente_desde <= c)]
    r = regras[regras.cnpj == cnpj] if cnpj else regras.iloc[0:0]
    if len(r) == 0:
        r = regras[regras.fornecedor == fornecedor]
    r = pd.concat([r, regras[regras.cnpj == '*']])          # regras de item válidas p/ qualquer fornecedor
    hit, tipo = r[r.padrao_item == f'VALOR={valor:g}'], 'valor'
    if len(hit) == 0:
        cont = r[r.padrao_item.str.startswith('CONTEM:')]
        cont = cont[cont.padrao_item.map(lambda p: p[7:] in norm(item))]
        if len(cont):
            hit, tipo = cont.iloc[[0]], 'palavra-chave'
    if len(hit) == 0:
        cand = r[(r.padrao_item != '*') & (~r.padrao_item.str.startswith(('VALOR=', 'CONTEM:')))]
        if len(cand):
            sims = cand.padrao_item.map(lambda p: similaridade(p, item))
            if sims.max() >= LIMIAR_SIMILARIDADE:
                hit, tipo = cand.loc[[sims.idxmax()]], f'item ({sims.max():.0%})'
    if len(hit) == 0:
        hit, tipo = r[r.padrao_item == '*'], 'fornecedor'
    if len(hit) == 0:
        return None, 'sem regra (fornecedor novo)', ''
    h = hit.iloc[0]
    if h.tipo == 'pendente':
        return None, h.obs or 'fornecedor com várias EAPs', ''
    return h.eap, f'regra por {tipo}', h.get('alerta', '')

try:
    # uma linha por categoria e etapa; vigente_desde vazio = desde o início da obra
    ETAPA = pd.read_csv('etapa.csv', dtype=str).fillna('')
    if 'vigente_desde' not in ETAPA:
        ETAPA['vigente_desde'] = ''
except FileNotFoundError:
    ETAPA = pd.DataFrame(columns=['categoria', 'eap', 'vigente_desde'])

def resolver_etapa(eap, alerta, competencia=None, emissao=None):
    """EAP 'ETAPA:ACO_MATERIAL' -> linha do pavimento em execução na competência do título (etapa.csv).
    'ETAPA_NF:...' usa a data de emissão da nota (prego e arame, decisão out/26); sem ela, a competência."""
    if eap and eap.startswith(('ETAPA:', 'ETAPA_NF:')):
        por_nota = eap.startswith('ETAPA_NF:')
        cat = eap.split(':', 1)[1]
        data = emissao if por_nota and emissao is not None and not pd.isna(emissao) else competencia
        e = ETAPA[ETAPA.categoria == cat]
        if data is not None:
            e = e[(e.vigente_desde == '') | (e.vigente_desde <= str(data))]
        if len(e) == 0:
            return None, f'categoria {cat} sem EAP em etapa.csv'
        e = e.sort_values('vigente_desde').iloc[-1]
        return e.eap, (alerta + ' | ' if alerta else '') + f'EAP pela etapa ({cat} = {e.eap}' + (f', nota de {data}' if por_nota else '') + ')'
    return eap, alerta

def pavimento_na_data(data):
    """Pavimento em execução na data da nota (decisão out/26), pelo etapa.csv: a etapa
    mais recente vigente na data; EAP 3.N.x -> 'Nº'. Sem data ou sem etapa -> ''.
    O importar.js só usa o pavimento em código repetido por pavimento (7.1.7 do 1º ao
    6º) e só se o código tiver linha nesse pavimento; sem pavimento, divide pela verba."""
    if data is None or pd.isna(data) or str(data).strip() == '':
        return ''
    e = ETAPA[(ETAPA.vigente_desde == '') | (ETAPA.vigente_desde <= str(data)[:10])]
    if len(e) == 0:
        return ''
    m = re.match(r'^3\.(\d+)\.', str(e.sort_values('vigente_desde', kind='stable').iloc[-1].eap))
    return f'{m.group(1)}º' if m else ''

def aplicar_regra(regras, cnpj, fornecedor, item, valor, competencia=None, emissao=None):
    manuais, geradas = regras
    eap, motivo, alerta = _aplicar(manuais, cnpj, fornecedor, item, valor, competencia)
    if eap:
        eap, alerta = resolver_etapa(eap, alerta, competencia, emissao)
        return eap, motivo.replace('regra por', 'decisão sua por'), alerta
    return _aplicar(geradas, cnpj, fornecedor, item, valor)

def ratear(eap, valor, competencia=None, emissao=None):
    """regra com rateio: eap = '19.1.7=0.581;19.1.9=0.419' -> [(eap, valor), ...] fechando ao centavo na última"""
    if not eap or '=' not in eap:
        return [(eap, valor)]
    partes = [p.split('=') for p in eap.split(';') if p.strip()]
    vals = [round(valor * float(pr), 2) for _, pr in partes]
    vals[-1] = round(vals[-1] + valor - sum(vals), 2)
    return [(resolver_etapa(e.strip(), '', competencia, emissao)[0], v) for (e, _), v in zip(partes, vals)]

# Compra de aço (decisão out/26): regra com eap = 'PEDIDO_ACO' divide o título pelo pedido de aço
# (SC da OC) e pelas pranchas, na proporção em kg de pedidos_aco.csv (uma linha por SC e EAP).
# Sem OC identificada, ou com SC fora da planilha de pedidos: pendência para você informar o pedido.
try:
    PEDIDOS_ACO = pd.read_csv('pedidos_aco.csv', dtype=str).fillna('')
except FileNotFoundError:
    PEDIDOS_ACO = pd.DataFrame(columns=['sc', 'pedido', 'eap', 'proporcao', 'obs'])

def oc_do_historico(historico):
    m = re.search(r'\bOC\s*0*(\d+)', str(historico))
    return m.group(1) if m else ''

def resolver_pedido_aco(oc, ocs):
    if not oc:
        return None, 'pedido de aço: título sem OC identificada (informe o pedido)'
    scs = sorted({x for x in ocs[ocs.oc == oc].sc if x and x != 'nan'}) if 'sc' in ocs else []
    if not scs:
        return None, f'pedido de aço: OC {oc} sem SC no relatório de OC (informe o pedido)'
    p = PEDIDOS_ACO[PEDIDOS_ACO.sc.isin(scs)]
    if not len(p):
        return None, f'pedido de aço: SC {", ".join(scs)} (OC {oc}) não está na planilha de pedidos (informe o pedido)'
    eap = ';'.join(f'{r.eap}={r.proporcao}' for r in p.itertuples())
    return eap, f'{p.pedido.iloc[0]}º pedido de aço (SC {p.sc.iloc[0]}, OC {oc}): divisão pelas pranchas'

def parcela_anterior(pontuais, t):
    """Parcelas seguintes de uma NF seguem a decisão da primeira parcela (decisão out/26):
    sem decisão própria, '2141/02' usa a de '2141/01'. NAO_CUSTO não é herdado."""
    if '/' not in t.documento:
        return pontuais.iloc[0:0], None
    base, par = t.documento.split('/')[0].lstrip('0'), t.documento.split('/')[-1]
    irm = pontuais[(pontuais.cnpj == t.cnpj) & (pontuais.eap != 'NAO_CUSTO') & pontuais.documento.str.contains('/', regex=False)]
    irm = irm[irm.documento.str.split('/').str[0].str.lstrip('0') == base]
    irm = irm[pd.to_numeric(irm.documento.str.split('/').str[-1], errors='coerce') < pd.to_numeric(par, errors='coerce')]
    if not len(irm):
        return irm, None
    primeira = min(irm.documento.unique(), key=lambda d: int(d.split('/')[-1]))
    return irm[irm.documento == primeira], primeira

def ref_do_titulo(t):
    """Ref. Lançamento e Data de Baixa do título, para as linhas do classificador (vazios no relatório mensal)"""
    ref = getattr(t, 'ref_totvs', None)
    return dict(ref_totvs='' if ref is None or pd.isna(ref) else int(ref),
                data_baixa=getattr(t, 'data_baixa', None))

def classificar(tit, ocs, regras):
    lanc, pend = [], []
    try:
        parcelas = pd.read_csv('regras_parcelas.csv', dtype={'cnpj': str, 'nf_base': str, 'eap': str})
    except FileNotFoundError:
        parcelas = pd.DataFrame(columns=['cnpj', 'nf_base', 'eap', 'proporcao'])
    try:
        pontuais = pd.read_csv('decisoes_pontuais.csv', dtype={'cnpj': str, 'documento': str, 'eap': str})
    except FileNotFoundError:
        pontuais = pd.DataFrame(columns=['cnpj', 'documento', 'eap', 'proporcao', 'obs'])
    for t in tit.itertuples():
        dp = pontuais[(pontuais.cnpj == t.cnpj) & (pontuais.documento == t.documento)]
        herdada = None
        if not len(dp):
            dp, herdada = parcela_anterior(pontuais, t)
        if len(dp):
            # rateio informado por você (ex.: boletim de medição); linha sem EAP vai para pendências
            vals = [round(t.valor * float(p), 2) for p in dp.proporcao]
            vals[-1] = round(vals[-1] + t.valor - sum(vals), 2)
            for r, v in zip(dp.fillna('').itertuples(), vals):
                eap_r, _ = resolver_etapa(r.eap, '', t.competencia, t.emissao)
                r = r._replace(eap=eap_r or '')
                row = dict(documento=t.documento, fornecedor=t.fornecedor, item=r.obs, oc='',
                           competencia=t.competencia, valor=v, eap=r.eap, vinculo_oc='decisão pontual',
                           regra=f'decisão: {r.obs}' + (f' (herdada da parcela {herdada})' if herdada else ''),
                           alerta=getattr(r, 'alerta', ''),
                           data_emissao=t.emissao, cnpj=t.cnpj, **ref_do_titulo(t),
                           classificacao=getattr(r, 'classificacao', ''),   # opcional, vai para o banco
                           pavimento=str(getattr(r, 'pavimento', '') or ''))  # opcional: decisão sua de pavimento
                (lanc if r.eap else pend).append(row)
            continue
        m = re.match(r'^0*(\d+)/\d+$', t.documento)
        ant = parcelas[(parcelas.cnpj == t.cnpj) & (parcelas.nf_base == m.group(1))] if m else parcelas.iloc[0:0]
        rm = regras[0]
        volatil = len(rm[(rm.cnpj == t.cnpj) & rm.eap.str.startswith(('ETAPA:', 'ETAPA_NF:')) & ((rm.vigente_desde == '') | (rm.vigente_desde <= str(t.competencia)))]) > 0
        if len(ant) and not volatil:
            # outra parcela de uma NF já fechada: repete o mesmo rateio
            partes = [(e, round(t.valor * p, 2)) for e, p in zip(ant.eap, ant.proporcao)]
            dif = round(t.valor - sum(v for _, v in partes), 2)
            partes[0] = (partes[0][0], round(partes[0][1] + dif, 2))
            for e, v in partes:
                lanc.append(dict(documento=t.documento, fornecedor=t.fornecedor, item=t.historico, oc='',
                                 competencia=t.competencia, valor=v, eap=e, vinculo_oc='parcela anterior',
                                 regra='mesmo rateio da parcela anterior da NF', alerta='',
                                 data_emissao=t.emissao, cnpj=t.cnpj, **ref_do_titulo(t)))
            continue
        linhas_oc, conf = vincular_oc(t, ocs)
        if linhas_oc is not None:
            # abre o título por item da OC, rateando o valor líquido na proporção do item
            base = linhas_oc.total_item.sum()
            partes = [(r.item, round(t.valor * r.total_item / base, 2), r.oc) for r in linhas_oc.itertuples()]
            dif = round(t.valor - sum(p[1] for p in partes), 2)       # fecha ao centavo
            i_max = max(range(len(partes)), key=lambda i: partes[i][1])
            partes[i_max] = (partes[i_max][0], round(partes[i_max][1] + dif, 2), partes[i_max][2])
        else:
            partes = [(t.historico, t.valor, '')]
        for item, valor, oc in partes:
            eap, motivo, alerta = aplicar_regra(regras, t.cnpj, t.fornecedor, item, t.valor if len(partes) == 1 else valor, t.competencia, t.emissao)
            if eap == 'PEDIDO_ACO':
                eap, motivo = resolver_pedido_aco(oc or oc_do_historico(t.historico), ocs)
            for eap_r, valor_r in ratear(eap, valor, t.competencia, t.emissao):
                row = dict(documento=t.documento, fornecedor=t.fornecedor, item=item, oc=oc,
                           competencia=t.competencia, valor=valor_r, eap=eap_r or '',
                           vinculo_oc=conf or 'sem OC', regra=motivo, alerta=alerta,
                           data_emissao=t.emissao, cnpj=t.cnpj, **ref_do_titulo(t))
                (lanc if eap_r else pend).append(row)
    # Pavimento: o da decisão pontual (coluna opcional pavimento) ou o em
    # execução na data da nota (etapa.csv). Decisão out/26.
    for row in lanc + pend:
        if not row.get('pavimento'):
            row['pavimento'] = pavimento_na_data(row.get('data_emissao'))
    return pd.DataFrame(lanc), pd.DataFrame(pend)

def argumento(nome):
    if nome in sys.argv:
        i = sys.argv.index(nome)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return None

def pagos_no_arquivo(path, fim):
    """Títulos pagos (Valor Baixado > 0) com baixa até `fim`, direto do arquivo, ANTES de qualquer filtro
    do ler_totvs (documento excluído, sem valor líquido): é a base da conferência ao centavo."""
    t = padronizar(pd.read_excel(path)).dropna(subset=['documento'])
    t = t[t['cc'].astype(str).str.strip() == CENTRO_CUSTO]
    vb = pd.to_numeric(t['baixado'], errors='coerce').fillna(0)
    b = pd.to_datetime(t['baixa'], errors='coerce')
    t = t[(vb > 0) & (b <= fim)]
    return pd.DataFrame({'ref_totvs': pd.to_numeric(t['ref'], errors='coerce').astype('Int64'),
                         'documento': t['documento'].astype(str).str.strip(), 'fornecedor': t['nome'].map(norm),
                         'valor': pd.to_numeric(t['baixado'], errors='coerce').round(2)}).reset_index(drop=True)

def diferencas_aceitas():
    """diferencas_ref.csv (ref_totvs, diferenca, obs): diferença conhecida entre o TOTVS e o banco num título
    já importado (ex.: juros pagos que não entraram no lançamento). Sem ela a conferência para."""
    try:
        d = pd.read_csv('diferencas_ref.csv', dtype=str).fillna('')
    except FileNotFoundError:
        return {}
    return {int(r.ref_totvs): (round(float(r.diferenca), 2), r.obs) for r in d.itertuples() if r.ref_totvs.strip()}

def brl(v):
    return f'R$ {v:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')

def fechamento_acumulado(totvs, pasta_oc, fechamento, arq_refs):
    """Fechamento do mês pelo acumulado do TOTVS (decisão de 14/10/2026). Chave = Ref. Lançamento."""
    import json
    ini = pd.Timestamp(f'{fechamento}-01')
    fim = ini + pd.offsets.MonthEnd(0)
    tit = ler_totvs(totvs)
    if tit.ref_totvs.isna().any():
        sys.exit(f'O arquivo tem {tit.ref_totvs.isna().sum()} título(s) sem Ref. Lançamento: não é o acumulado do TOTVS.')
    if tit.ref_totvs.duplicated().any():
        sys.exit(f'Ref. Lançamento repetido no arquivo: {sorted(tit.ref_totvs[tit.ref_totvs.duplicated()].tolist())}')

    # banco: uma linha por lançamento (importar.js --refs-do-banco); ref vazio = lançamento manual
    banco = pd.read_csv(arq_refs, dtype=str).fillna('')
    if 'status' in banco:
        banco = banco[banco.status == 'Normal']
    com_ref = banco[banco.ref_totvs != '']
    soma_banco = com_ref.assign(v=pd.to_numeric(com_ref.valor)).groupby(com_ref.ref_totvs.astype(int)).v.sum().round(2)
    comp_banco = com_ref.groupby(com_ref.ref_totvs.astype(int)).competencia.agg(lambda s: ', '.join(sorted(set(s))))
    sem_ref = banco[banco.ref_totvs == '']

    baixa = pd.to_datetime(tit.data_baixa)
    emissao = pd.to_datetime(tit.emissao)
    pago_ate = tit.pago.fillna(False).astype(bool) & (baixa <= fim)
    no_banco = tit.ref_totvs.isin(soma_banco.index)
    # Taxa ADM: entra no fechamento em que aparece (a do mês M em M+1), mesmo sem pagamento; só a já emitida
    taxa = e_taxa_adm(tit) & (emissao <= fim)
    cand = tit[(pago_ate | taxa) & ~no_banco].copy()

    print(f'Fechamento {fechamento} pelo acumulado {totvs} (baixa até {fim:%d/%m/%Y})')
    # data de corte = última Data de Baixa do arquivo (a data no nome é o dia em que foi salvo; decisão de 16/10/2026)
    corte = pd.to_datetime(tit.data_baixa).max()
    print(f'  DATA DE CORTE: pagamentos até {corte:%d/%m/%Y} (última Data de Baixa do arquivo)'
          + (f' — carga parcial de {fechamento}: o resto do mês entra pelo próximo acumulado' if corte < fim else ''))
    print(f'  arquivo: {len(tit)} títulos · {pago_ate.sum()} pagos até {fim:%d/%m/%Y} · banco: {soma_banco.size} títulos com ref, '
          f'{len(sem_ref)} linha(s) sem ref (lançamento manual, pagos fora do TOTVS) {brl(pd.to_numeric(sem_ref.valor).sum())}')
    fora_arquivo = sorted(set(soma_banco.index) - set(tit.ref_totvs))
    if fora_arquivo:
        print(f'PARE: {len(fora_arquivo)} ref(s) do banco não estão no arquivo (arquivo cortado ou de outra obra?): {fora_arquivo}')
    avisos_taxa_adm(cand, avisar_ausente=False)    # a ausência é avisada em atrasos_taxa_adm
    atraso_taxa = atrasos_taxa_adm(cand, fechamento)
    cand, nao_custo = separar_nao_custo(cand.reset_index(drop=True))
    nao_custo.to_csv('nao_custo.csv', index=False, encoding='utf-8-sig')
    for tp, g in nao_custo.groupby('tipo'):
        print(f'Ignorado (não é custo) — {tp}: {len(g)} título(s) | {brl(g.valor.sum())}  -> nao_custo.csv')

    ocs, regras = ler_ocs(pasta_oc), carregar_regras()
    lanc, pend = classificar(cand, ocs, regras)
    n = len(lanc)
    tudo = pd.concat([lanc, pend], ignore_index=True)
    assert abs(round(cand.valor.sum(), 2) - round(tudo.valor.sum() if len(tudo) else 0, 2)) < 0.01, 'Total não fecha'
    if len(tudo):
        # O lançamento entra no mês do fechamento. Data que o dashboard usa (coluna competencia -> data_vencimento):
        # a baixa, quando é no mês; baixa retroativa (mês já fechado) e Taxa ADM sem baixa -> último dia do mês.
        b = pd.to_datetime(tudo.data_baixa)
        tudo['baixa_retroativa'] = (b < ini).fillna(False)
        tudo['competencia'] = b.where((b >= ini) & (b <= fim), fim).dt.date
        tudo['ref_parte'] = tudo.groupby('ref_totvs').cumcount() + 1     # título aberto em várias linhas: 1..n
    lanc, pend = tudo.iloc[:n].copy(), tudo.iloc[n:].copy()
    try:
        orc = set(pd.read_csv('orcamento.csv', dtype=str).eap)
        fora = ~lanc.eap.isin(orc) if len(lanc) else pd.Series(dtype=bool)
        if fora.any():
            lanc.loc[fora, 'alerta'] = 'EAP não existe no orçamento'
            print(f'AVISO: {fora.sum()} lançamento(s) com EAP fora do orçamento')
    except FileNotFoundError:
        pass
    for ref, texto in atraso_taxa.items():
        lanc.loc[lanc.ref_totvs == ref, 'alerta'] = texto
    lanc.to_csv('lancamentos.csv', index=False, encoding='utf-8-sig')
    (pend if len(pend) else pd.DataFrame(columns=list(lanc.columns))).to_csv('pendencias.csv', index=False, encoding='utf-8-sig')

    # ── CONFERÊNCIA AO CENTAVO ──
    P = pagos_no_arquivo(totvs, fim)
    refs_P = set(P.ref_totvs.dropna().astype(int))
    titP = tit[tit.ref_totvs.isin(refs_P)]
    A = titP[titP.ref_totvs.isin(soma_banco.index)]
    novos_pagos = cand[cand.pago.fillna(False).astype(bool) & cand.ref_totvs.isin(refs_P)]
    taxa_sem_pag = cand[~cand.ref_totvs.isin(refs_P)]
    C = nao_custo[nao_custo.ref_totvs.isin(refs_P)]
    D = P[~P.ref_totvs.isin(set(tit.ref_totvs))]            # pagos que o ler_totvs deixa fora (EXCLUIR_DOCS, sem líquido)
    aceitas = diferencas_aceitas()
    difs = []
    for r in A.itertuples():
        d = round(r.valor - soma_banco[int(r.ref_totvs)], 2)
        if abs(d) >= 0.005:
            ok = int(r.ref_totvs) in aceitas and abs(aceitas[int(r.ref_totvs)][0] - d) < 0.005
            difs.append(dict(ref=int(r.ref_totvs), documento=r.documento, fornecedor=r.fornecedor, arquivo=float(r.valor),
                             banco=float(soma_banco[int(r.ref_totvs)]), diferenca=float(d), aceita=bool(ok),
                             obs=aceitas.get(int(r.ref_totvs), (0, ''))[1]))
    A_db = round(sum(soma_banco[int(x)] for x in A.ref_totvs), 2)
    dif_aceita = round(sum(x['diferenca'] for x in difs if x['aceita']), 2)
    B = round(novos_pagos.valor.sum(), 2)
    total_P = round(P.valor.sum(), 2)
    soma = round(A_db + dif_aceita + B + C.valor.sum() + D.valor.sum(), 2)
    falta = round(total_P - soma, 2)
    # refs do banco que não entram em P (Taxa ADM gravada sem baixa, baixa depois do fim do mês)
    fora_periodo = sorted(set(soma_banco.index) - refs_P)
    retro = tudo[tudo.baixa_retroativa == True] if len(tudo) else tudo
    ok = abs(falta) < 0.005 and not fora_arquivo
    print(f'\nCONFERÊNCIA {fechamento} (pagos com baixa até {fim:%d/%m/%Y}):')
    print(f'  total pago no arquivo            {brl(total_P):>18}  ({len(P)} títulos)')
    print(f'  = já importado (banco)           {brl(A_db):>18}  ({len(A)} títulos)')
    if difs:
        print(f'    + diferença aceita (TOTVS - banco) {brl(dif_aceita):>14}')
        for x in difs:
            print(f'      {"ok" if x["aceita"] else "X "} ref {x["ref"]} {x["documento"]} {x["fornecedor"][:30]}: arquivo {brl(x["arquivo"])} × banco {brl(x["banco"])} '
                  f'({brl(x["diferenca"])}){" — " + x["obs"] if x["obs"] else " — sem explicação (diferencas_ref.csv)"}')
    print(f'  + novos deste fechamento         {brl(B):>18}  ({len(novos_pagos)} títulos; {novos_pagos.ref_totvs.isin(retro.ref_totvs).sum() if len(retro) else 0} com baixa retroativa)')
    print(f'  + não é custo (NAO_CUSTO etc.)   {brl(C.valor.sum()):>18}  ({len(C)} títulos)')
    print(f'  + pagos fora do dashboard        {brl(D.valor.sum()):>18}  ({len(D)} títulos: documento excluído / sem valor líquido)')
    print(f'  {"FECHA AO CENTAVO" if ok else "NÃO FECHA — PARE: diferença " + brl(falta)}')
    if len(taxa_sem_pag):
        print(f'  fora da conta (Taxa ADM sem pagamento, entra pela regra): {brl(taxa_sem_pag.valor.sum())} ({len(taxa_sem_pag)} título)')
    if fora_periodo:
        print(f'  no banco, fora do período (não pagos até {fim:%d/%m/%Y}): refs {fora_periodo}')
    if len(retro):
        print(f'\n  BAIXA RETROATIVA (pagos em mês já fechado; entram em {fechamento}):')
        for (ref, doc, forn), g in retro.groupby(['ref_totvs', 'documento', 'fornecedor']):
            print(f'    ref {ref} {doc} {forn[:34]} {brl(g.valor.sum())} baixa {pd.to_datetime(g.data_baixa.iloc[0]):%d/%m/%Y}')

    conf = dict(fechamento=fechamento, arquivo=str(totvs), data_corte=f'{corte:%Y-%m-%d}', ok=bool(ok), total_pago=total_P, ja_importado=A_db,
                diferenca_aceita=dif_aceita, novos=B, nao_custo=round(C.valor.sum(), 2), fora_dashboard=round(D.valor.sum(), 2),
                diferenca=falta, taxa_sem_pagamento=round(taxa_sem_pag.valor.sum(), 2),
                refs_ja_importados={str(int(r)): float(soma_banco[int(r)]) for r in A.ref_totvs},
                refs_fora_periodo={str(r): float(soma_banco[r]) for r in fora_periodo},
                refs_novos=sorted(int(r) for r in cand.ref_totvs), refs_nao_custo=sorted(int(r) for r in C.ref_totvs),
                refs_fora_arquivo=[int(r) for r in fora_arquivo], diferencas=difs,
                pendencias=int(len(pend)), total_lancamentos=round(lanc.valor.sum(), 2) if len(lanc) else 0.0)
    json.dump(conf, open('conferencia.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print(f'\n{len(cand)} título(s) novos | {brl(cand.valor.sum())}')
    print(f'Classificados automaticamente: {len(lanc)} lançamentos | {brl(lanc.valor.sum() if len(lanc) else 0)}')
    print(f'Pendências: {len(pend)} | {brl(pend.valor.sum() if len(pend) else 0)}  (a carga recusa enquanto houver pendência)')
    print(f'-> lancamentos.csv, pendencias.csv, nao_custo.csv, conferencia.json')
    if not len(cand):
        print('Nada novo para importar neste fechamento: todos os pagos já estão no banco ou não são custo.')
    if not ok:
        sys.exit(1)

if __name__ == '__main__':
    sys.stdout.reconfigure(errors='replace')   # console do Windows (cp1252)
    if '--fechamento' in sys.argv:
        fech, refs = argumento('--fechamento'), argumento('--refs')
        if not re.fullmatch(r'\d{4}-\d{2}', fech or '') or not refs:
            sys.exit('Uso: py classificador.py <TOTVS acumulado.xlsx> <pasta OC> --fechamento AAAA-MM --refs refs_no_banco.csv')
        fechamento_acumulado(sys.argv[1], sys.argv[2], fech, refs)
        sys.exit(0)
    totvs, pasta_oc = sys.argv[1], sys.argv[2]
    tit, ocs, regras = ler_totvs(totvs), ler_ocs(pasta_oc), carregar_regras()
    total_totvs = round(tit.valor.sum(), 2)
    avisos_taxa_adm(tit)
    tit, nao_custo = separar_nao_custo(tit)
    nao_custo.to_csv('nao_custo.csv', index=False, encoding='utf-8-sig')
    for tp, g in nao_custo.groupby('tipo'):
        print(f'Ignorado (não é custo) — {tp}: {len(g)} título(s) | R$ {g.valor.sum():,.2f}  -> nao_custo.csv')
    lanc, pend = classificar(tit, ocs, regras)
    total = round(tit.valor.sum(), 2)
    soma = round(lanc.valor.sum() + (pend.valor.sum() if len(pend) else 0), 2)
    assert abs(total - soma) < 0.01, f'Total não fecha: {total} x {soma}'
    try:
        orc = set(pd.read_csv('orcamento.csv', dtype=str).eap)
        fora = ~lanc.eap.isin(orc)
        if fora.any():
            lanc.loc[fora, 'alerta'] = 'EAP não existe no orçamento'
            print(f'AVISO: {fora.sum()} lançamento(s) com EAP fora do orçamento')
    except FileNotFoundError:
        pass
    lanc.to_csv('lancamentos.csv', index=False, encoding='utf-8-sig')
    (pend if len(pend) else pd.DataFrame(columns=list(lanc.columns))).to_csv('pendencias.csv', index=False, encoding='utf-8-sig')
    print(f'TOTVS: R$ {total_totvs:,.2f} = custo R$ {total:,.2f} + não custo R$ {nao_custo.valor.sum():,.2f}')
    print(f'{len(tit)} títulos | R$ {total:,.2f}')
    print(f'Classificados automaticamente: {len(lanc)} lançamentos | R$ {lanc.valor.sum():,.2f}')
    print(f'Pendências: {len(pend)} | R$ {pend.valor.sum() if len(pend) else 0:,.2f}')
    tudo = pd.concat([lanc, pend]) if len(pend) else lanc
    vinc = tudo[~tudo.vinculo_oc.isin(['sem OC', 'decisão pontual', 'parcela anterior'])].documento.nunique()
    print(f'Títulos vinculados a OC: {vinc}')
