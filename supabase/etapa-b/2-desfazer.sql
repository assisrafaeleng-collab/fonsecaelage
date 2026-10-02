-- =====================================================================
-- ETAPA B — DESFAZER: volta exatamente ao estado de antes do passo 1
-- Usa a cópia guardada em seguranca_bkp pelo passo 1.
-- Rode o arquivo INTEIRO de uma vez. Roda numa transação.
--
--   1. Recria cada política removida, com o mesmo nome, comando, papéis
--      e regras (using / with check).
--   2. Volta o RLS de cada tabela para o estado anterior (ativo ou não).
--   3. Volta as opções originais de cada view.
--
-- Tabelas ou views criadas DEPOIS do passo 1 não são tocadas.
-- O schema seguranca_bkp é mantido (pode apagar depois com:
--   drop schema seguranca_bkp cascade;  ).
-- =====================================================================

begin;

-- 1. Recria as políticas --------------------------------------------
do $$
declare p record;
begin
  for p in select * from seguranca_bkp.politicas_20261002 loop
    if to_regclass(format('public.%I', p.tablename)) is null then
      raise notice 'tabela % não existe mais — política % ignorada', p.tablename, p.policyname;
      continue;
    end if;
    if exists (select 1 from pg_policies q
               where q.schemaname = 'public' and q.tablename = p.tablename
                 and q.policyname = p.policyname) then
      continue;  -- já existe (não foi removida)
    end if;
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      p.policyname, p.tablename, p.permissive, p.cmd,
      (select string_agg(quote_ident(r::text), ', ') from unnest(p.roles) r),
      case when p.qual       is not null then ' using (' || p.qual || ')' else '' end,
      case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end);
  end loop;
end $$;

-- 2. Estado anterior do RLS -----------------------------------------
do $$
declare t record;
begin
  for t in select * from seguranca_bkp.rls_20261002 loop
    if to_regclass(format('public.%I', t.tabela)) is null then continue; end if;
    if not t.rls_ativo then
      execute format('alter table public.%I disable row level security', t.tabela);
    end if;
  end loop;
end $$;

-- 3. Opções originais das views -------------------------------------
do $$
declare v record;
begin
  for v in select * from seguranca_bkp.views_20261002 loop
    if to_regclass(format('public.%I', v.view)) is null then continue; end if;
    execute format('alter view public.%I reset (security_invoker)', v.view);
    if v.reloptions is not null then
      execute format('alter view public.%I set (%s)', v.view, array_to_string(v.reloptions, ', '));
    end if;
  end loop;
end $$;

commit;

-- Conferência: compare com o resultado [B] do inventário
select tablename as tabela, policyname as politica, cmd as comando, roles as papeis
from pg_policies where schemaname = 'public' order by 1, 2;
