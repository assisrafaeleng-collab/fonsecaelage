import re, unicodedata
STOP = {'DE','DA','DO','DAS','DOS','E','C/','COM','P/','PARA','A','O','EM','-','—','REF','FATURA','PARCELA'}
def norm(s):
    s = '' if s is None or (isinstance(s, float) and s != s) else str(s)
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'\s+', ' ', s.upper()).strip()
    s = re.sub(r'^\d{2}\.\d{3}\.\d{3} ', '', s)          # "68.532.194 FABIO..." -> "FABIO..."
    s = s.replace(' S/A', ' SA').replace(' S.A', ' SA')
    return s
def raiz_cnpj(c):
    d = re.sub(r'\D', '', str(c or ''))
    return d[:8] if len(d) == 14 else d                  # CNPJ: raiz (8); CPF: inteiro
def tokens(s):
    """palavras significativas: sem números puros, datas e conectivos"""
    t = re.split(r'[\s,;:()+|]+', norm(s))
    return {w for w in t if w and w not in STOP and not re.fullmatch(r'[\d./x-]+', w.lower())}
def similaridade(a, b):
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb: return 0.0
    return len(ta & tb) / len(ta | tb)
def chave_col(c):
    c = unicodedata.normalize('NFKD', str(c)).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', c.lower()).strip()
def padronizar(df, sinonimos, obrigatorias=(), origem=''):
    mapa = {}
    for c in df.columns:
        for alvo, ops in sinonimos.items():
            if chave_col(c) in ops and alvo not in mapa.values():
                mapa[c] = alvo
    faltam = [c for c in obrigatorias if c not in mapa.values()]
    if faltam:
        raise ValueError(f'{origem}: faltam as colunas {faltam}. Encontradas: {list(df.columns)}')
    return df.rename(columns=mapa)
