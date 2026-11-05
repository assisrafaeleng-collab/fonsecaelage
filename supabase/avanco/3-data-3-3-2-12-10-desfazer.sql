-- =====================================================================
-- DESFAZ o passo 3 (3-data-3-3-2-12-10.sql): devolve data e semana da linha dc50c3fc-... a partir do
-- backup avanco_fisico_historico_bkp_20261105 e apaga o backup.
-- =====================================================================

begin;

update public.avanco_fisico_historico h
set data_lancamento = b.data_lancamento,
    semana_numero   = b.semana_numero
from public.avanco_fisico_historico_bkp_20261105 b
where h.id = b.id;

-- conferência: a linha volta para 10/12/2026, semana 25 (esperado: 1)
select count(*) as restaurada from public.avanco_fisico_historico
where id = 'dc50c3fc-0623-447d-a8fb-d6519ea2378b' and data_lancamento::date = '2026-12-10' and semana_numero = 25;

drop table public.avanco_fisico_historico_bkp_20261105;

commit;
