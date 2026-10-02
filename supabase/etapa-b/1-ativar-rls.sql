-- =====================================================================
-- ETAPA B — PASSO 1: ATIVAR RLS E FECHAR O ACESSO PÚBLICO
-- Rode o arquivo INTEIRO de uma vez no SQL Editor (Run).
-- Tudo roda numa transação: se qualquer comando falhar, NADA é aplicado.
--
-- O que faz:
--   0. Guarda uma cópia do estado atual (políticas, RLS, opções das views)
--      no schema "seguranca_bkp", que a API não expõe. O desfazer usa essa cópia.
--   1. Ativa o RLS em TODAS as tabelas do schema public (inclusive backups).
--   2. Remove as políticas que valem para public, anon ou authenticated.
--   3. Faz as views respeitarem o RLS (security_invoker = on).
--
-- O servidor do dashboard usa a chave secreta (papel service_role), que
-- IGNORA o RLS — por isso o site continua funcionando sem nenhuma política.
--
-- Rodar duas vezes dá erro no passo 0 ("already exists") e nada muda: isso é
-- de propósito, para não sobrescrever a cópia do estado original.
-- =====================================================================

begin;

-- 0. Cópia do estado atual -------------------------------------------
create schema seguranca_bkp;
revoke all on schema seguranca_bkp from public, anon, authenticated;

create table seguranca_bkp.politicas_20261002 as
  select p.*, now() as salvo_em
  from pg_policies p
  where p.schemaname = 'public';

create table seguranca_bkp.rls_20261002 as
  select c.relname as tabela, c.relrowsecurity as rls_ativo, c.relforcerowsecurity as rls_forcado
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p');

create table seguranca_bkp.views_20261002 as
  select c.relname as view, c.reloptions
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v';

-- 1. RLS em todas as tabelas -----------------------------------------
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;

-- 2. Remove políticas de public / anon / authenticated ----------------
--    (authenticated entra porque, com o cadastro do Supabase Auth ligado,
--     qualquer pessoa pode criar uma conta e virar "authenticated".)
do $$
declare p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and roles && array['public', 'anon', 'authenticated']::name[]
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- 3. Views respeitam o RLS de quem consulta ---------------------------
do $$
declare v record;
begin
  for v in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
  loop
    execute format('alter view public.%I set (security_invoker = on)', v.relname);
  end loop;
end $$;

commit;

-- Conferência (resultado esperado: rls_ativo = true e politicas_restantes = 0 em todas)
select
  c.relname as tabela,
  c.relrowsecurity as rls_ativo,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
      and p.roles && array['public', 'anon', 'authenticated']::name[]) as politicas_restantes
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by 1;
