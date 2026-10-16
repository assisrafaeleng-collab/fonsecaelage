# Dashboard Flats BH

Next.js (deploy automático na Vercel a partir da `main`), banco Supabase. A automação de custos
fica em `automacao/` — leia `automacao/LEIAME.md` antes de mexer nela.

## Regras de fechamento do mês (custos)
1. Fonte oficial = relatório ACUMULADO do TOTVS (decisão de 14/10/26), salvo sempre com a data no nome, sem
   substituir o anterior (`automacao/entrada/TOTVS_acumulado_AAAA-MM-DD.xlsx`); o fechamento usa o mais recente.
   A data no nome é o dia em que o arquivo foi salvo; os pagamentos vão até a última Data de Baixa do arquivo
   ("data de corte", que as prévias sempre mostram). Carga parcial do mês é permitida: o resto entra pelo
   acumulado seguinte e o ref evita duplicidade (decisão de 16/10/26).
   Chave única = "Ref. Lançamento" (`custos_lancamentos.ref_totvs` + `ref_parte`; `contas_a_pagar.ref_totvs`;
   `supabase/custos/8-ref-totvs.sql` e `9-preencher-ref-totvs.sql`). Pago = Valor Baixado > 0; zerado com Data de
   Baixa = NF que quitou adiantamento (fora); zerado sem Data de Baixa = a pagar. Fechamento do mês M: só títulos
   PAGOS com baixa até o fim de M e ref ainda não gravado (ref já gravado = ignorado; o banco recusa ref repetido);
   baixa em mês já fechado entra em M com `baixa_retroativa` (não reabre mês). Título novo com mesmo fornecedor e
   valor de lançamento manual sem ref (salários do José Rodrigues e adiantamento Assis de julho, terreno) = possível
   duplicidade, não entra sem decisão. Conferência obrigatória ao centavo: total pago no arquivo até o fim de M =
   já importado + novos + NAO_CUSTO + pagos fora do dashboard (diferença conhecida só via `diferencas_ref.csv`).
   Fluxo: `importar.js --refs-do-banco` → `classificador.py <acumulado> oc --fechamento AAAA-MM --refs` →
   `importar.js --classificador` (prévia; acrescenta, não substitui) → `--confirmar`. Ver `automacao/LEIAME.md`.
2. Taxa ADM da Fonseca & Lage: a do mês M sempre entra no mês M+1 (a de agosto entra em setembro).
   Ela vem no relatório de custos do mês; o classificador a inclui mesmo sem marcação de pago.
   No máximo uma por mês: se a prévia avisar que veio mais de uma, ou nenhuma, confira antes de gravar.
   Taxa ainda não emitida (a de setembro, no fechamento de outubro): o fechamento segue sem ela, com aviso; ela
   entra no fechamento em que aparecer no acumulado, marcada com atraso (mês pelo histórico; decisão de 16/10/26).
3. Não são custo: "Prev. Financ.", APORTE e NF já paga por adiantamento (`NAO_CUSTO` em
   `decisoes_pontuais.csv`; pela coluna `ref_totvs` quando preenchida). Fatura 215 da Fonseca & Lage (ref 6699,
   R$ 43.953,27, baixa 12/06/26): NAO_CUSTO, desconsiderada pelo Rafael em 14/10/2026. Frete pago além do
   adiantamento é custo, na EAP do material da nota (SD Injetados 068581129/01, R$ 28,41 → 3.1.7, baixa retroativa);
   o que o adiantamento pagou a mais por frete fica como está (LCPlast 9902, R$ 78,99) (decisões de 16/10/26).
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
   Sai do mesmo acumulado do fechamento; título cujo ref já é custo realizado sai do a pagar.

## Indicadores (decisões out/26)
- Avanço físico, em todas as telas = horas executadas ÷ horas orçadas (parcela de produção). Nunca ponderado
  por valor. O dashboard mensal e a página semanal mostram o mesmo número (`lib/avanco-hh.js`).
- IPC / eficiência de custo direto (cards, linhas e projeção) = valor agregado do direto ÷ (custo direto
  realizado + contas a pagar do direto por entrega, com NF e "Prev. Financ."). Acima de 1 = economia.
  Indireto e recorrentes ficam fora do a pagar. O IPC é MENSAL: avanço e custo até o último dia do mês + a
  pagar daquele fechamento; na semana de fechamento a semanal mostra o do mês, nas do meio "IPC de <mês>".
- Semanas (migração de 06/10/26): a semana termina no domingo ou no último dia do mês; S1–S13 antigas, 96
  semanas. Calendário em `calendario_semanas` (`lib/calendario.js`), rateios por dias. Não rode de novo
  `supabase/semanas/1-migrar-semanas.sql` nem `3-apagar-backups-orfaos.sql`; mantenha as `*_bkp_20261006`.
- Projeção pessimista: IDP limitado a 1 (adiantamento não barateia a obra).
- Direto × indireto sempre pela EAP: grupo 19 = indireto, o resto = direto.
- Valor agregado do MATERIAL (linhas "Apenas Material" de aço e de material de forma, inclusive fundação;
  concreto usinado fica FORA e entra pela medição): agregado = o MAIOR entre (a) avanço do serviço × orçado
  (herança) e (b) custo da linha (pago + a pagar) limitado ao orçado. Linha executada mostra a economia real;
  material comprado antes da execução fica neutro; o que passar do orçado aparece no IPC.
- Bandeja (17.1.10, verba R$ 41.887,00): avanço por UNIDADE — são 3 bandejas; medição de 33,33% por bandeja
  pronta (a primária em 30/09/26; a 2ª e a 3ª entram como 66,67% e 100%, lançadas pelo usuário). Valor agregado
  = % medido × verba da linha. É compra POR ENTREGA (`entra_evm = true`): entra no contas a pagar e no IPC e NÃO
  usa a regra da locação (gasto limitado à verba). Vale para qualquer linha do grupo 17 com `entra_evm = true`
  (`lib/painel-semanal.js`; `supabase/custos/5-bandeja-17-1-10.sql`).

## Classificação de material (decisões out/26)
- Madeira de forma (Madeiras Nova Esperança, Madeireira BH), sem pregos: dividida pela PROPORÇÃO DAS VERBAS
  dos destinos, porque a madeira é usada também no bandejamento e nas escadas. Madeira já comprada até out/26
  (decisões pontuais 2067/01 a 2444/01): forma do 2º ao 7º pav (cada um pela sua verba), bandeja primária
  (17.1.10, verba R$ 13.029,00) e forma da escada do 1º pav (3.1.5, R$ 1.263,87) — todos no mesmo % da verba;
  a parte da 2067/01 na 3.1.6 (R$ 3.780,48) fica. Compra nova: só entre os destinos ainda não executados —
  forma do 3º ao 7º pav, 2ª e 3ª bandejas (17.1.10, 2 × R$ 13.029,00) e escadas 3.2.5, 3.3.6, 3.4.6, 3.5.5
  (R$ 1.263,87 cada) — na regra dos dois fornecedores em `regras_manuais.csv`. Quando um destino for
  executado, ele sai do rateio das compras novas.
- Parcelas seguintes de uma NF seguem a decisão pontual da primeira parcela (2141/02 usa a de 2141/01).
- Aço (Takono, Santa Mônica): compra dividida pelo pedido (SC da OC) e pelas pranchas, em kg, conforme
  `automacao/pedidos_aco.csv` (planilha de pedidos em `automacao/projetos`). Pedido fora da planilha ou
  título sem OC = pendência para o usuário informar.
- Prego = material de forma; arame = material de aço; os dois do pavimento em execução na DATA DA NOTA
  (`ETAPA_NF:` em `regras_manuais.csv`, pavimento por `etapa.csv`; 3º pav desde 22/09/26). "Prev. Financ."
  abre pelos itens da OC citada no histórico.

## Pontos de atenção (decisões de 13/10/26; cópia do painel do Sirius 60)
- Painel na página semanal, logo abaixo do Diário de ocorrências, recolhido. Lógica pura em `lib/pontos-atencao.js`
  (a tela usa as mesmas funções para recalcular ao editar), leitura em `lib/pontos-atencao-servidor.js` (reaproveita
  `calcularPainelSemanal`: % da linha, pago/a pagar por linha, herda_de, curva), rota `pages/api/pontos-atencao.js`
  (GET; POST com `DASHBOARD_SENHA` em `x-dashboard-senha`, confirmação dentro da página, sem alert/confirm/prompt).
  Tabelas: `supabase/planejamento/1-tabelas-pontos-atencao.sql` e `2-edicao-no-site.sql` (+ desfazer), RLS sem grant.
- REGRA DE OURO: não inventar índice, equipe, prazo, feriado ou jornada. Faltou → "dado pendente" (campo amarelo).
- Atividade = linha do orçamento (código + pavimento) com hh e entra_evm, grupos 1–16; 2.1.6 fora. "Hoje" = fim da
  semana do filtro; horizontes: próxima semana e próximos 30 dias. Cronograma = janela do banco (mes_inicio/mes_fim),
  linear pelos dias, a mesma do avanço.
- Índice = Hh do OFICIAL por unidade, o do cronograma (mesma base do avanço). Capacidade de 1 equipe = nº de oficiais
  × 8 h/dia. A CPU (horas do oficial) só aparece como referência. Armação 0,18 Hh/kg. Pendentes (o Rafael preenche no
  site): forma, lançamento, vergas, concreto usinado em diárias; equipes de concretagem e escada; durações (escadas,
  elevador, SPDA, alarme, GLP, bombas, cisterna, limpeza final); calha/rufo/condutor e grupo 16 sem tipo de equipe.
  Por duração: piso polido 1 dia, escada marinheiro 1 dia; infra hidráulica/elétrica 40 h por andar (como está).
- "Conferir" só nas divergências reais: cronograma × horas do oficial na CPU > 50% (metade da CPU é o padrão).
- Equipes padrão: 1 oficial + 1 ajudante por tipo (armação, forma, pedreiro p/ alvenaria-reboco-pisos, hidráulica,
  elétrica, gás/incêndio, impermeabilização, gesso, esquadrias, pintura, louças, urbanização). Equipes sugeridas =
  coluna "Equipes" do `Cronograma_FLAT_BH_Reorganizado.xlsx` (forma 2, 3 no 3º pav; alvenaria, chapisco, gesso,
  contrapiso, pintura 2; reboco externo e textura 3); sem ela, as necessárias para cima.
- Jornada 8 h/dia, seg–sex, sem sábado. Feriados: nacionais + Belo Horizonte a confirmar (Paixão, Corpus Christi,
  15/08, 08/12 — o Rafael confere no decreto da PBH); Carnaval não entra.
- Caixa do período = atividades (% a executar × orçado do serviço e dos materiais vinculados, menos o já pago/a pagar
  além do executado, na própria linha e nos materiais; concreto usinado conta como material; cabeamento 7.1.8/7.1.9
  entra com os pontos 7.1.2–7.1.4 do mesmo pavimento) + contas a pagar com vencimento (ou previsão) no período
  (vencido antes = pago) + recorrentes DIRETOS (17 sem a bandeja, 18, 1.1.6) e INDIRETOS (mes_desembolso = 0, inclusive
  a Taxa ADM 19.1.24) pelo planejado diluído + indiretos pontuais do período. Curva do cronograma em cinza.
  % a executar: com equipes, (equipes × oficiais × 8 h × dias úteis) ÷ horas por 1%, limitado ao que falta; equipe só
  sugerida → as necessárias com fração; sem índice/equipe → ritmo do cronograma + atraso diluído em 30 dias.
- 2.1.11, 2.1.12 e 15.1.1: aguardando a medição real — não contam como atraso até lá.
- Atividades adiantadas (14/10/26): as abas "Próxima semana" e "Próximos 30 dias" incluem também as EM ANDAMENTO
  (medição > 0% e < 100%) e as com JANELA PROJETADA no período. Janela projetada = planejada deslocada pelo
  adiantamento da FRENTE (grupo + pavimento) quando a frente tem 2 ou mais linhas medidas
  (`FRENTE_MIN_LINHAS_MEDIDAS`; uma linha só, como o eletroduto da laje, não representa a frente), senão pelo
  adiantamento da obra (card da semanal). Status: ATRASADA (realizado < planejado), ADIANTADA (realizado > planejado),
  A INICIAR, EM DIA; adiantada nunca é atrasada. ADIANTADA e A INICIAR usam o modo projeção no caixa, contando a partir
  do início projetado (em andamento: a partir de amanhã), nesta ordem: (1) equipes salvas; (2) ritmo real, só com 5 ou
  mais dias úteis entre o início e a última medição; (3) equipes necessárias para terminar no fim projetado; (4) janela
  projetada (ritmo dela + o que ficou para trás diluído em 30 dias). Atrasada e em dia seguem o cronograma. A tela
  mostra "projetado DD/MM → DD/MM (obra/pavimento ±N d)" e recalcula com a mesma função (`planoPeriodo`).
- Ciclo do pavimento na Estrutura (14/10/26; `aplicarCicloEstrutura`, a mesma função no servidor e na tela):
  a FORMA é o caminho crítico — dita o ritmo e o término do pavimento (equipes salvas ou ritmo histórico). A ARMAÇÃO
  acompanha a forma: mesmo % no período e mesmo término, sem histórico próprio; equipe sugerida = armadores necessários
  para acompanhar a forma (horas pelo índice do cronograma ÷ dias úteis do ciclo). A CONCRETAGEM (lançamento + concreto
  usinado) só depois de forma e armação: não se distribui — o % e o caixa caem inteiros no dia útil seguinte ao término
  da forma, no período em que essa data cair. O pavimento entra junto nas abas. Escada fora do ciclo.
- Produtividade histórica (14/10/26): em cada pavimento CONCLUÍDO, quantidade executada entre a 1ª e a última medição
  ((100% − % da 1ª) × quantidade) ÷ dias úteis entre elas (só com 5 ou mais); média dos pavimentos válidos (ritmo em
  un/dia, com as equipes que a obra usou em cada um). Serviço = grupo + descrição sem o sufixo " - Apenas MO/Material"
  + unidade. Índice exibido = oficiais × 8 h ÷ ritmo por equipe; ordem do índice: (a) editado no site; (b) histórico;
  (c) cronograma. A armação não usa histórico. A tela mostra "histórico (2º e 3º pav): X un/dia por equipe · Y Hh/un"
  e a CPU só como referência.
- Ordem do % a executar e do término (14/10/26): (a) equipes salvas pelo Rafael; (b) ritmo histórico do serviço com as
  equipes que a obra usou; (c) ritmo real da própria atividade (5+ dias úteis de medição); (d) equipes necessárias para
  terminar no fim projetado; (e) janela projetada (adiantada/a iniciar) ou cronograma + atraso diluído (atrasada/em dia).
- Compras: data projetada = início planejado − adiantamento da obra (mesma conta do card); pedir até = projetada −
  antecedência. Elevador: 12 meses (ainda não contratado; aparece vencido). Os outros itens: antecedência no site.

## Relatório gerencial em PDF por período (decisões de 16/10/26; mesmo do Sirius 60, adaptado)
- Botão "Gerar relatório" na semanal, ao lado de "Avanço físico" (`components/GerarRelatorio.jsx`, datas dd/mm/aaaa; padrão
  mês anterior; atalhos última semana, último mês, desde o início) → `/relatorio?de=&ate=` (`pages/relatorio.js`). "Baixar
  PDF" = impressão do navegador; A4 retrato com cabeçalho/rodapé "Flats Pampulha · período · página X de Y". Sem pacote novo.
- Mesmas contas do site: `/api/dashboard-semanal`, `/api/pontos-atencao`, `/api/contas-a-pagar`; `lib/relatorio.js` só
  organiza. Período → semanas do calendário (semana da data final); "no período" = fim da semana final − fim da semana
  anterior à inicial. Sem medição no período: cinza "sem medição desde DD/MM" e AMARELO "medição desatualizada".
- CONTAS A PAGAR DINÂMICO: cada semana do site e do relatório usa a carga do fechamento do próprio mês (a última carga
  até o mês do fim da semana), não a mais recente (`lib/painel-semanal.js`).
- Custo final = custo até a data (pago + a pagar) + o que falta do direto pelo orçado + indireto pelo orçamento ±
  custos fixos recorrentes da semana (`kpis.projecao.custo_calendario_semana`) × semanas que a obra está atrasada
  (soma) ou ADIANTADA no cronograma (desconta — decisão do Rafael, 16/10/26). Sem reserva separada neste orçamento.
  "Adiantada" aqui é PRAZO (card Adiantamento), nunca adiantamento a fornecedor.
- Dias de atraso da atividade = (previsto − feito) × dias da janela do cronograma. Próximos 30 dias pela janela
  projetada do painel Pontos de atenção. Faixas do semáforo escritas na página (rendimento 1,00/0,95; prazo 2 semanas;
  indireto e custo final 5%; atividade 7 dias).

## Ambiente
- Toda mudança na TELA (components/, pages/) é testada no NAVEGADOR antes do commit, não só por script: `npm run
  build && npm start`, abrir a página, clicar no que mudou e conferir que o console do navegador não tem erro
  (o c912981 quebrou a semanal em produção com "caixaAtividade is not defined" — import removido, que build e testes
  por script não pegam). Conferir também nomes usados e não importados nos arquivos alterados.
- Python é `py`, não `python`.
- Não leia `.env.local` nem `automacao/.env` (credenciais). Para consultar o banco, use as rotas GET do
  dashboard (`npx next dev`) ou o `importar.js` sem `--confirmar`.
- Regras, decisões, fechamentos, projetos e prévias são locais (estão no `.gitignore`); não commitar.
