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
   obra toda com Previsão de Baixa (ou Vencimento) A PARTIR do mês do fechamento, até a última parcela
   (fechando 2026-09 → 2026-09, 2026-10, 2026-11...). Sem pagamento com vencimento ANTES do mês do
   fechamento NÃO entra. Cada linha guarda o mês do próprio vencimento (competencia_vencimento); o card
   mostra a lista por mês ao clicar.
2. "Prev. Financ." entra, marcada como previsto sem NF. APORTE e NAO_CUSTO não entram.
   "Prev. Financ." de OC já faturada NÃO entra (contas_a_pagar.py, LIMIAR_OC_FATURADA = 98%): quando as
   NFs da OC, pagas ou a pagar no relatório da obra toda, cobrem praticamente o valor da OC, a previsão
   que sobrou no TOTVS é resto. NFs da OC = relatório de OC + vínculos registrados nas decisões
   ("... OC 1739 ..."). NAO_CUSTO em decisoes_pontuais vale também para "Prev. Financ.".
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
- Valor agregado do material (aço e material de forma "Apenas Material"; concreto fica fora): o maior entre
  avanço do serviço × orçado e custo da linha (pago + a pagar) limitado ao orçado.
- Avanço físico = horas executadas ÷ horas orçadas, em todas as telas. Nunca ponderado por valor.
- Bandeja (17.1.10, verba R$ 41.887,00): avanço por unidade, 3 bandejas = 33,33% cada (a primária medida em
  30/09/26; a 2ª e a 3ª como 66,67% e 100%). Agregado = % medido × verba. Compra por entrega (entra_evm = true):
  entra no contas a pagar e no IPC, sem a regra da locação. Vale para linha do grupo 17 com entra_evm = true
  (supabase/custos/5-bandeja-17-1-10.sql).
- IPC = valor agregado do direto ÷ (realizado do direto + contas a pagar do direto por entrega, com NF e
  previsões). Acima de 1 = economia. Indireto e recorrentes ficam fora do a pagar.
- Projeção pessimista: IDP limitado a 1 (adiantamento não barateia a obra).
- IPC é MENSAL: avanço e custo até o último dia do mês + contas a pagar do fechamento daquele mês. Na
  semana de fechamento (a que termina no último dia do mês) a página semanal mostra o IPC do mês; nas semanas
  do meio, "IPC de <mês>" do último fechamento. A projeção usa esse IPC; avanço físico e IDP são semanais.

## Semanas alinhadas ao fechamento (decisão out/26, migração gravada em 06/10/2026)
- A semana termina no domingo OU no último dia do mês. Fragmento de 1 dia no início do mês junta com a
  semana seguinte; no fim do mês (mês que termina na segunda), com a anterior. S1–S13 ficaram como eram;
  de S14 (28–30/09/2026) em diante, regra nova. 96 semanas, fim em 27/02/2028.
- O código lê o calendário da tabela calendario_semanas (lib/calendario.js) e pesa os rateios por dias.
- Scripts em supabase/semanas/:
    0-diagnostico.sql            só leitura
    1-migrar-semanas.sql         JÁ RODADO em 06/10/2026 — NÃO RODE DE NOVO
    2-desfazer-semanas.sql       volta ao calendário antigo pelos backups *_bkp_20261006
    3-apagar-backups-orfaos.sql  NÃO RODE: os backups *_bkp_20261006 são o caminho de volta da migração
                                 gravada (ele recusa com 96 semanas, mas não dependa disso)
- Mantenha as tabelas *_bkp_20261006 no banco.

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
- parcela seguinte de uma NF sem decisão própria usa a decisão pontual da primeira parcela (2141/02 → 2141/01);
  NAO_CUSTO não é herdado (decisão out/26)
- eap = 'PEDIDO_ACO' → compra de aço dividida pelo pedido: a SC da OC (coluna "Nº SC FLUIG" do relatório
  de OC) é procurada em pedidos_aco.csv (sc, pedido, eap, proporcao em kg das pranchas). Título sem OC ou
  SC fora da planilha → pendência para você informar o pedido (decisão out/26)
- madeira de forma (Nova Esperança, Madeireira BH), sem pregos: proporção das VERBAS dos destinos (decisão
  out/26: "madeira usada também no bandejamento e na escada do 1º pav, redistribuída pela proporção das verbas").
  Já comprada (decisões pontuais 2067/01 a 2444/01; as parcelas /02 herdam): forma 2º ao 7º pav + bandeja
  primária 17.1.10 (R$ 13.029,00) + forma da escada 1º pav 3.1.5 (R$ 1.263,87), todos no mesmo % da verba; a
  parte da 2067/01 na 3.1.6 fica. Compra nova (regra '*' dos dois fornecedores): só destinos ainda não
  executados — forma 3º ao 7º pav, 2ª e 3ª bandejas (17.1.10, 2 × R$ 13.029,00) e escadas 3.2.5, 3.3.6, 3.4.6,
  3.5.5 (R$ 1.263,87 cada). Destino executado sai do rateio: refaça as proporções da regra.
- eap = 'ETAPA_NF:CAT' → como ETAPA:, mas o pavimento é o de etapa.csv na DATA DE EMISSÃO da nota, não na
  competência. Prego (CONTEM:PREGO) = FORMA_MATERIAL; arame (CONTEM:ARAME) = ACO_MATERIAL (decisão out/26)
- "Prev. Financ. OC 0001826 ...": o título abre pelos itens da OC do histórico (vínculo "ALTA (OC no histórico)")

## Pavimento do custo (decisão out/26)
Código de EAP repetido por pavimento (7.1.7 do 1º ao 6º, os serviços dos grupos 4 a 14) grava o pavimento,
como a medição; os códigos da EAP não mudam.
- O classificador escreve a coluna pavimento (lancamentos.csv e contas_a_pagar.csv): a de decisoes_pontuais.csv
  (coluna opcional pavimento, ex.: 2º) ou o pavimento em execução na DATA DA NOTA pelo etapa.csv (a etapa mais
  recente vigente; EAP 3.N.x → Nº).
- O importar.js grava o pavimento só em código repetido e só se o código tiver linha nesse pavimento ('6º' casa
  com '6º/Plat'). Sem pavimento válido fica vazio e o dashboard divide pela verba das linhas, como antes.
  A prévia mostra o valor por código + pavimento e o que ficou sem pavimento.
- Banco: supabase/custos/6-pavimento-do-custo.sql (coluna em contas_a_pagar; custos_lancamentos.pavimento
  passa a aceitar vazio).
- 7.1.7 (Loja Elétrica, fechamento 2026-09): 2º pav, a mesma linha da medição; a NF 13626 (25/09, já no 3º pela
  etapa) está no 2º por decisão pontual.

## Pedidos de aço (pedidos_aco.csv)
Uma linha por SC e EAP, com a proporção em kg das pranchas do pedido (planilha em projetos/Pedidos de Aço.xlsx):
2º pedido = SC 96165 (pranchas do 2º pav, pilares e laje forro), 3º = SC 98265 (3º pav → 3.3.8),
4º = SC 101014 (4º pav → 3.4.8). Pedido novo: acrescente as linhas da SC antes de rodar o classificador.

## Próximos passos (Claude Code)
1. Gravar lancamentos no Supabase (upsert por documento + fornecedor)
2. Tela de pendências no dashboard (confirmar rateio → vira regra)
3. Vigia de pasta + Agendador de Tarefas do Windows
