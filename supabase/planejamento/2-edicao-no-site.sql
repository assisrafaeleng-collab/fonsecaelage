-- =====================================================================
-- Flats Pampulha — PLANEJAMENTO, PASSO 2: editar índice e equipes pelo site (cópia do Sirius 60, pedido 14C)
-- Rodar no SQL Editor DEPOIS do passo 1, UMA consulta de cada vez (cada uma funciona sozinha).
-- Desfazer: 2-edicao-no-site-desfazer.sql
--
-- indice_produtividade ganha (por linha cod_eap + pavimento):
--   equipes_definidas  nº de equipes escolhido pelo Rafael na tela (null = sugerido; "voltar ao sugerido" apaga)
--   equipe_oficiais, equipe_ajudantes, equipe_funcao  equipe informada na tela para a linha (sem tipo ou diferente)
--   editado_por, editado_em  última edição pelo site
--   origem passa a aceitar 'rafael-site' (índice ou duração digitados na tela).
-- insumo_prazo_entrega ganha editado_por / editado_em (antecedência de compra preenchida no site).
-- planejamento_historico (nova): toda alteração feita no site — linha (ou item de compra), campo (indice, duracao,
--   equipes, equipe, antecedencia), valor anterior, valor novo, quem e quando.
-- Nada existente é apagado nem muda de valor (só colunas novas, vazias): sem backup necessário.
-- Tabela nova: RLS ligado, sem política, sem permissão para anon/authenticated. A rota do site grava com a chave
-- secreta (só no servidor) e exige DASHBOARD_SENHA no cabeçalho x-dashboard-senha.
--
-- 14/10/2026: a versão anterior usava uma tabela temporária (_antes) entre comandos e falhou no SQL Editor, que roda
-- cada comando à parte ("relation _antes does not exist"). Agora a aplicação é UM bloco DO: o banco executa tudo ou
-- nada, as contagens de antes ficam em variáveis do próprio bloco e o bloco é idempotente (se a tentativa anterior
-- gravou uma parte, ele completa o que falta e confere tudo no fim).
-- =====================================================================

-- CONSULTA 1 — ESTADO, só leitura (rode antes e depois da consulta 2)
--   Passo 1 ok: indices = 437, com_indice = 395, com_duracao = 2.
--   Antes da consulta 2: colunas_edicao_indice = 0, colunas_edicao_compra = 0, origem_aceita_site = false,
--     historico_existe = false — ou parte disso já feita, se a tentativa anterior gravou algo.
--   Depois da consulta 2: 6 · 2 · true · true · historico_indice true · historico_rls true · historico_anon false ·
--     historico_linhas 0 · linhas_editadas 0 (e indices/com_indice/com_duracao iguais).
select
  (select count(*) from public.indice_produtividade where obra_id = 'flats_pampulha') as indices,
  (select count(hh_por_unidade) from public.indice_produtividade where obra_id = 'flats_pampulha') as com_indice,
  (select count(duracao_dias) from public.indice_produtividade where obra_id = 'flats_pampulha') as com_duracao,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'indice_produtividade'
     and column_name in ('equipes_definidas', 'equipe_oficiais', 'equipe_ajudantes', 'equipe_funcao', 'editado_por', 'editado_em')) as colunas_edicao_indice,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'insumo_prazo_entrega'
     and column_name in ('editado_por', 'editado_em')) as colunas_edicao_compra,
  coalesce((select pg_get_constraintdef(c.oid) like '%rafael-site%' from pg_constraint c
             where c.conrelid = 'public.indice_produtividade'::regclass and c.conname = 'indice_produtividade_origem_check'), false) as origem_aceita_site,
  to_regclass('public.planejamento_historico') is not null as historico_existe,
  to_regclass('public.planejamento_historico_linha') is not null as historico_indice,
  coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.planejamento_historico')), false) as historico_rls,
  case when to_regclass('public.planejamento_historico') is null then false
       else has_table_privilege('anon', 'public.planejamento_historico', 'select')
         or has_table_privilege('authenticated', 'public.planejamento_historico', 'select') end as historico_anon,
  case when to_regclass('public.planejamento_historico') is null then null
       else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.planejamento_historico', false, true, '')))[1]::text::int end as historico_linhas,
  case when not exists (select 1 from information_schema.columns where table_schema = 'public'
                          and table_name = 'indice_produtividade' and column_name = 'editado_em') then null
       else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.indice_produtividade where editado_em is not null', false, true, '')))[1]::text::int end as linhas_editadas;

-- CONSULTA 2 — aplica (um bloco só: tudo ou nada; pode rodar de novo sem estragar nada)
do $$
declare
  n_antes int; ix_antes int; dur_antes int; hist_antes int := 0;
  n_dep int; ix_dep int; dur_dep int;
begin
  if to_regclass('public.indice_produtividade') is null or to_regclass('public.insumo_prazo_entrega') is null then
    raise exception 'rode antes o supabase/planejamento/1-tabelas-pontos-atencao.sql: nada foi feito';
  end if;
  -- trava de contagem ANTES (os números do passo 1)
  select count(*), count(hh_por_unidade), count(duracao_dias) into n_antes, ix_antes, dur_antes
    from public.indice_produtividade where obra_id = 'flats_pampulha';
  if n_antes <> 437 then
    raise exception 'indice_produtividade tem % linhas (esperado 437): nada foi feito', n_antes;
  end if;
  if to_regclass('public.planejamento_historico') is not null then
    execute 'select count(*) from public.planejamento_historico' into hist_antes;
  end if;

  alter table public.indice_produtividade
    add column if not exists equipes_definidas int check (equipes_definidas > 0),
    add column if not exists equipe_oficiais int check (equipe_oficiais >= 0),
    add column if not exists equipe_ajudantes int check (equipe_ajudantes >= 0),
    add column if not exists equipe_funcao text,
    add column if not exists editado_por text,
    add column if not exists editado_em timestamptz;
  alter table public.insumo_prazo_entrega
    add column if not exists editado_por text,
    add column if not exists editado_em timestamptz;
  alter table public.indice_produtividade drop constraint if exists indice_produtividade_origem_check;
  alter table public.indice_produtividade add constraint indice_produtividade_origem_check
    check (origem in ('rafael', 'rafael-site', 'cronograma', ''));

  create table if not exists public.planejamento_historico (
    id bigserial primary key,
    obra_id text not null,
    cod_eap text not null,
    pavimento text,
    campo text not null check (campo in ('indice', 'duracao', 'equipes', 'equipe', 'antecedencia')),
    valor_anterior text,
    valor_novo text,
    editado_por text,
    editado_em timestamptz not null default now()
  );
  create index if not exists planejamento_historico_linha on public.planejamento_historico (obra_id, cod_eap, pavimento, editado_em);
  alter table public.planejamento_historico enable row level security;
  revoke all on public.planejamento_historico from anon, authenticated;
  revoke all on sequence public.planejamento_historico_id_seq from anon, authenticated;

  -- travas DEPOIS: estrutura completa e nenhum valor existente mudou
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'indice_produtividade'
       and column_name in ('equipes_definidas', 'equipe_oficiais', 'equipe_ajudantes', 'equipe_funcao', 'editado_por', 'editado_em')) <> 6
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'insumo_prazo_entrega'
       and column_name in ('editado_por', 'editado_em')) <> 2 then
    raise exception 'colunas novas incompletas: nada foi gravado';
  end if;
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'planejamento_historico'
       and column_name in ('obra_id', 'cod_eap', 'pavimento', 'campo', 'valor_anterior', 'valor_novo', 'editado_por', 'editado_em')) <> 8
     or (select is_nullable from information_schema.columns where table_schema = 'public'
           and table_name = 'planejamento_historico' and column_name = 'pavimento') <> 'YES' then
    raise exception 'planejamento_historico com estrutura diferente da esperada: nada foi gravado';
  end if;
  if has_table_privilege('anon', 'public.planejamento_historico', 'select')
     or has_table_privilege('authenticated', 'public.planejamento_historico', 'select') then
    raise exception 'planejamento_historico ainda acessível a anon/authenticated: nada foi gravado';
  end if;
  select count(*), count(hh_por_unidade), count(duracao_dias) into n_dep, ix_dep, dur_dep
    from public.indice_produtividade where obra_id = 'flats_pampulha';
  if (n_dep, ix_dep, dur_dep) is distinct from (n_antes, ix_antes, dur_antes) then
    raise exception 'os índices mudaram (antes %/%/%, depois %/%/%): nada foi gravado', n_antes, ix_antes, dur_antes, n_dep, ix_dep, dur_dep;
  end if;
  raise notice 'passo 2 aplicado: índices %, com índice %, com duração %, histórico com % linha(s)', n_dep, ix_dep, dur_dep, hist_antes;
end $$;

-- CONSULTA 3 — conferência DEPOIS: rode de novo a CONSULTA 1 (os valores esperados estão no comentário dela).
