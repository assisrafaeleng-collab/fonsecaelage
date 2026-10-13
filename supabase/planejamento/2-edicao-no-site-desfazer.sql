-- =====================================================================
-- Flats Pampulha — DESFAZ o passo 2 (2-edicao-no-site.sql): apaga o histórico e as colunas de edição pelo site.
-- ATENÇÃO: perde as equipes e índices digitados no site. A consulta 1 mostra quantos são; para guardar antes, rode a
-- consulta 1b (cria planejamento_historico_bkp_desfazer e indice_edicoes_bkp_desfazer, com RLS e sem grant).
-- Índice digitado no site (origem 'rafael-site') volta a origem '' e fica com o último valor digitado.
-- =====================================================================

-- CONSULTA 1 — conferência ANTES
select (select count(*) from public.planejamento_historico) as historico,
       (select count(*) from public.indice_produtividade where obra_id = 'flats_pampulha'
          and (equipes_definidas is not null or equipe_oficiais is not null or editado_em is not null)) as linhas_editadas,
       (select count(*) from public.indice_produtividade where obra_id = 'flats_pampulha' and origem = 'rafael-site') as origem_site;

-- CONSULTA 1b (opcional) — backup das edições
create table public.planejamento_historico_bkp_desfazer as select * from public.planejamento_historico;
create table public.indice_edicoes_bkp_desfazer as
  select obra_id, cod_eap, pavimento, hh_por_unidade, duracao_dias, origem, equipes_definidas, equipe_oficiais,
         equipe_ajudantes, equipe_funcao, editado_por, editado_em
    from public.indice_produtividade where editado_em is not null or equipes_definidas is not null or equipe_oficiais is not null;
alter table public.planejamento_historico_bkp_desfazer enable row level security;
revoke all on public.planejamento_historico_bkp_desfazer from anon, authenticated;
alter table public.indice_edicoes_bkp_desfazer enable row level security;
revoke all on public.indice_edicoes_bkp_desfazer from anon, authenticated;

-- CONSULTA 2 — desfaz
begin;
drop table if exists public.planejamento_historico;
update public.indice_produtividade set origem = '' where origem = 'rafael-site';
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
commit;

-- CONSULTA 3 — conferência DEPOIS (esperado: colunas_edicao = 0, historico_existe = false)
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'indice_produtividade'
          and column_name in ('equipes_definidas', 'equipe_oficiais', 'equipe_ajudantes', 'equipe_funcao', 'editado_por', 'editado_em')) as colunas_edicao,
       to_regclass('public.planejamento_historico') is not null as historico_existe;
