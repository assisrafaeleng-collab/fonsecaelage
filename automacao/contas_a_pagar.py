"""
Contas a pagar do mês seguinte ao fechamento (card do dashboard; NÃO é custo realizado).
Uso: py contas_a_pagar.py <TOTVS da obra toda.xlsx> <pasta_com_relatorios_OC> --fechamento AAAA-MM
Saída: contas_a_pagar.csv (classificado) e pendencias_contas.csv (precisam de decisão sua)

Regras (decisão out/26):
- entra todo título SEM pagamento cuja Previsão de Baixa (ou Vencimento) cai no mês seguinte ao
  fechamento (fechando 2026-09 -> 2026-10). Sem pagamento de meses anteriores NÃO entra.
- "Prev. Financ." entra, marcada como previsto sem NF. APORTE e NAO_CUSTO de decisoes_pontuais não entram.
- EAP pelo MESMO classificador e as MESMAS regras do fechamento (regras_manuais, decisões, parcelas).
  O que as regras não cobrem vai para pendencias_contas.csv; a decisão vira regra como no fechamento.
- direto/indireto pela EAP: 19.x = indireto, o resto = direto.
Alertas tirados do próprio relatório (os que dependem do banco saem na prévia do importar.js):
- Prev. Financ. que se repete sem virar NF há mais de um mês;
- possível duplicidade com título já pago (mesmo fornecedor e valor).
"""
import sys, re
import pandas as pd
import classificador as c


def argumento(nome):
    if nome in sys.argv:
        i = sys.argv.index(nome)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return None


def mes_seguinte(comp):
    ano, mes = map(int, comp.split('-'))
    return f'{ano + mes // 12}-{mes % 12 + 1:02d}'


def mes(d):
    return pd.to_datetime(pd.Series(d)).dt.strftime('%Y-%m')


def oc_do_titulo(historico):
    m = re.search(r'\bOC\s*0*(\d+)', str(historico))
    return m.group(1) if m else ''


def natureza(tit):
    """'previsto_sem_nf', 'aporte', decisão NAO_CUSTO ou 'nf' — mesmas expressões do fechamento"""
    n = pd.Series('nf', index=tit.index)
    n[tit.historico.str.contains(c.NAO_CUSTO['aporte'], regex=True)] = 'aporte'
    n[(n == 'nf') & tit.historico.str.contains(c.NAO_CUSTO['previsão financeira'], regex=True)] = 'previsto_sem_nf'
    try:
        dp = pd.read_csv('decisoes_pontuais.csv', dtype={'cnpj': str, 'documento': str, 'eap': str}).fillna('')
        for r in dp[dp.eap == 'NAO_CUSTO'].itertuples():
            n[(n == 'nf') & (tit.cnpj == r.cnpj) & (tit.documento == r.documento)] = 'nao_custo'
    except FileNotFoundError:
        pass
    return n


def base_nf(documento):
    """'99222/03' -> '99222': parcelas da mesma NF têm o mesmo número antes da barra"""
    return str(documento).split('/')[0].lstrip('0')


def recorrentes():
    """fornecedores_recorrentes.csv: pagamento mensal (decisão out/26). Mesmo valor em outro mês e outro
    documento é a mensalidade, não duplicidade."""
    try:
        return set(pd.read_csv('fornecedores_recorrentes.csv', dtype=str).cnpj.dropna())
    except FileNotFoundError:
        return set()


def alertas_do_relatorio(alvo, todos):
    """alerta por título (chave cnpj|documento), olhando o relatório inteiro"""
    al = {}
    add = lambda k, txt: al.setdefault(k, []).append(txt)
    chave = lambda d: d.cnpj + '|' + d.documento
    prev = todos[todos.historico.str.contains(c.NAO_CUSTO['previsão financeira'], regex=True)].copy()
    prev['oc'] = prev.historico.map(oc_do_titulo)
    pagos = todos[todos.pago == True]
    mensais = recorrentes()
    for t in alvo.itertuples():
        k = t.cnpj + '|' + t.documento
        if t.natureza == 'previsto_sem_nf':
            oc = oc_do_titulo(t.historico)
            mesma = prev[(prev.oc == oc) & (prev.oc != '')] if oc else prev.iloc[0:0]
            desde = pd.to_datetime(mesma.emissao).min() if len(mesma) else pd.to_datetime(t.emissao)
            venc = pd.to_datetime(t.competencia)
            if pd.notna(desde) and venc > desde + pd.DateOffset(months=1):
                abertas = mesma[mesma.pago == False]
                add(k, f'Prev. Financ. da OC {oc or "?"} sem NF desde {desde:%d/%m/%Y}'
                       + (f' ({len(abertas)} parcelas em aberto)' if len(abertas) > 1 else ''))
        # mesmo fornecedor e mesmo valor já pago em outro título. Não contam: parcelas da mesma NF
        # (99222/01, /02, /03 de valor igual) e pagamento fixo mensal (o mesmo valor já pago em
        # dois ou mais meses, ex.: salário, aluguel).
        dup = pagos[(pagos.cnpj == t.cnpj) & ((pagos.valor - t.valor).abs() < 0.005) & (pagos.documento != t.documento)]
        dup = dup[dup.documento.map(base_nf) != base_nf(t.documento)]
        if mes(dup.competencia).nunique() >= 2:
            dup = dup.iloc[0:0]
        if t.cnpj in mensais:
            dup = dup[mes(dup.competencia).values == mes([t.competencia]).iloc[0]]
        for d in dup.itertuples():
            add(k, f'possível duplicidade: título {d.documento} de mesmo valor já pago em {pd.to_datetime(d.competencia):%d/%m/%Y}')
    return {k: ' | '.join(v) for k, v in al.items()}


if __name__ == '__main__':
    if len(sys.argv) < 3 or not re.fullmatch(r'\d{4}-\d{2}', argumento('--fechamento') or ''):
        sys.exit('Uso: py contas_a_pagar.py <TOTVS obra toda.xlsx> <pasta OC> --fechamento AAAA-MM')
    totvs, pasta_oc, fechamento = sys.argv[1], sys.argv[2], argumento('--fechamento')
    alvo_mes = mes_seguinte(fechamento)

    todos = c.ler_totvs(totvs)
    if todos.pago.isna().any():
        sys.exit('O relatório não tem a coluna VALOR PAGO: não dá para saber o que está em aberto.')
    todos['natureza'] = natureza(todos)
    em_aberto = todos[todos.pago == False]
    alvo = em_aberto[mes(em_aberto.competencia).values == alvo_mes].reset_index(drop=True)
    antigos = em_aberto[mes(em_aberto.competencia).values < alvo_mes]
    print(f'Fechamento {fechamento} -> contas a pagar de {alvo_mes} (Previsão de Baixa; sem ela, Vencimento)')
    print(f'  {len(alvo)} título(s) sem pagamento em {alvo_mes} | R$ {alvo.valor.sum():,.2f}')
    print(f'  fora: {len(antigos)} título(s) sem pagamento de meses anteriores | R$ {antigos.valor.sum():,.2f}')
    for nat in ['aporte', 'nao_custo']:
        x = alvo[alvo.natureza == nat]
        if len(x):
            print(f'  fora ({nat}): {len(x)} título(s) | R$ {x.valor.sum():,.2f}')
    entra = alvo[alvo.natureza.isin(['nf', 'previsto_sem_nf'])].reset_index(drop=True)

    ocs, regras = c.ler_ocs(pasta_oc), c.carregar_regras()
    lanc, pend = c.classificar(entra, ocs, regras)
    linhas = pd.concat([lanc, pend]) if len(pend) else lanc
    soma = round(linhas.valor.sum(), 2)
    assert abs(soma - round(entra.valor.sum(), 2)) < 0.01, f'Total não fecha: {entra.valor.sum():.2f} x {soma:.2f}'

    k = lambda d: d.cnpj + '|' + d.documento
    info = entra.assign(k=k(entra)).set_index('k')
    alertas = alertas_do_relatorio(entra, todos)
    linhas['chave'] = k(linhas)
    linhas['seq'] = linhas.groupby('chave').cumcount() + 1
    linhas['natureza'] = linhas.chave.map(info.natureza)
    linhas['historico'] = linhas.chave.map(info.historico)
    linhas['data_vencimento'] = linhas.chave.map(info.vencimento)
    linhas['data_previsao'] = linhas.chave.map(info.competencia)
    linhas['valor_titulo'] = linhas.chave.map(info.valor)
    linhas['classe'] = linhas.eap.fillna('').map(lambda e: 'pendente' if not e else ('indireto' if e.startswith('19.') else 'direto'))
    linhas['alertas'] = linhas.chave.map(alertas).fillna('')
    linhas['competencia_fechamento'] = fechamento
    linhas['competencia_vencimento'] = alvo_mes
    try:
        orc = set(pd.read_csv('orcamento.csv', dtype=str).eap)
        fora = (linhas.eap.fillna('') != '') & ~linhas.eap.isin(orc)
        linhas.loc[fora, 'alerta'] = 'EAP não existe no orçamento'
    except FileNotFoundError:
        pass
    colunas = ['competencia_fechamento', 'competencia_vencimento', 'cnpj', 'fornecedor', 'documento', 'seq',
               'historico', 'item', 'oc', 'data_emissao', 'data_vencimento', 'data_previsao', 'valor_titulo',
               'valor', 'eap', 'classe', 'natureza', 'vinculo_oc', 'regra', 'alerta', 'alertas']
    linhas[colunas].to_csv('contas_a_pagar.csv', index=False, encoding='utf-8-sig')
    p = linhas[linhas.classe == 'pendente']
    (p if len(p) else linhas.iloc[0:0])[[x for x in pend.columns] if len(pend) else colunas] \
        .to_csv('pendencias_contas.csv', index=False, encoding='utf-8-sig')

    print(f'\n  entram: {len(entra)} título(s) | R$ {soma:,.2f}  -> contas_a_pagar.csv')
    for (nat, cls), g in linhas.groupby(['natureza', 'classe']):
        print(f'    {"previsto sem NF" if nat == "previsto_sem_nf" else "com NF":15s} {cls:9s} {g.chave.nunique():3d} título(s) | R$ {g.valor.sum():,.2f}')
    if len(p):
        print(f'\n  PENDÊNCIAS ({p.chave.nunique()} título(s), R$ {p.valor.sum():,.2f}) -> pendencias_contas.csv')
        for (doc, forn), g in p.groupby(['documento', 'fornecedor'], sort=False):
            print(f'    {doc:16s} {forn[:38]:38s} R$ {g.valor.sum():>11,.2f}  {g.regra.iloc[0]}'
                  + (f' ({len(g)} itens)' if len(g) > 1 else ''))
        print('  Decida a EAP e grave como regra (regras_manuais.csv / decisoes_pontuais.csv), depois rode de novo.')
    if alertas:
        print(f'\n  ALERTAS do relatório ({len(alertas)} título(s)):')
        for kk, a in alertas.items():
            t = info.loc[kk]
            print(f'    {kk.split("|")[1]:16s} {t.fornecedor[:38]:38s} R$ {t.valor:>11,.2f}  {a}')
    print('\n  Próximo passo (prévia, não grava): node ../ferramentas/fechamento/importar.js --contas-classificador contas_a_pagar.csv')
