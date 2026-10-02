-- =====================================================================
-- CUSTOS — PASSO 1: registro de importações (rode o arquivo inteiro)
--
-- Cria:
--   * tabela importacoes: cada carga do classificador vira uma linha, com
--     arquivo, competência, totais e uma CÓPIA das linhas que ela substituiu
--     (coluna substituidos) — é isso que permite desfazer uma carga.
--   * em custos_lancamentos: colunas importacao_id (de qual carga veio a
--     linha) e cnpj (raiz do CNPJ ou CPF do fornecedor, vinda do TOTVS).
--
-- Não altera nem apaga nenhuma linha existente. As colunas novas começam
-- vazias nas 321 linhas atuais.
-- Segurança: RLS ativo na tabela nova, sem políticas (como na Etapa B) —
-- só o servidor/scripts com a chave secreta enxergam.
-- =====================================================================

begin;

create table public.importacoes (
  id                  uuid primary key default gen_random_uuid(),
  obra_id             text not null,
  competencia         text not null,              -- AAAA-MM
  origem              text not null,              -- 'classificador'
  arquivo             text,                       -- nome do lancamentos.csv / TOTVS de origem
  linhas              integer not null,
  total               numeric(14,2) not null,
  linhas_substituidas integer not null default 0,
  total_substituido   numeric(14,2) not null default 0,
  substituidos        jsonb,                      -- cópia das linhas que saíram (para desfazer)
  status              text not null default 'gravando',  -- gravando | ok | desfeita
  criado_em           timestamptz not null default now(),
  desfeita_em         timestamptz,
  observacao          text
);

alter table public.importacoes enable row level security;

alter table public.custos_lancamentos
  add column importacao_id uuid references public.importacoes(id),
  add column cnpj text;

create index custos_lancamentos_importacao_idx on public.custos_lancamentos (importacao_id);

commit;

-- Conferência: deve mostrar a tabela com rls_ativo = true e as 2 colunas novas
select relname as tabela, relrowsecurity as rls_ativo
from pg_class where relname = 'importacoes' and relnamespace = 'public'::regnamespace;

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'custos_lancamentos'
  and column_name in ('importacao_id', 'cnpj');

-- ---------------------------------------------------------------------
-- DESFAZER este passo (só se ainda não houver nenhuma carga gravada):
--   begin;
--   alter table public.custos_lancamentos drop column importacao_id, drop column cnpj;
--   drop table public.importacoes;
--   commit;
-- ---------------------------------------------------------------------
