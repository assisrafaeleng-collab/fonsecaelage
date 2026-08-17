# MIGRAR.md — Cole isto no Claude Code (VS Code)

Este arquivo é um **prompt pronto**. Abra o seu projeto `fonsecaelage` no VS Code com a
extensão do Claude Code, cole TODO o conteúdo abaixo (da linha `---` em diante) no chat
e mande executar. Ele aplica o novo visual sozinho.

> Antes de começar: faça um commit ou crie uma branch (`git checkout -b redesign-visual`)
> para poder reverter com segurança.

---

Você é um assistente editando o repositório **fonsecaelage** (Next.js + Supabase).
Sua tarefa é aplicar um **redesign puramente visual** do dashboard, sem mudar lógica,
cálculos, chamadas de API nem nomes de dados. Use o arquivo de referência
`design_handoff_dashboard/referencia/Dashboard Obra.dc.html` (um mockup HTML) como
FONTE DA VERDADE do visual pretendido. Não copie o HTML direto — recrie o visual no código
React existente.

Direção visual (resumo): tema escuro refinado, tipografia técnica (IBM Plex Sans + IBM Plex Mono),
layout mais largo, cards limpos sem a "borda-esquerda colorida", ZERO emojis nos títulos, e
sinais de desvio (vermelho/verde) bem destacados.

## Passo 1 — Substituir o CSS (faz ~80% do trabalho)
Substitua TODO o conteúdo de `styles/globals.css` pelo conteúdo do arquivo
`design_handoff_dashboard/globals.css` deste pacote. Ele mantém todos os nomes de classe
existentes, então nada quebra — só muda cores, fontes, espaçamento, largura e cantos.

## Passo 2 — Remover emojis dos títulos e rótulos
Em `components/Dashboard.jsx`, `components/ImpactoAtraso.jsx`, `components/PaineisAnalise.jsx`
e `pages/index.js`, remova os emojis do INÍCIO de títulos/labels de UI, mantendo o texto:
- `📊 Avanço Físico...` → `Avanço Físico...`
- `📐 Análise EVM — Valor Agregado` → `Análise EVM — Valor Agregado`
- `📊 Curva S — ...` → `Curva S — ...`
- `🏢 Mapa de Avanço por Pavimento` → `Mapa de Avanço por Pavimento`
- `💰 Projeção Financeira e Prazo` → `Projeção Financeira e Prazo`
- `💰 Lançamentos de Custos` / `📊 Dashboard` (nav em `pages/index.js`) → sem emoji
- `🔒 Área Restrita` (modal) → `Área Restrita`
Mantenha os ✅ / ⚠️ que servem de indicador de status SE quiser, mas o preferível é trocá-los
por texto ("Adiantado" / "Atrasado", "Economia" / "Acima") — o CSS já colore via classes.
O marcador redondo colorido antes de cada `card-title` agora vem do próprio CSS (`::before`).

## Passo 3 — Ajustar as cores dos gráficos (Chart.js)
Em `components/Dashboard.jsx`, dentro de `chartData.datasets`, troque as cores das linhas:
- "Financeiro Planejado": `borderColor` de `#C8860A` → `#9a8a5f` (mantém tracejado `borderDash`)
- "Financeiro Realizado": `borderColor` de `#E91E8C` → `#e0a93b`; `backgroundColor` → `rgba(224,169,59,0.12)`; `pointBackgroundColor` → `#e0a93b`
- "Físico Planejado": `borderColor` de `#5B9BD5` → `#6f86c9` (mantém tracejado)
- "Físico Realizado": `borderColor` de `#9B59B6` → `#4a8fe0`; `pointBackgroundColor` → `#4a8fe0`
Em `chartOptions`, troque as cores de UI do gráfico para a nova paleta:
- Textos de legenda/ticks/títulos: de `#E8E8E8` / `#A8A8A8` → `#9a9aa6`
- Linhas de grade: `rgba(255, 255, 255, 0.05)` → `rgba(255,255,255,0.06)`
- Fundo do tooltip: `rgba(26, 26, 26, 0.95)` → `rgba(20,20,24,0.96)`; borda → `rgba(255,255,255,0.14)`
Faça a mesma troca de cores nas barras de `ComparativoFisico` e nos componentes de análise:
`#5B9BD5`→`#6f86c9`, `#4D9B6A`→`#3f9e6c`, `#9B59B6`→`#4a8fe0`, `#B03030`→`#d6453c`, `#C8860A`→`#e0a93b`.

## Passo 4 — Limpar estilos inline que conflitam com o novo CSS
Nos cards KPI de `components/Dashboard.jsx`:
- Remova as props inline `borderLeftColor: '#...'` dos elementos `.kpi` (o novo visual não usa
  borda-esquerda colorida). Onde a cor indicava status (verde/vermelho), em vez da borda,
  aplique a cor NO TEXTO do valor (ex.: `color: saldo >= 0 ? '#3f9e6c' : '#d6453c'`).
- Remova `color: '#ece9e4'` fixo dos valores (deixe o CSS `.kpi-value` cuidar) ou troque por `#eeeef2`.
- Substitua qualquer `#4D9B6A`→`#3f9e6c` e `#B03030`→`#d6453c` que apareça inline.

## Passo 5 — Modal de senha (`pages/index.js`)
- Fundo do modal `#1E1E1E` → `#1b1b20`; borda `#2A2A2A` → `rgba(255,255,255,0.14)`.
- Input fundo `#141414` → `#131316`.
- Botão "Entrar": `background: '#C8860A'` → `'#e0a93b'`, `color: 'white'` → `'#131316'`.
- Textos `#E8E8E8`→`#eeeef2`, `#A8A8A8`→`#9a9aa6`.

## Passo 6 (recomendado) — Faixa de alerta e hero reorganizado
Use os trechos PRONTOS em `design_handoff_dashboard/REACT_SNIPPETS.jsx` (o CSS
`.alert-strip` e `.hero` já vem no `globals.css` deste pacote):
- **Faixa de alerta**: cole o trecho (1) como PRIMEIRO filho do `<div>` raiz retornado por
  `Dashboard()` (antes do primeiro `<div className="kpi-grid">`). Ele calcula os desvios a
  partir das variáveis que já existem no componente (`avancoFisicoReal`, `avancoFisicoPlano`,
  `saldoCustoDireto`, `projecaoCustoFinal`, `kpis.desvio_prazo_dias`) — sem números fixos.
- **Hero de orçamento**: substitua o primeiro `<div className="kpi-grid">…</div>` (card
  "Custo Total da Obra Planejado") pelo trecho (2) — Direto + Indireto = Total lado a lado e
  Projeção de Custo Final à direita.

## Regras
- NÃO altere `pages/api/*`, `lib/*`, `supabase/*` nem qualquer cálculo (EVM, curva S, projeções).
- NÃO invente números — todos os valores continuam vindo das APIs/estado.
- Preserve todos os nomes de classe CSS existentes.
- Ao terminar, rode `npm run dev` e confirme que o dashboard carrega sem erros de console.

Quando terminar, liste os arquivos alterados e um resumo curto do que mudou em cada um.
