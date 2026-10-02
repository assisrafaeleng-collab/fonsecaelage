-- =====================================================================
-- ETAPA B — PASSO 0: INVENTÁRIO (SOMENTE LEITURA — não altera nada)
-- Rode no SQL Editor do Supabase. Mostra 3 resultados; o SQL Editor
-- exibe só o último, então rode UM BLOCO DE CADA VEZ (selecione o bloco
-- e clique em Run).
-- =====================================================================

-- [A] Versão do Postgres (security_invoker exige 15 ou mais)
select current_setting('server_version') as versao_postgres;


-- [B] Tabelas e políticas atuais.
--     "sera_removida" = sim  -> a Etapa B apaga essa política.
--     "sql_para_recriar"     -> guarde este texto; é a cópia em papel da política.
select
  c.relname                                   as tabela,
  c.relrowsecurity                            as rls_ativo,
  coalesce(p.policyname, '(nenhuma política)') as politica,
  p.cmd                                       as comando,
  p.roles                                     as papeis,
  case when p.policyname is null then null
       when p.roles && array['public','anon','authenticated']::name[] then 'sim'
       else 'não' end                         as sera_removida,
  case when p.policyname is null then null else
    format('create policy %I on public.%I as %s for %s to %s%s%s;',
      p.policyname, p.tablename, p.permissive, p.cmd,
      (select string_agg(quote_ident(r::text), ', ') from unnest(p.roles) r),
      case when p.qual       is not null then ' using (' || p.qual || ')' else '' end,
      case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end)
  end                                         as sql_para_recriar
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relname, p.policyname;


-- [C] Views e se já respeitam o RLS
select
  c.relname   as view,
  case c.relkind when 'v' then 'view' when 'm' then 'materialized view' end as tipo,
  c.reloptions as opcoes,
  coalesce(c.reloptions::text ilike '%security_invoker=true%'
        or c.reloptions::text ilike '%security_invoker=on%', false) as ja_respeita_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('v', 'm')
order by c.relname;
