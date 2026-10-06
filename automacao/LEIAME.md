# Classificador TOTVS → EAP (Flats BH)

## Estrutura de pastas
    classificador.py   lê o TOTVS, vincula às OCs, abre por item, classifica por EAP
    gerar_regras.py    cria regras.csv a partir dos fechamentos manuais
    comparar.py        compara a saída com um fechamento manual (teste de acerto)
    util.py            normalização de nomes, CNPJ e similaridade de itens
    regras.csv         regras aprendidas dos fechamentos (recriada pelo gerar_regras.py)
    regras_manuais.csv SUAS decisões — têm prioridade e nunca são apagadas
    regras_parcelas.csv rateio de NFs já fechadas (parcela /02 repete a /01)
    etapa.csv          EAP do pavimento em execução p/ itens VOLÁTEIS (aço, arame, espaçador, forma) — atualize quando a obra subir de pavimento
    orcamento.csv      orçamento por EAP (238 linhas, R$ 6.042.242,03) — base do Orçado × Realizado
    decisoes_pontuais.csv decisão para UM título específico (cnpj + documento → EAP)
    oc/                TODOS os relatórios de OC, nomeados OC_AAAA-MM.xls (ex.: OC_2026-09.xls)

## Regras de fechamento (decisão out/26)
1. Fonte oficial do mês = relatório TOTVS de títulos PAGOS no mês (ex.: entrada/setembro-26.xlsx).
   Título sem pagamento não entra; entra no mês em que constar como pago. O classificador confere:
   título sem VALOR PAGO, sem Valor Baixado e sem Data de Baixa vai para nao_custo.csv como
   "sem pagamento no relatório" (só quando o relatório tem a coluna VALOR PAGO; sem ela, avisa).
2. Taxa ADM da Fonseca & Lage: a do mês M sempre entra no mês M+1 (a Taxa ADM de agosto entra em
   setembro). Ela vem no relatório de custos do mês e o classificador a inclui mesmo sem marcação
   de pago. No máximo uma por mês: a prévia avisa se vier mais de uma, ou se não vier nenhuma.
3. Não são custo: "Prev. Financ." (OC sem NF), APORTE e NF já paga por adiantamento (marcada em
   decisoes_pontuais.csv com eap = NAO_CUSTO). Vão para nao_custo.csv.

## Contas a pagar (decisão out/26)
Card separado do custo realizado: nada daqui vai para custos_lancamentos.
1. Entra só título SEM pagamento (sem VALOR PAGO, Valor Baixado e Data de Baixa) do relatório TOTVS da
   obra toda com Previsão de Baixa (ou Vencimento) no mês SEGUINTE ao fechamento (fechando 2026-09 →
   2026-10). Sem pagamento de meses anteriores NÃO entra.
2. "Prev. Financ." entra, marcada como previsto sem NF. APORTE e NAO_CUSTO não entram.
   Só entra o que é pago POR ENTREGA: material, serviço por empreitada (pago por serviço pronto/medido)
   e indireto pontual (projetos, taxas, laudos, cartório). RECORRENTE sai do card e do IPC, pela
   marcação que o sistema já tem (o importar.js aplica na prévia e na carga):
   - direto fora do avanço físico (orcamento_planejado.entra_evm = false: locação 17, funcionários 18)
     ou agregado por tempo (1.1.6: limpeza, EPI, ferramental, consumo);
   - indireto diluído na obra (custos_indiretos_planejados.mes_desembolso = 0: contábeis, IPTU,
     engenheiro, Taxa ADM, restaurante, padaria).
   O realizado (já pago) não muda: recorrente pago continua no custo do mês.
3. EAP pelo mesmo classificador e as mesmas regras do fechamento. O que as regras não cobrem vai para
   pendencias_contas.csv; a decisão vira regra (regras_manuais.csv se o fornecedor se repete,
   decisoes_pontuais.csv se é um título específico). Direto × indireto pela EAP (19.x = indireto).
4. Alertas (na prévia, no card e no detalhe): fornecedor novo; valor mais de 50% acima da média do
   fornecedor; "Prev. Financ." sem virar NF há mais de um mês; possível duplicidade com título já pago
   ou já lançado (mesmo fornecedor e valor). Não contam como duplicidade: parcelas da mesma NF e os
   fornecedores de pagamento mensal de fornecedores_recorrentes.csv (mesmo valor em outro mês e outro
   documento).
Uso:
    py contas_a_pagar.py "entrada/TOTVS_obra_toda_ate_2026-09.XLSX" oc --fechamento 2026-09
    node ../ferramentas/fechamento/importar.js --contas-classificador contas_a_pagar.csv            (prévia)
    node ../ferramentas/fechamento/importar.js --contas-classificador contas_a_pagar.csv --confirmar
A carga substitui a foto inteira do fechamento (tabela contas_a_pagar, supabase/contas/1-contas-a-pagar.sql).
Título sem EAP só grava com --aceitar-pendencias (fica fora do IPC).

## Indicadores do dashboard (decisão out/26)
- Avanço físico = horas executadas ÷ horas orçadas, em todas as telas. Nunca ponderado por valor.
- IPC = valor agregado do direto ÷ (realizado do direto + contas a pagar do direto por entrega, com NF e
  previsões). Acima de 1 = economia. Indireto e recorrentes ficam fora do a pagar.
- Projeção pessimista: IDP limitado a 1 (adiantamento não barateia a obra).

## Uso mensal
    pip install pandas openpyxl xlrd
    python classificador.py "setembro-26.xlsx" oc
Competência = Data de Baixa; se vazia, Data de Previsão de Baixa; por último, Vencimento.
Gera lancamentos.csv (classificados), pendencias.csv (precisam de decisão) e nao_custo.csv.
Para com erro se a soma não fechar ao centavo com o TOTVS.
Gravação: node ferramentas/fechamento/importar.js --classificador lancamentos.csv (prévia) e depois
com --confirmar; a carga substitui a competência inteira e pode ser desfeita com --desfazer <id>.

## Depois de fechar o mês manualmente
    python comparar.py "Custos Flats BH - Fechamento Setembro.xlsx"      # mede o acerto
    python gerar_regras.py fech_jul.xlsx totvs_jul.xlsx fech_ago.xlsx totvs_ago.xlsx fech_set.xlsx totvs_set.xlsx

## Vínculo com OC
1. Pelo número da OC no documento ("OC 1809")
2. Pela NF + CNPJ (OC já faturada)
3. Por valor: OC PENDENTE do mesmo fornecedor (ou soma de duas) = valor original do título → confiança MÉDIA

## Regras
- padrao_item = '*'        → qualquer item do fornecedor
- padrao_item = 'VALOR=x'  → título com esse valor exato (ex.: VALOR=1500 → pagamento mensal fixo de um fornecedor)
- padrao_item = texto      → item parecido (≥50% das palavras em comum)
- cnpj = '*'               → regra de item válida para qualquer fornecedor (ex.: espaçadores)
- eap = 'ETAPA:ACO_MATERIAL' → usa a EAP definida em etapa.csv
- padrao_item = 'CONTEM:X'  → item que contém a palavra X (ex.: locação de VIBRADOR)
- vigente_desde = AAAA-MM-DD → a regra só vale para títulos com competência a partir dessa data
- tipo = pendente          → fornecedor que já foi para várias EAPs: sempre vai para a fila
- eap = '19.1.7=0.581;19.1.9=0.419' → rateio fixo entre EAPs (fecha ao centavo na última)
- etapa.csv tem vigente_desde: a EAP da etapa é a vigente na competência do título
- decisoes_pontuais.csv com eap = NAO_CUSTO → o título sai do custo (ex.: NF já paga por adiantamento)

## Próximos passos (Claude Code)
1. Gravar lancamentos no Supabase (upsert por documento + fornecedor)
2. Tela de pendências no dashboard (confirmar rateio → vira regra)
3. Vigia de pasta + Agendador de Tarefas do Windows
