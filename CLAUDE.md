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
6. Contas a pagar (card separado, nunca entra em `custos_lancamentos`): só títulos SEM pagamento do relatório
   TOTVS da obra toda com vencimento/previsão de baixa A PARTIR do mês do fechamento, até a última parcela
   (fechando setembro → setembro, outubro, novembro...); sem pagamento com vencimento ANTES do mês do
   fechamento não entra. O card mostra "Vencimentos a partir de AAAA-MM · fechamento AAAA-MM" e, ao clicar,
   a lista por mês de vencimento (sem senha). "Prev. Financ." entra como previsto sem NF, EXCETO de OC já
   faturada (NFs da OC, no custo pago ou no contas a pagar, cobrindo 98% ou mais do valor da OC: a previsão
   é resto no TOTVS e não entra). APORTE não entra. EAP pelo mesmo classificador e regras; o que não tiver regra é pendência e a decisão vira regra.
   Só entra o que é pago POR ENTREGA (material, serviço por empreitada/medido, indireto pontual). RECORRENTE
   sai do card e do IPC: direto fora do avanço físico (`entra_evm = false`: locação 17, funcionários 18) ou
   agregado por tempo (1.1.6), e indireto diluído na obra (`mes_desembolso = 0`: 19.1.18, 19.1.21, 19.1.23 a
   19.1.26). O realizado não muda: recorrente pago continua no custo do mês.
   Fluxo: `automacao/contas_a_pagar.py` → `importar.js --contas-classificador` (prévia) → `--confirmar`.

## Indicadores (decisões out/26)
- Avanço físico, em todas as telas = horas executadas ÷ horas orçadas (parcela de produção). Nunca ponderado
  por valor. O dashboard mensal e a página semanal mostram o mesmo número (`lib/avanco-hh.js`).
- IPC / eficiência de custo direto (cards, linhas e projeção) = valor agregado do direto ÷ (custo direto
  realizado + contas a pagar do direto por entrega, com NF e "Prev. Financ."). Acima de 1 = economia.
  Indireto e recorrentes ficam fora do a pagar.
- Projeção pessimista: IDP limitado a 1 (adiantamento não barateia a obra).
- Direto × indireto sempre pela EAP: grupo 19 = indireto, o resto = direto.

## Ambiente
- Python é `py`, não `python`.
- Não leia `.env.local` nem `automacao/.env` (credenciais). Para consultar o banco, use as rotas GET do
  dashboard (`npx next dev`) ou o `importar.js` sem `--confirmar`.
- Regras, decisões, fechamentos, projetos e prévias são locais (estão no `.gitignore`); não commitar.
