-- =====================================================================
-- CUSTOS — PASSO 8: chave única do TOTVS (Ref. Lançamento) — decisão de 14/10/2026
--
-- O "Ref. Lançamento" do relatório acumulado do TOTVS é único por título/parcela. Ele passa a ser
-- guardado em cada lançamento para nunca importar o mesmo título duas vezes:
--   custos_lancamentos: ref_totvs (Ref. Lançamento), ref_parte (1, 2, 3... quando o título é aberto
--     em várias linhas por EAP ou por item da OC), data_baixa (Data de Baixa do TOTVS) e
--     baixa_retroativa (título pago em mês já fechado que entrou no fechamento seguinte).
--   contas_a_pagar: ref_totvs.
--
-- Índice único: um título aberto em várias linhas grava o mesmo ref em todas (partes 1..n), por isso
-- a chave é (obra_id, ref_totvs, ref_parte). Toda carga de um título traz a parte 1: se o ref já
-- estiver no banco, a parte 1 colide e o banco RECUSA a carga inteira.
-- No contas a pagar o mesmo título se repete de propósito em cada foto (fechamento), então a chave
-- é por carga: (carga_id, ref_totvs, seq).
--
-- Cada bloco abaixo funciona sozinho no editor do Supabase (sem tabela temporária entre execuções).
-- Rode na ordem: 1 (backup), 2 (estrutura), 3 (conferência). Não altera nem apaga nenhuma linha:
-- as colunas novas começam vazias. O preenchimento dos lançamentos já gravados é o passo 9.
-- Desfazer: 8-ref-totvs-desfazer.sql.
-- =====================================================================


-- ── 1. BACKUP (antes de qualquer mudança) ────────────────────────────
create table public.custos_lancamentos_bkp_20261014 as select * from public.custos_lancamentos;
create table public.contas_a_pagar_bkp_20261014 as select * from public.contas_a_pagar;
alter table public.custos_lancamentos_bkp_20261014 enable row level security;
alter table public.contas_a_pagar_bkp_20261014 enable row level security;


-- ── 2. ESTRUTURA ─────────────────────────────────────────────────────
begin;

alter table public.custos_lancamentos
  add column ref_totvs        bigint,
  add column ref_parte        smallint,
  add column data_baixa       date,
  add column baixa_retroativa boolean not null default false,
  add constraint custos_lancamentos_ref_parte_ck
    check ((ref_totvs is null and ref_parte is null) or (ref_totvs is not null and ref_parte >= 1));

create unique index custos_lancamentos_ref_totvs_uq
  on public.custos_lancamentos (obra_id, ref_totvs, ref_parte)
  where ref_totvs is not null;

alter table public.contas_a_pagar
  add column ref_totvs bigint;

create unique index contas_a_pagar_ref_totvs_uq
  on public.contas_a_pagar (carga_id, ref_totvs, seq)
  where ref_totvs is not null;

commit;


-- ── 3. CONFERÊNCIA (só leitura) ──────────────────────────────────────
-- Deve listar 4 colunas em custos_lancamentos e 1 em contas_a_pagar, os 2 índices e os 2 backups
-- com o mesmo número de linhas das tabelas (custos: 433 em 14/10/2026).
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'custos_lancamentos' and column_name in ('ref_totvs', 'ref_parte', 'data_baixa', 'baixa_retroativa'))
     or (table_name = 'contas_a_pagar' and column_name = 'ref_totvs'))
 order by 1, 2;

select indexname, indexdef from pg_indexes
 where schemaname = 'public' and indexname in ('custos_lancamentos_ref_totvs_uq', 'contas_a_pagar_ref_totvs_uq');

select 'custos_lancamentos' as tabela, (select count(*) from public.custos_lancamentos) as linhas,
       (select count(*) from public.custos_lancamentos_bkp_20261014) as backup
union all
select 'contas_a_pagar', (select count(*) from public.contas_a_pagar),
       (select count(*) from public.contas_a_pagar_bkp_20261014);
