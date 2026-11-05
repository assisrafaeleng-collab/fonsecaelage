-- =====================================================================
-- DESFAZ o passo 4 (4-apagar-3-3-2-75-12-10.sql): devolve a linha dc50c3fc-... a partir do backup
-- avanco_fisico_historico_bkp_20261105b e apaga o backup.
-- =====================================================================

begin;

insert into public.avanco_fisico_historico
select * from public.avanco_fisico_historico_bkp_20261105b
where id not in (select id from public.avanco_fisico_historico);

-- conferência: a linha voltou (esperado: 1)
select count(*) as restaurada from public.avanco_fisico_historico
where id = 'dc50c3fc-0623-447d-a8fb-d6519ea2378b';

drop table public.avanco_fisico_historico_bkp_20261105b;

commit;
