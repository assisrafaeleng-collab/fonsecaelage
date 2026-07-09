# Handoff: Redesign visual do Dashboard de Obra (Flats Pampulha)

## Visão geral
Repaginação **puramente estética** do painel de controle de custo e avanço físico da obra
Flats Pampulha (Next.js + Supabase + Vercel). O objetivo do painel — detectar desvios de custo
e prazo no dia a dia e agir a tempo — foi reforçado com melhor hierarquia visual e sinais de
alerta mais claros. Lógica, cálculos (EVM, curva S), APIs e dados **não mudam**.

## Como usar este pacote (jeito automático)
1. Abra o repositório `fonsecaelage` no **VS Code** com a extensão do **Claude Code**.
2. Copie estes arquivos do pacote para dentro do projeto (ex.: numa pasta `design_handoff_dashboard/`).
3. Abra `MIGRAR.md`, copie o prompt e cole no chat do Claude Code — ele aplica as mudanças sozinho.
4. Alternativa rápida (manual, mas trivial): substitua **apenas** `styles/globals.css` pelo
   `globals.css` deste pacote. Já entrega a maior parte do novo visual sem tocar em JSX.

> Recomendado: `git checkout -b redesign-visual` antes, para reverter fácil.

## Sobre os arquivos de design
`referencia/Dashboard Obra.dc.html` é um **mockup HTML de referência** — mostra o visual e o
comportamento pretendidos, não é código de produção pra copiar direto. A tarefa é **recriar esse
visual no código React existente** do projeto, usando seus padrões atuais (componentes, Chart.js).
`referencia-escuro.png` é o screenshot do resultado no tema escuro.

## Fidelidade
**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamentos e estados finais estão definidos.
Observação: os NÚMEROS do mockup são um cenário de exemplo (mês 10 de 20, obra atrasada e acima
do custo) só para demonstrar os alertas — no app real os valores continuam vindo das APIs/Supabase.

## Tela: Dashboard Integrado (Visão Geral)
- **Layout**: container centralizado, `max-width: 1240px` (era 960px), padding 28px 32px.
- **Cabeçalho**: endereço (eyebrow em mono maiúsculo), nome da obra (30px, peso 600), linha de
  meta (orçamento · prazo · período) em mono; à direita, seletor de período e (no mockup) um
  toggle de tema — no app real o tema é escuro fixo, o toggle é só demonstração.
- **Nav**: abas com sublinhado no ativo (cor de acento), sem "pílulas".
- **Faixa de alerta** (nova): resume desvios que exigem ação; borda-esquerda vermelha; pills de status.
- **Hero de orçamento**: Custo Direto + Indireto = Total lado a lado; à direita, Projeção de Custo Final.
- **Grid de KPIs**: cards `minmax(212px, 1fr)`, sem borda-esquerda colorida; status pela cor do valor.
- **Curva S**: linhas planejado (tracejado) × realizado (sólido), preenchimento suave, ponto no mês atual, eixo duplo.
- **EVM**: BCWS/BCWP/ACWP + índices CPI/SPI/CV/SV/EAC em cards secundários (`--bg3`), topo colorido por status.
- **Heatmap por pavimento** + **comparativo físico por atividade** (planejado × realizado).

## Design tokens
Tipografia:
- Texto: `IBM Plex Sans` (400/500/600/700)
- Números e rótulos: `IBM Plex Mono` (400/500/600)

Cores (tema escuro):
- Fundo `--bg #131316` · Painel `--bg2 #1b1b20` · Painel 2 `--bg3 #232329`
- Texto `--text #eeeef2` · secundário `--text2 #9a9aa6` · terciário `--text3 #63636e`
- Bordas `--border rgba(255,255,255,.09)` · `--border2 rgba(255,255,255,.14)`
- Acento `--accent #e0a93b` (âmbar; alt.: `#4a8fe0` azul, `#3f9e6c` verde)
- Verde `#3f9e6c` · Vermelho `#d6453c` · Azul `#4a8fe0` · Âmbar `#c9891f`

Raio: `--radius 12px` · `--radius-lg 16px`. Sombra: nenhuma (definição por borda).

Cores das linhas do gráfico:
- Financeiro planejado `#9a8a5f` (tracejado) · Financeiro realizado `#e0a93b`
- Físico planejado `#6f86c9` (tracejado) · Físico realizado `#4a8fe0`

## Arquivos do projeto afetados
- `styles/globals.css` — substituição total (fornecido).
- `components/Dashboard.jsx` — remover emojis; cores do Chart.js; limpar inline `borderLeftColor`/`color`.
- `components/ImpactoAtraso.jsx`, `components/PaineisAnalise.jsx` — remover emojis; trocar hex antigos pelos novos.
- `pages/index.js` — remover emojis da nav e do modal; cores do modal; (opcional) faixa de alerta.
- Sem alterações em `pages/api/*`, `lib/*`, `supabase/*`.

## Mapa de substituição de cores (hex antigo → novo)
- `#C8860A` → `#e0a93b`  (âmbar/acento)
- `#E91E8C` → `#e0a93b`  (financeiro realizado)
- `#5B9BD5` → `#6f86c9`  (físico planejado)
- `#9B59B6` → `#4a8fe0`  (físico realizado)
- `#4D9B6A` → `#3f9e6c`  (verde/sucesso)
- `#B03030` → `#d6453c`  (vermelho/alerta)
- `#E8E8E8` → `#eeeef2`  · `#A8A8A8` → `#9a9aa6`  (textos do gráfico)
- `#ece9e4` → `#eeeef2`  (valores de KPI)

## Arquivos neste pacote
- `MIGRAR.md` — prompt pronto pro Claude Code.
- `GUIA-BRANCH.md` — passo a passo de Git/Vercel (criar branch, testar, publicar, reverter).
- `globals.css` — CSS novo (drop-in), já com `.alert-strip` e `.hero`.
- `REACT_SNIPPETS.jsx` — trechos React prontos: faixa de alerta + hero reorganizado.
- `referencia/Dashboard Obra.dc.html` — mockup de referência (abre no navegador).
- `referencia-escuro.png` — screenshot do resultado.
