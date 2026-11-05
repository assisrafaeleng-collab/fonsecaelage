-- =====================================================================
-- AVANÇO — PASSO 3: data da medição da 3.3.2 (3º pav, 75%) de 10/12/2026 para 12/10/2026
-- (decisão de 05/11/2026: dia e mês trocados na digitação)
--
-- A linha dc50c3fc-... está com data 10/12/2026 (semana 25, no futuro). Volta para 12/10/2026, semana 17,
-- como as outras medições daquele dia. Já existe outra medição da 3.3.2 do 3º pav com 75% em 12/10/2026
-- (9c31de2d-...): depois da correção ficam duas iguais no mesmo dia. O percentual é o mesmo, então nenhum
-- número muda (o avanço de outubro já usa a de 12/10).
-- Backup da linha em avanco_fisico_historico_bkp_20261105. Desfazer: 3-data-3-3-2-12-10-desfazer.sql.
-- =====================================================================

begin;

-- 1. Backup da linha como está
create table public.avanco_fisico_historico_bkp_20261105 as
select * from public.avanco_fisico_historico
where id = 'dc50c3fc-0623-447d-a8fb-d6519ea2378b';

alter table public.avanco_fisico_historico_bkp_20261105 enable row level security;

-- 2. Correção (só se a linha ainda estiver como antes: 3.3.2, 3º, 75%, 10/12/2026, semana 25)
update public.avanco_fisico_historico
set data_lancamento = '2026-10-12 12:00:00+00',
    semana_numero   = 17
where id = 'dc50c3fc-0623-447d-a8fb-d6519ea2378b'
  and obra_id = 'flats_pampulha'
  and codigo_eap = '3.3.2'
  and pavimento = '3º'
  and percentual_realizado = 75
  and semana_numero = 25
  and data_lancamento::date = '2026-12-10';

-- 3. Conferência: 1 linha no backup; a linha corrigida em 12/10/2026, semana 17; nenhuma medição no futuro
select 'backup' as o_que, count(*) as linhas from public.avanco_fisico_historico_bkp_20261105
union all
select 'corrigida (12/10, S17)', count(*) from public.avanco_fisico_historico
 where id = 'dc50c3fc-0623-447d-a8fb-d6519ea2378b' and data_lancamento::date = '2026-10-12' and semana_numero = 17
union all
select 'medicoes com data futura', count(*) from public.avanco_fisico_historico
 where obra_id = 'flats_pampulha' and data_lancamento::date > current_date;
-- esperado: 1, 1, 0. Se não bater, rode "rollback;" em vez de "commit;".

commit;
