# Dashboard de Obra — Guia de configuração

Dashboard dinâmico para controle físico e financeiro de obra predial.
Desenvolvido com Next.js + Supabase + Vercel.

---

## Pré-requisitos

- Conta no GitHub (gratuito) → https://github.com
- Conta no Supabase (gratuito) → https://supabase.com
- Conta no Vercel (gratuito) → https://vercel.com
- Node.js 18+ instalado no seu computador (para testar localmente)

---

## Passo 1 — Criar o banco de dados no Supabase

1. Acesse https://supabase.com e faça login
2. Clique em **New project**, dê um nome (ex: "obra-dashboard") e escolha uma senha
3. Aguarde o projeto ser criado (~1 min)
4. No menu lateral, clique em **SQL Editor**
5. Cole todo o conteúdo do arquivo `supabase/schema.sql` e clique em **Run**
6. Isso criará a tabela e inserirá os dados de exemplo

---

## Passo 2 — Pegar as credenciais do Supabase

1. No menu lateral do Supabase, clique em **Project Settings** → **API**
2. Copie os valores de:
   - **Project URL** → será o `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → será o `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Passo 3 — Subir o projeto no GitHub

1. Crie um repositório novo no GitHub (pode ser privado)
2. Faça upload de todos os arquivos desta pasta para o repositório
   - Você pode arrastar os arquivos pela interface web do GitHub
   - Ou usar o Git via terminal:
     ```bash
     git init
     git add .
     git commit -m "Primeiro commit"
     git remote add origin https://github.com/SEU_USUARIO/obra-dashboard.git
     git push -u origin main
     ```

---

## Passo 4 — Publicar no Vercel

1. Acesse https://vercel.com e faça login com sua conta GitHub
2. Clique em **Add New Project**
3. Selecione o repositório `obra-dashboard`
4. Antes de clicar em Deploy, expanda **Environment Variables** e adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` → cole a URL do Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → cole a chave anon
5. Clique em **Deploy**
6. Em ~2 minutos o site estará no ar com uma URL como `obra-dashboard.vercel.app`

---

## Passo 5 — Usar o dashboard

- **Dashboard**: selecione o período no menu suspenso para ver os indicadores
- **Lançar atualização**: preencha os dados da semana e salve
- **Histórico**: consulte todos os períodos anteriores

---

## Teste local (opcional)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# 3. Rodar em desenvolvimento
npm run dev

# 4. Abra http://localhost:3000
```

---

## Personalizar para sua obra

| O que mudar                  | Onde mudar                            |
|------------------------------|---------------------------------------|
| Nome da obra                 | `pages/index.js` → linhas da header   |
| Orçamento e prazo            | `pages/index.js` + formulário         |
| Disciplinas / serviços       | `lib/constants.js` → array DISCIPLINAS|
| Curva planejada (baseline)   | `lib/constants.js` → CURVA_PLANEJADA  |
| Cores e estilos              | `styles/globals.css`                  |

---

## Estrutura do projeto

```
obra-dashboard/
├── pages/
│   ├── index.js              ← Página principal (3 abas)
│   └── api/updates/
│       ├── index.js          ← GET lista / POST nova atualização
│       └── [id].js           ← DELETE por ID
├── components/
│   ├── Dashboard.jsx         ← Curva S + KPIs + tabelas
│   ├── UpdateForm.jsx        ← Formulário de lançamento
│   └── History.jsx           ← Histórico com exclusão
├── lib/
│   ├── supabase.js           ← Cliente Supabase
│   └── constants.js          ← Disciplinas e curva planejada
├── styles/globals.css        ← Todo o CSS
├── supabase/schema.sql       ← Script do banco de dados
├── .env.example              ← Modelo das variáveis de ambiente
└── package.json
```
