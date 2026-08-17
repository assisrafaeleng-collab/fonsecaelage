# GUIA DE BRANCH — passo a passo (Git + Vercel)

Objetivo: aplicar o redesign numa **branch separada**, testar, e só depois juntar na
`main` (que é o que publica na Vercel). Assim o site no ar não corre risco.

> Você roda estes comandos no **terminal do VS Code** (menu Terminal → New Terminal),
> dentro da pasta do projeto `fonsecaelage`.

## 1. Garantir que está tudo salvo e atualizado
```bash
git status                 # veja se há mudanças pendentes
git checkout main
git pull                   # traz a versão mais recente do GitHub
```

## 2. Criar a branch do redesign
```bash
git checkout -b redesign-visual
```
Isso cria e já entra na branch `redesign-visual`. Tudo que você fizer agora fica isolado aqui.

## 3. Aplicar as mudanças
- Copie a pasta `design_handoff_dashboard/` para dentro do projeto (se ainda não estiver).
- Abra o `MIGRAR.md`, cole o prompt no chat do **Claude Code** e deixe ele editar os arquivos.
  (Ou, no mínimo, substitua `styles/globals.css` pelo `globals.css` do pacote.)
- Para a faixa de alerta e o hero, use os trechos de `REACT_SNIPPETS.jsx`.

## 4. Testar localmente
```bash
npm install                # só na primeira vez / se pedir
npm run dev
```
Abra http://localhost:3000 e confira o visual. Veja também o console do navegador (F12) — não deve haver erros.

## 5. Salvar as mudanças (commit)
```bash
git add .
git commit -m "Redesign visual do dashboard (tema escuro refinado)"
```

## 6. Enviar a branch pro GitHub
```bash
git push -u origin redesign-visual
```
A Vercel cria automaticamente um **Preview Deploy** dessa branch (uma URL de teste separada da
oficial). Você recebe o link no painel da Vercel / no Pull Request — ótimo pra revisar antes de publicar.

## 7. Publicar (quando aprovar)
No GitHub, abra um **Pull Request** de `redesign-visual` → `main` e clique em **Merge**.
Assim que a `main` é atualizada, a Vercel publica no site oficial automaticamente.

Ou, direto pelo terminal:
```bash
git checkout main
git merge redesign-visual
git push
```

## Se quiser DESFAZER
- Ainda na branch, sem ter feito merge? Basta voltar pra main e ela continua intacta:
  ```bash
  git checkout main
  ```
- Quer apagar a branch de teste:
  ```bash
  git branch -D redesign-visual
  ```
- Já fez merge e quer reverter o último merge na main:
  ```bash
  git revert -m 1 HEAD
  git push
  ```

## Dúvidas comuns
- **"Não sei se tenho o Git configurado"** → rode `git --version`. Se não aparecer versão,
  instale em https://git-scm.com.
- **"Pediu usuário/senha ao dar push"** → use um token do GitHub (Settings → Developer settings →
  Personal access tokens) ou faça login pelo GitHub Desktop.
- **"Prefiro sem terminal"** → o **GitHub Desktop** (app gráfico) faz criar branch, commit, push e
  PR por botões. Mesmos passos, sem digitar comandos.
