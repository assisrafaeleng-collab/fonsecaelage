# Dashboard Flats BH

Next.js (deploy automático na Vercel a partir da `main`), banco Supabase. A automação de custos
fica em `automacao/` — leia `automacao/LEIAME.md` antes de mexer nela.

## Regras de fechamento do mês (custos)
1. Fonte oficial do mês = relatório TOTVS de títulos PAGOS no mês (ex.: `automacao/entrada/setembro-26.xlsx`).
   Título sem pagamento não entra; entra no mês em que constar como pago.
2. Taxa ADM da Fonseca & Lage: a do mês M sempre entra no mês M+1 (a de agosto entra em setembro).
   Ela vem no relatório de custos do mês; o classificador a inclui mesmo sem marcação de pago.
   No máximo uma por mês: se a prévia avisar que veio mais de uma, ou nenhuma, confira antes de gravar.
3. Não são custo: "Prev. Financ.", APORTE e NF já paga por adiantamento (`NAO_CUSTO` em
   `decisoes_pontuais.csv`).
4. Mantenha as classificações e rateios já decididos (`regras_manuais.csv`, `decisoes_pontuais.csv`);
   não altere a lógica de classificação sem perguntar.
5. Nada vai para o banco sem prévia: `importar.js` sem `--confirmar` primeiro, e `--confirmar` só com
   autorização explícita. Competências até 2026-07 são histórico manual e não são substituídas.

## Ambiente
- Python é `py`, não `python`.
- Não leia `.env.local` nem `automacao/.env` (credenciais). Para consultar o banco, use as rotas GET do
  dashboard (`npx next dev`) ou o `importar.js` sem `--confirmar`.
- Regras, decisões, fechamentos, projetos e prévias são locais (estão no `.gitignore`); não commitar.
