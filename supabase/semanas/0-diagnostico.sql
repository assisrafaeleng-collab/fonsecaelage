-- Semanas alinhadas ao fechamento do mes (decisao out/26) — PASSO 0: diagnostico.
-- So LE o banco. Rode no SQL Editor do Supabase e me mande o resultado antes do passo 1:
-- a migracao depende da definicao da view e do gatilho, que nao estao no repositorio.

-- 1. Definicao da view do realizado semanal e do gatilho que numera os retratos
select pg_get_viewdef('v_avanco_semanal_realizado'::regclass, true) as v_avanco_semanal_realizado;
select pg_get_viewdef('v_curva_s_mensal_planejada'::regclass, true) as v_curva_s_mensal_planejada;
select t.tgname, c.relname as tabela, pg_get_triggerdef(t.oid) as gatilho, pg_get_functiondef(t.tgfoid) as funcao
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal and c.relname in ('avanco_fisico_historico', 'avanco_fisico_realizado', 'calendario_semanas');

-- 2. Colunas das tabelas que mudam (a migracao recusa coluna que ela nao conhece)
select table_name, string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position) as colunas
from information_schema.columns
where table_schema = 'public'
  and table_name in ('calendario_semanas', 'curva_s_semanal_planejada', 'avanco_fisico_historico', 'avanco_fisico_realizado')
group by table_name;

-- 3. Outras views que dependem do calendario ou da curva
select distinct v.table_name as view_dependente, v.view_definition ilike '%calendario_semanas%' as usa_calendario
from information_schema.views v
where v.table_schema = 'public'
  and (v.view_definition ilike '%calendario_semanas%' or v.view_definition ilike '%curva_s_semanal_planejada%'
       or v.view_definition ilike '%semana_numero%');

-- 4. O que muda de numero: tudo a partir de 28/09/2026 (S1-S13 ficam iguais)
select 'calendario_semanas' as tabela, count(*) filter (where semana_numero >= 14) as linhas_que_mudam, count(*) as total
from calendario_semanas where obra_id = 'flats_pampulha'
union all
select 'curva_s_semanal_planejada', count(*) filter (where semana_numero >= 14), count(*)
from curva_s_semanal_planejada where obra_id = 'flats_pampulha'
union all
select 'avanco_fisico_historico (retratos)', count(*) filter (where data_lancamento >= date '2026-09-28'), count(*)
from avanco_fisico_historico where obra_id = 'flats_pampulha'
union all
select 'avanco_fisico_realizado (mensal)', count(*) filter (where semana_numero >= 14), count(*)
from avanco_fisico_realizado where obra_id = 'flats_pampulha';

-- 5. Retratos de 28/09 em diante (mudam de semana) e os de 28-30/09 (mudam de MES: outubro -> setembro)
select id, codigo_eap, pavimento, data_lancamento, semana_numero, mes_numero, percentual_realizado
from avanco_fisico_historico
where obra_id = 'flats_pampulha' and data_lancamento >= date '2026-09-28'
order by data_lancamento, id;
