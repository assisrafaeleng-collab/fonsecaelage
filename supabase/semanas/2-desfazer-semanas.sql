-- Semanas alinhadas ao fechamento do mes — DESFAZER o passo 1 (depois de gravado).
-- Volta calendario, curva, retratos e avanco mensal ao estado de antes da migracao (backups _bkp_20261006).
-- Retrato lancado DEPOIS da migracao fica, com a semana recalculada pelo calendario antigo.
-- Um bloco so ("do $$ ... $$"): se algo falhar, nada muda. Os backups NAO sao apagados (veja o fim).

do $$
begin
  if to_regclass('public.calendario_semanas_bkp_20261006') is null
     or to_regclass('public.curva_s_semanal_planejada_bkp_20261006') is null
     or to_regclass('public.avanco_fisico_historico_bkp_20261006') is null
     or to_regclass('public.avanco_fisico_realizado_bkp_20261006') is null then
    raise exception 'faltam tabelas *_bkp_20261006: sem backup completo nao da para desfazer';
  end if;

  delete from calendario_semanas where obra_id = 'flats_pampulha';
  insert into calendario_semanas select * from calendario_semanas_bkp_20261006 where obra_id = 'flats_pampulha';

  delete from curva_s_semanal_planejada where obra_id = 'flats_pampulha';
  insert into curva_s_semanal_planejada select * from curva_s_semanal_planejada_bkp_20261006 where obra_id = 'flats_pampulha';

  update avanco_fisico_historico h
  set semana_numero = b.semana_numero, mes_numero = b.mes_numero
  from avanco_fisico_historico_bkp_20261006 b
  where h.id = b.id;

  -- retratos lancados depois da migracao: semana e mes pelo calendario antigo
  update avanco_fisico_historico h
  set semana_numero = c.semana_numero, mes_numero = c.mes_numero
  from calendario_semanas c
  where h.obra_id = 'flats_pampulha' and c.obra_id = 'flats_pampulha'
    and not exists (select 1 from avanco_fisico_historico_bkp_20261006 b where b.id = h.id)
    and (h.data_lancamento at time zone 'America/Sao_Paulo')::date between c.data_inicio and c.data_fim;

  delete from avanco_fisico_realizado where obra_id = 'flats_pampulha';
  insert into avanco_fisico_realizado select * from avanco_fisico_realizado_bkp_20261006 where obra_id = 'flats_pampulha';

  if (select count(*) from calendario_semanas where obra_id = 'flats_pampulha') <> 87 then
    raise exception 'depois de desfazer o calendario nao ficou com 87 semanas: nada foi alterado';
  end if;
  raise notice 'DESFEITO: calendario de volta com 87 semanas';
end $$;

-- Depois de conferir, os backups podem sair com 3-apagar-backups-orfaos.sql (que so apaga com 87 semanas).
