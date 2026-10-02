"""Compara a saída do classificador com um fechamento manual (por título e EAP)."""
import sys, pandas as pd
from util import padronizar, norm
from gerar_regras import SIN_FECH
fech = sys.argv[1]
d = padronizar(pd.read_excel(fech, sheet_name='Lançamentos'), SIN_FECH, SIN_FECH.keys(), fech).dropna(subset=['eap'])
d['documento'] = d['documento'].astype(str).str.strip() + ' | ' + d['fornecedor'].map(norm); d['eap'] = d['eap'].astype(str).str.strip()
man = d.groupby(['documento', 'eap']).valor.sum().round(2)
l = pd.read_csv('lancamentos.csv', dtype={'eap': str, 'documento': str})
l['documento'] = l['documento'] + ' | ' + l['fornecedor']
try:
    p = pd.read_csv('pendencias.csv', dtype={'documento': str})
except pd.errors.EmptyDataError:
    p = pd.DataFrame(columns=['documento'])
pend_docs = set(p.documento + ' | ' + p.fornecedor) if len(p) else set()
res = []
for doc, g in l.groupby('documento'):
    auto = g.groupby('eap').valor.sum().round(2).to_dict()
    m = man.loc[doc].to_dict() if doc in man.index.get_level_values(0) else {}
    parcial = doc in pend_docs
    acerto = sum(min(v, m.get(e, 0)) for e, v in auto.items())
    res.append(dict(documento=doc, fornecedor=g.fornecedor.iloc[0], parcial=parcial, valor_auto=round(sum(auto.values()), 2),
                    valor_certo=round(acerto, 2), auto=auto, manual=m))
r = pd.DataFrame(res)
tot = r.valor_auto.sum()
print(f'Classificado automaticamente: R$ {tot:,.2f} | na EAP certa: R$ {r.valor_certo.sum():,.2f} ({r.valor_certo.sum()/tot:.1%})')
erros = r[r.valor_certo < r.valor_auto - 0.01]
for e in erros.itertuples(): print('  DIFERENTE:', e.documento, e.fornecedor, 'auto', e.auto, '| manual', e.manual)
