# Prompt para colar no Claude Code (abrir em C:\Users\Rafa\fonsecaelage)

Contexto: este repositório é o dashboard da obra Flats BH (Next.js, deploy automático na Vercel a partir da
branch main, banco Supabase do projeto nvzmiqtciyxxvzzysazm — URL no .env.local).
Na pasta `automacao/` está um classificador em Python que lê o relatório de custos do TOTVS, vincula às
Ordens de Compra, classifica cada título por EAP e gera `lancamentos.csv` e `pendencias.csv`.
Leia `automacao/LEIAME.md` antes de começar. Não altere a lógica de classificação sem me perguntar.

Quero automatizar a carga desses lançamentos no dashboard. Faça em etapas, me mostrando o plano de cada uma
e esperando meu OK antes de gravar qualquer coisa no banco.

## Etapa 1 — Entender o que existe (não grave nada)
- Liste as tabelas do Supabase que o dashboard usa hoje para custo realizado e orçamento, e como as páginas
  calculam Orçado × Realizado.
- Compare com as colunas de `lancamentos.csv` e `orcamento.csv` e me proponha: usar as tabelas atuais
  ou criar novas (sugestão: `orcamento`, `lancamentos`, `pendencias`, `importacoes`).
- Verifique se jul/ago/2026 já estão lançados manualmente no banco, para não duplicar.

## Etapa 2 — Gravação no Supabase
- Script `automacao/subir.py` que lê `lancamentos.csv` e faz UPSERT (chave: cnpj + documento + item + eap),
  registrando em `importacoes` o arquivo de origem, data, total e quantidade de linhas.
- Antes de gravar, conferir que a soma bate com o total do TOTVS (o classificador já valida) e mostrar um
  resumo do que vai entrar/alterar (modo --simular por padrão; gravar só com --gravar).
- Usar a service role key em `automacao/.env` (NUNCA commitar; incluir no .gitignore).
- Permitir desfazer uma importação (apagar pelo id da importação).

## Etapa 3 — Tela de pendências no dashboard
- Página /pendencias listando pendencias.csv (já gravadas no banco) e os lançamentos com alerta.
- Para cada uma: escolher a EAP (lista do orçamento) ou dividir em percentuais; opção "virar regra".
- A decisão grava no banco; o classificador passa a ler as decisões de lá (decisoes_pontuais / regras_manuais).

## Etapa 4 — Vigia de pasta
- Pastas: automacao/entrada (TOTVS), automacao/oc (relatórios OC_AAAA-MM.xls), automacao/medicoes (BMs),
  automacao/processados, automacao/erros.
- Ao cair arquivo novo em entrada/: classificar → subir → mover para processados/ (ou erros/ com o motivo).
- Script .bat + tarefa no Agendador de Tarefas do Windows para iniciar com o computador.

## Etapa 5 — Leitor de boletim de medição (quando eu tiver o BM em Excel com coluna EAP)
- Ler o BM, casar com a NF da Bernardes pelo valor líquido e ratear pelos itens (retenção proporcional).
