-- ATENCAO: NAO RODE. A migracao foi gravada em 06/10/2026; apagar os backups tira o caminho de volta.
-- Os backups *_bkp_20261006 sao o caminho de volta (2-desfazer-semanas.sql): mantenha-os.

-- Apaga as tabelas *_bkp_20261006 quando a migracao NAO esta valendo (calendario antigo, 87 semanas).
-- Use para backups orfaos (ensaio antigo) ou depois de desfazer. Se a migracao estiver gravada (96 semanas),
-- o script recusa: ai os backups sao o unico caminho de volta.

-- PASSO A (so leitura): confira antes
select 'calendario_semanas' as tabela, count(*) as linhas, max(semana_numero) as ultima_semana,
       max(data_fim) as fim, (select data_fim from calendario_semanas where obra_id = 'flats_pampulha' and semana_numero = 14) as fim_s14
from calendario_semanas where obra_id = 'flats_pampulha'
union all
select 'curva_s_semanal_planejada', count(*), max(semana_numero), null, null
from curva_s_semanal_planejada where obra_id = 'flats_pampulha';
-- Esperado: calendario 87 linhas, ultima 87, fim 2028-02-27, fim_s14 2026-10-04; curva 87 linhas.

select c.relname as backup, c.reltuples::bigint as linhas_aprox
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like '%\_bkp\_20261006' escape '\';

-- PASSO B: apaga (um bloco so; recusa se o calendario nao for o antigo)
do $$
declare t text;
begin
  if (select count(*) from calendario_semanas where obra_id = 'flats_pampulha') <> 87
     or (select data_fim from calendario_semanas where obra_id = 'flats_pampulha' and semana_numero = 14) <> date '2026-10-04'
     or (select count(*) from curva_s_semanal_planejada where obra_id = 'flats_pampulha') <> 87 then
    raise exception 'o calendario ou a curva nao estao no formato antigo (87 semanas, S14 ate 04/10): a migracao pode estar valendo, os backups NAO foram apagados';
  end if;
  foreach t in array array['calendario_semanas_bkp_20261006', 'curva_s_semanal_planejada_bkp_20261006',
                           'avanco_fisico_historico_bkp_20261006', 'avanco_fisico_realizado_bkp_20261006'] loop
    execute format('drop table if exists public.%I', t);
  end loop;
  raise notice 'backups _bkp_20261006 apagados';
end $$;
