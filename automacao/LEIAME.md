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

## Uso mensal
    pip install pandas openpyxl xlrd
    python classificador.py "Custos TOTS - Setembro - 2026.XLSX" oc
Competência = Data de Baixa; se vazia, Data de Previsão de Baixa; por último, Vencimento.
Gera lancamentos.csv (classificados) e pendencias.csv (precisam de decisão).
Para com erro se a soma não fechar ao centavo com o TOTVS.

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

## Próximos passos (Claude Code)
1. Gravar lancamentos no Supabase (upsert por documento + fornecedor)
2. Tela de pendências no dashboard (confirmar rateio → vira regra)
3. Vigia de pasta + Agendador de Tarefas do Windows
