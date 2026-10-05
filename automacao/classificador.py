"""
Classificador de custos TOTVS -> EAP  (protótipo, obra Flats BH)
Uso: python classificador.py <relatorio_totvs.xlsx> <pasta_com_relatorios_OC>
Saída: lancamentos.csv, pendencias.csv
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
    }).reset_index(drop=True)

# não são custo (decisão out/26): previsão financeira de OC ainda sem NF e aporte de sócio.
# Saem da classificação e vão para nao_custo.csv (base do futuro card de contas a pagar).
NAO_CUSTO = {'previsão financeira': r'PREV\.?\s*FINANC', 'aporte': r'\bAPORTE\b'}

def separar_nao_custo(tit):
    tipo = pd.Series('', index=tit.index)
    for nome, padrao in NAO_CUSTO.items():
        tipo[(tipo == '') & tit.historico.str.contains(padrao, regex=True)] = nome
    # título que você marcou em decisoes_pontuais.csv com eap = NAO_CUSTO (ex.: NF já paga por adiantamento)
    try:
        dp = pd.read_csv('decisoes_pontuais.csv', dtype={'cnpj': str, 'documento': str, 'eap': str}).fillna('')
        dp = dp[dp.eap == 'NAO_CUSTO']
        for r in dp.itertuples():
            tipo[(tipo == '') & (tit.cnpj == r.cnpj) & (tit.documento == r.documento)] = r.obs or 'decisão: não é custo'
    except FileNotFoundError:
        pass
    fora = tit[tipo != ''].assign(tipo=tipo[tipo != ''])
    return tit[tipo == ''].reset_index(drop=True), fora.reset_index(drop=True)

SIN_OC = {
    'oc': ['no oc'], 'cnpj': ['cnpj'], 'fornecedor': ['razao social'], 'item': ['nome prod'],
    'total_item': ['total do item'], 'nf': ['no nf'], 'status': ['desc_status'],
    'cc': ['descricao c.custo'], 'emissao': ['data emissao'],
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

def resolver_etapa(eap, alerta, competencia=None):
    """EAP 'ETAPA:ACO_MATERIAL' -> linha do pavimento em execução na competência do título (etapa.csv)"""
    if eap and eap.startswith('ETAPA:'):
        cat = eap.split(':', 1)[1]
        e = ETAPA[ETAPA.categoria == cat]
        if competencia is not None:
            e = e[(e.vigente_desde == '') | (e.vigente_desde <= str(competencia))]
        if len(e) == 0:
            return None, f'categoria {cat} sem EAP em etapa.csv'
        e = e.sort_values('vigente_desde').iloc[-1]
        return e.eap, (alerta + ' | ' if alerta else '') + f'EAP pela etapa ({cat} = {e.eap})'
    return eap, alerta

def aplicar_regra(regras, cnpj, fornecedor, item, valor, competencia=None):
    manuais, geradas = regras
    eap, motivo, alerta = _aplicar(manuais, cnpj, fornecedor, item, valor, competencia)
    if eap:
        eap, alerta = resolver_etapa(eap, alerta, competencia)
        return eap, motivo.replace('regra por', 'decisão sua por'), alerta
    return _aplicar(geradas, cnpj, fornecedor, item, valor)

def ratear(eap, valor, competencia=None):
    """regra com rateio: eap = '19.1.7=0.581;19.1.9=0.419' -> [(eap, valor), ...] fechando ao centavo na última"""
    if not eap or '=' not in eap:
        return [(eap, valor)]
    partes = [p.split('=') for p in eap.split(';') if p.strip()]
    vals = [round(valor * float(pr), 2) for _, pr in partes]
    vals[-1] = round(vals[-1] + valor - sum(vals), 2)
    return [(resolver_etapa(e.strip(), '', competencia)[0], v) for (e, _), v in zip(partes, vals)]

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
        if len(dp):
            # rateio informado por você (ex.: boletim de medição); linha sem EAP vai para pendências
            vals = [round(t.valor * float(p), 2) for p in dp.proporcao]
            vals[-1] = round(vals[-1] + t.valor - sum(vals), 2)
            for r, v in zip(dp.fillna('').itertuples(), vals):
                eap_r, _ = resolver_etapa(r.eap, '', t.competencia)
                r = r._replace(eap=eap_r or '')
                row = dict(documento=t.documento, fornecedor=t.fornecedor, item=r.obs, oc='',
                           competencia=t.competencia, valor=v, eap=r.eap, vinculo_oc='decisão pontual',
                           regra=f'decisão: {r.obs}', alerta=getattr(r, 'alerta', ''),
                           data_emissao=t.emissao, cnpj=t.cnpj,
                           classificacao=getattr(r, 'classificacao', ''))   # opcional, vai para o banco
                (lanc if r.eap else pend).append(row)
            continue
        m = re.match(r'^0*(\d+)/\d+$', t.documento)
        ant = parcelas[(parcelas.cnpj == t.cnpj) & (parcelas.nf_base == m.group(1))] if m else parcelas.iloc[0:0]
        rm = regras[0]
        volatil = len(rm[(rm.cnpj == t.cnpj) & rm.eap.str.startswith('ETAPA:') & ((rm.vigente_desde == '') | (rm.vigente_desde <= str(t.competencia)))]) > 0
        if len(ant) and not volatil:
            # outra parcela de uma NF já fechada: repete o mesmo rateio
            partes = [(e, round(t.valor * p, 2)) for e, p in zip(ant.eap, ant.proporcao)]
            dif = round(t.valor - sum(v for _, v in partes), 2)
            partes[0] = (partes[0][0], round(partes[0][1] + dif, 2))
            for e, v in partes:
                lanc.append(dict(documento=t.documento, fornecedor=t.fornecedor, item=t.historico, oc='',
                                 competencia=t.competencia, valor=v, eap=e, vinculo_oc='parcela anterior',
                                 regra='mesmo rateio da parcela anterior da NF', alerta='',
                                 data_emissao=t.emissao, cnpj=t.cnpj))
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
            eap, motivo, alerta = aplicar_regra(regras, t.cnpj, t.fornecedor, item, t.valor if len(partes) == 1 else valor, t.competencia)
            for eap_r, valor_r in ratear(eap, valor, t.competencia):
                row = dict(documento=t.documento, fornecedor=t.fornecedor, item=item, oc=oc,
                           competencia=t.competencia, valor=valor_r, eap=eap_r or '',
                           vinculo_oc=conf or 'sem OC', regra=motivo, alerta=alerta,
                           data_emissao=t.emissao, cnpj=t.cnpj)
                (lanc if eap_r else pend).append(row)
    return pd.DataFrame(lanc), pd.DataFrame(pend)

if __name__ == '__main__':
    totvs, pasta_oc = sys.argv[1], sys.argv[2]
    tit, ocs, regras = ler_totvs(totvs), ler_ocs(pasta_oc), carregar_regras()
    total_totvs = round(tit.valor.sum(), 2)
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
