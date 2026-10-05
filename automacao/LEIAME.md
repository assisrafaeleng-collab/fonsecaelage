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
   Título sem pagamento não entra; entra no mês em que constar como pago.
2. Taxa ADM da Fonseca & Lage: a do mês M sempre entra no mês M+1 (a Taxa ADM de agosto entra em
   setembro), mesmo que não apareça como paga no relatório. Acrescente a linha dela (tirada do TOTVS
   da obra toda) ao relatório de pagos antes de rodar o classificador.
3. Não são custo: "Prev. Financ." (OC sem NF), APORTE e NF já paga por adiantamento (marcada em
   decisoes_pontuais.csv com eap = NAO_CUSTO). Vão para nao_custo.csv.

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
