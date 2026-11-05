-- =====================================================================
-- AVANÇO — PASSO 4: apaga a medição antiga da 3.3.2 (3º pav, 75%) de 12/10/2026 (decisão de 05/11/2026)
--
-- Em 05/11 a 3.3.2 do 3º pav foi relançada: 30% em 30/09 e 100% em 06/10, e as medições antigas de 02/10
-- e 12/10 foram apagadas na tela. Sobrou a linha dc50c3fc-..., que estava com data 10/12/2026 (fora do
-- cálculo) e o passo 3 trouxe para 12/10/2026. Como é a medição mais recente, ela derrubou a 3.3.2 de 100%
-- para 75% a partir da S17 (valor agregado de outubro −R$ 3.379,80; IPC de outubro 1,057 → 1,053).
-- Apagar a linha devolve a 3.3.2 a 100% desde 06/10. Setembro não muda (1,114).
-- Backup da linha em avanco_fisico_historico_bkp_20261105b. Desfazer: 4-apagar-3-3-2-75-12-10-desfazer.sql.
-- =====================================================================

begin;

-- 1. Backup da linha como está
create table public.avanco_fisico_historico_bkp_20261105b as
select * from public.avanco_fisico_historico
where id = 'dc50c3fc-0623-447d-a8fb-d6519ea2378b';

alter table public.avanco_fisico_historico_bkp_20261105b enable row level security;

-- 2. Apaga (só se a linha ainda estiver como o passo 3 deixou: 3.3.2, 3º, 75%, 12/10/2026)
delete from public.avanco_fisico_historico
where id = 'dc50c3fc-0623-447d-a8fb-d6519ea2378b'
  and obra_id = 'flats_pampulha'
  and codigo_eap = '3.3.2'
  and pavimento = '3º'
  and percentual_realizado = 75
  and data_lancamento::date = '2026-10-12';

-- 3. Conferência: 1 linha no backup; a 3.3.2 do 3º pav fica com 30% em 30/09 e 100% em 06/10
select 'backup' as o_que, count(*)::text as valor from public.avanco_fisico_historico_bkp_20261105b
union all
select 'ultima medicao 3.3.2 3º', max(data_lancamento::date)::text || ' = ' ||
       max(percentual_realizado) filter (where data_lancamento::date = '2026-10-06')::text || '%'
from public.avanco_fisico_historico
where obra_id = 'flats_pampulha' and codigo_eap = '3.3.2' and pavimento = '3º';
-- esperado: backup 1; ultima medicao 3.3.2 3º "2026-10-06 = 100%". Se não bater, rode "rollback;".

commit;
