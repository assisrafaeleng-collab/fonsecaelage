-- =====================================================================
-- Flats Pampulha — DESFAZ o passo 1 (1-tabelas-pontos-atencao.sql): apaga as 5 tabelas do painel.
-- Só elas: nada que existia antes foi alterado pelo passo 1. Se o passo 2 já rodou, rode antes o
-- 2-edicao-no-site-desfazer.sql (o drop abaixo levaria junto as edições feitas no site).
-- =====================================================================

-- CONSULTA 1 — conferência ANTES (o que vai ser apagado; historico_existe deve ser false)
select (select count(*) from public.equipe_padrao where obra_id = 'flats_pampulha') as equipes,
       (select count(*) from public.indice_produtividade where obra_id = 'flats_pampulha') as indices,
       (select count(*) from public.insumo_prazo_entrega where obra_id = 'flats_pampulha') as compras,
       (select count(*) from public.obra_jornada) as jornada,
       (select count(*) from public.obra_feriados where obra_id = 'flats_pampulha') as feriados,
       to_regclass('public.planejamento_historico') is not null as historico_existe;

-- CONSULTA 2 — apaga
begin;
do $$
begin
  if to_regclass('public.planejamento_historico') is not null then
    raise exception 'rode antes o 2-edicao-no-site-desfazer.sql: nada foi feito';
  end if;
end $$;
drop table if exists public.equipe_padrao;
drop table if exists public.indice_produtividade;
drop table if exists public.insumo_prazo_entrega;
drop table if exists public.obra_jornada;
drop table if exists public.obra_feriados;
commit;

-- CONSULTA 3 — conferência DEPOIS (esperado: 0)
select count(*) as tabelas_restantes
  from (values ('equipe_padrao'), ('indice_produtividade'), ('insumo_prazo_entrega'), ('obra_jornada'), ('obra_feriados')) t(n)
 where to_regclass('public.' || t.n) is not null;
