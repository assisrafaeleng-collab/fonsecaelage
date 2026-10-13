-- =====================================================================
-- Flats Pampulha — PLANEJAMENTO, PASSO 2: editar índice e equipes pelo site (cópia do Sirius 60, pedido 14C)
-- Rodar no SQL Editor, UMA consulta de cada vez, DEPOIS do passo 1 e de promover o código da tela.
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
-- =====================================================================

-- CONSULTA 1 — conferência ANTES (esperado: passo1 = true, colunas_novas = 0, historico_existe = false)
select to_regclass('public.indice_produtividade') is not null as passo1,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'indice_produtividade'
          and column_name in ('equipes_definidas', 'equipe_oficiais', 'equipe_ajudantes', 'equipe_funcao', 'editado_por', 'editado_em')) as colunas_novas,
       to_regclass('public.planejamento_historico') is not null as historico_existe,
       (select count(*) from public.indice_produtividade where obra_id = 'flats_pampulha') as indices;

-- CONSULTA 2 — aplica
begin;

do $$
begin
  if to_regclass('public.indice_produtividade') is null then
    raise exception 'rode antes o supabase/planejamento/1-tabelas-pontos-atencao.sql';
  end if;
  if to_regclass('public.planejamento_historico') is not null
     or exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'indice_produtividade' and column_name = 'equipes_definidas') then
    raise exception 'este arquivo já foi rodado: nada foi feito';
  end if;
end $$;

create temporary table _antes on commit drop as
  select count(*) as n, count(hh_por_unidade) as ix, count(duracao_dias) as dur
    from public.indice_produtividade where obra_id = 'flats_pampulha';

alter table public.indice_produtividade
  add column equipes_definidas int check (equipes_definidas > 0),
  add column equipe_oficiais int check (equipe_oficiais >= 0),
  add column equipe_ajudantes int check (equipe_ajudantes >= 0),
  add column equipe_funcao text,
  add column editado_por text,
  add column editado_em timestamptz;
alter table public.insumo_prazo_entrega
  add column editado_por text,
  add column editado_em timestamptz;
alter table public.indice_produtividade drop constraint if exists indice_produtividade_origem_check;
alter table public.indice_produtividade add constraint indice_produtividade_origem_check
  check (origem in ('rafael', 'rafael-site', 'cronograma', ''));

create table public.planejamento_historico (
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
create index planejamento_historico_linha on public.planejamento_historico (obra_id, cod_eap, pavimento, editado_em);
alter table public.planejamento_historico enable row level security;
revoke all on public.planejamento_historico from anon, authenticated;
revoke all on sequence public.planejamento_historico_id_seq from anon, authenticated;

do $$
begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'indice_produtividade'
       and column_name in ('equipes_definidas', 'equipe_oficiais', 'equipe_ajudantes', 'equipe_funcao', 'editado_por', 'editado_em')) <> 6 then
    raise exception 'colunas novas não foram criadas: nada foi gravado';
  end if;
  if (select (n, ix, dur) from _antes) is distinct from
     (select (count(*), count(hh_por_unidade), count(duracao_dias)) from public.indice_produtividade where obra_id = 'flats_pampulha') then
    raise exception 'os índices mudaram: nada foi gravado';
  end if;
end $$;

commit;

-- CONSULTA 3 — conferência DEPOIS (esperado: colunas_novas = 6, historico = 0, indices igual à consulta 1)
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'indice_produtividade'
          and column_name in ('equipes_definidas', 'equipe_oficiais', 'equipe_ajudantes', 'equipe_funcao', 'editado_por', 'editado_em')) as colunas_novas,
       (select count(*) from public.planejamento_historico) as historico,
       (select count(*) from public.indice_produtividade where obra_id = 'flats_pampulha') as indices;
