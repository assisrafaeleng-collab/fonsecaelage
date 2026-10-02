"""
Gera regras.csv a partir de fechamentos já feitos manualmente.
Uso: python gerar_regras.py fechamento_jul.xlsx totvs_jul.xlsx [fechamento_ago.xlsx totvs_ago.xlsx ...]
"""
import sys, pandas as pd
from util import norm, raiz_cnpj, padronizar, tokens

SIN_FECH = {'eap': ['codigo da eap'], 'fornecedor': ['fornecedor'], 'documento': ['no documento'],
            'item': ['item comprado (historico / descricao)', 'historico / descricao'], 'valor': ['valor (r$)']}
SIN_TOT = {'nome': ['nome'], 'cnpj': ['cnpj/cpf']}

def carregar(fech, totvs, rotulo):
    d = padronizar(pd.read_excel(fech, sheet_name='Lançamentos'), SIN_FECH, SIN_FECH.keys(), fech)
    d = d.dropna(subset=['eap'])
    t = padronizar(pd.read_excel(totvs), SIN_TOT, SIN_TOT.keys(), totvs).dropna(subset=['nome'])
    cnpj = {norm(n): raiz_cnpj(c) for n, c in zip(t['nome'], t['cnpj'])}
    d['forn'] = d['fornecedor'].map(norm)
    d['cnpj'] = d['forn'].map(lambda n: cnpj.get(n, ''))
    d['item'] = d['item'].map(norm)
    d['eap'] = d['eap'].astype(str).str.strip()
    d['mes'] = rotulo
    return d[['cnpj', 'forn', 'item', 'eap', 'valor', 'mes', 'documento']]

if __name__ == "__main__":
    args = sys.argv[1:] or ['fechamento_jul.xlsx', 'totvs_jul.xlsx', 'fechamento_ago.xlsx', 'totvs_ago.xlsx']
    d = pd.concat([carregar(args[i], args[i + 1], args[i]) for i in range(0, len(args), 2)])
    sem_cnpj = d[d.cnpj == ''].forn.unique()
    if len(sem_cnpj): print('AVISO: fornecedores sem CNPJ no TOTVS (regra por nome):', list(sem_cnpj))

    regras = []
    # itens com as mesmas palavras significativas (ex.: 'REF FATURA 141 JOSE...' e '...142...') formam um só grupo
    d['assinatura'] = d['item'].map(lambda i: ' '.join(sorted(tokens(i))))
    for (c, f, a), g in d.groupby(['cnpj', 'forn', 'assinatura']):
        eaps = g.groupby('eap').valor.sum()
        i = g['item'].iloc[0]
        if not a or ' + ' in i or len(eaps) > 1:
            continue
        regras.append(dict(cnpj=c, fornecedor=f, padrao_item=i, tipo='fixa', eap=eaps.index[0], obs=f'{len(g)} lanç.'))
    for (c, f), g in d.groupby(['cnpj', 'forn']):
        eaps = g.groupby('eap').valor.sum()
        if len(eaps) == 1:
            regras.append(dict(cnpj=c, fornecedor=f, padrao_item='*', tipo='fixa', eap=eaps.index[0], obs=f'{len(g)} lanç.'))
        else:
            dist = '; '.join(f'{e}={v / eaps.sum():.1%}' for e, v in eaps.sort_values(ascending=False).items())
            regras.append(dict(cnpj=c, fornecedor=f, padrao_item='*', tipo='pendente', eap='',
                               obs=f'Histórico em várias EAPs: {dist}'))
    # regras por valor (VALOR=x) ficam em regras_manuais.csv, que é local e tem prioridade
    pd.DataFrame(regras).to_csv('regras.csv', index=False, encoding='utf-8-sig')
    # parcelas: a mesma NF (ex.: 950513/01 e 950513/02) repete o rateio já decidido
    d['nf_base'] = d['documento'].astype(str).str.strip().str.extract(r'^0*(\d+)/\d+$')[0]
    par = d.dropna(subset=['nf_base']).groupby(['cnpj', 'nf_base', 'eap']).valor.sum().reset_index()
    par['proporcao'] = par.valor / par.groupby(['cnpj', 'nf_base']).valor.transform('sum')
    par[['cnpj', 'nf_base', 'eap', 'proporcao']].to_csv('regras_parcelas.csv', index=False, encoding='utf-8-sig')
    print(len(regras), 'regras geradas de', len(d), 'lançamentos')
