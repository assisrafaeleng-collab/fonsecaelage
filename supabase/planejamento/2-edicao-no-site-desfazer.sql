-- =====================================================================
-- Flats Pampulha — DESFAZ o passo 2 (2-edicao-no-site.sql): apaga o histórico e as colunas de edição pelo site.
-- UMA consulta de cada vez; cada uma funciona sozinha (14/10/2026: sem tabela temporária entre comandos).
-- ATENÇÃO: perde as equipes, índices, durações e antecedências digitados no site. A consulta 1 mostra quantos são;
-- para guardar antes, rode a consulta 2 (backup em planejamento_historico_bkp_desfazer e indice_edicoes_bkp_desfazer,
-- com RLS e sem grant). Índice digitado no site (origem 'rafael-site') volta a origem '' com o último valor digitado.
-- =====================================================================

-- CONSULTA 1 — conferência ANTES, só leitura
select
  (select count(*) from public.indice_produtividade where obra_id = 'flats_pampulha') as indices,
  to_regclass('public.planejamento_historico') is not null as historico_existe,
  case when to_regclass('public.planejamento_historico') is null then null
       else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.planejamento_historico', false, true, '')))[1]::text::int end as historico_linhas,
  case when not exists (select 1 from information_schema.columns where table_schema = 'public'
                          and table_name = 'indice_produtividade' and column_name = 'editado_em') then null
       else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.indice_produtividade where editado_em is not null or equipes_definidas is not null or equipe_oficiais is not null', false, true, '')))[1]::text::int end as linhas_editadas;

-- CONSULTA 2 (opcional) — backup das edições (um bloco só)
do $$
begin
  if to_regclass('public.planejamento_historico_bkp_desfazer') is not null or to_regclass('public.indice_edicoes_bkp_desfazer') is not null then
    raise exception 'backup do desfazer já existe: confira/renomeie antes. Nada foi feito';
  end if;
  if to_regclass('public.planejamento_historico') is not null then
    create table public.planejamento_historico_bkp_desfazer as select * from public.planejamento_historico;
    alter table public.planejamento_historico_bkp_desfazer enable row level security;
    revoke all on public.planejamento_historico_bkp_desfazer from anon, authenticated;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
               and table_name = 'indice_produtividade' and column_name = 'editado_em') then
    create table public.indice_edicoes_bkp_desfazer as
      select obra_id, cod_eap, pavimento, hh_por_unidade, duracao_dias, origem, equipes_definidas, equipe_oficiais,
             equipe_ajudantes, equipe_funcao, editado_por, editado_em
        from public.indice_produtividade where editado_em is not null or equipes_definidas is not null or equipe_oficiais is not null;
    alter table public.indice_edicoes_bkp_desfazer enable row level security;
    revoke all on public.indice_edicoes_bkp_desfazer from anon, authenticated;
  end if;
end $$;

-- CONSULTA 3 — desfaz (um bloco só: tudo ou nada)
do $$
declare n_antes int; n_dep int;
begin
  select count(*) into n_antes from public.indice_produtividade where obra_id = 'flats_pampulha';
  drop table if exists public.planejamento_historico;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
               and table_name = 'indice_produtividade' and column_name = 'editado_em') then
    update public.indice_produtividade set origem = '' where origem = 'rafael-site';
  end if;
  alter table public.indice_produtividade drop constraint if exists indice_produtividade_origem_check;
  alter table public.indice_produtividade add constraint indice_produtividade_origem_check
    check (origem in ('rafael', 'cronograma', ''));
  alter table public.insumo_prazo_entrega
    drop column if exists editado_por,
    drop column if exists editado_em;
  alter table public.indice_produtividade
    drop column if exists equipes_definidas,
    drop column if exists equipe_oficiais,
    drop column if exists equipe_ajudantes,
    drop column if exists equipe_funcao,
    drop column if exists editado_por,
    drop column if exists editado_em;
  select count(*) into n_dep from public.indice_produtividade where obra_id = 'flats_pampulha';
  if n_dep <> n_antes then
    raise exception 'contagem de índices mudou (% → %): nada foi desfeito', n_antes, n_dep;
  end if;
end $$;

-- CONSULTA 4 — conferência DEPOIS (esperado: colunas_edicao = 0, historico_existe = false, indices igual à consulta 1)
select (select count(*) from information_schema.columns where table_schema = 'public'
          and table_name in ('indice_produtividade', 'insumo_prazo_entrega')
          and column_name in ('equipes_definidas', 'equipe_oficiais', 'equipe_ajudantes', 'equipe_funcao', 'editado_por', 'editado_em')) as colunas_edicao,
       to_regclass('public.planejamento_historico') is not null as historico_existe,
       (select count(*) from public.indice_produtividade where obra_id = 'flats_pampulha') as indices;
