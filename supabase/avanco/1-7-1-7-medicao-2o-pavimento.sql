-- 7.1.7 (Eletroduto PVC rígido Ø 3/4"): medição de 17/09/26 (S12) por pavimento.
--
-- Decisão out/26: código repetido por pavimento é medido por linha (código +
-- pavimento). Os 7,5% lançados eram da 7.1.7 da obra toda (passagem de
-- mangueiras na primeira laje, que é o 2º pavimento). O lançamento ficou
-- gravado com pavimento "1º" (primeira linha do orçamento).
--
-- Cálculo (mesmo valor agregado total):
--   orçado total da 7.1.7 = 5 × 8.200,00 + 8.000,00 = 49.000,00
--   valor agregado        = 7,5% × 49.000,00        =  3.675,00
--   % da linha do 2º pav  = 3.675,00 ÷ 8.200,00      = 44,8171%
--   Hh da linha do 2º pav = 123,37 h × 44,8171%      =    55,29 h
--   (antes: 7,5% × 739,19 h das seis linhas          =    55,29 h)
-- As outras linhas da 7.1.7 ficam sem medição (0%).

-- Rode SÓ depois que o código com medição por pavimento estiver em produção
-- (o código anterior aplicaria os 44,8171% nos seis pavimentos).

begin;

-- Confere se percentual_realizado guarda 4 casas decimais; se não, aborta
-- antes de alterar qualquer coisa.
do $$
declare
  tipo text;
  escala int;
begin
  select data_type, numeric_scale into tipo, escala
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'avanco_fisico_historico'
     and column_name = 'percentual_realizado';
  if tipo is null then
    raise exception 'coluna percentual_realizado não encontrada';
  end if;
  if tipo in ('integer', 'bigint', 'smallint') or (tipo = 'numeric' and escala is not null and escala < 4) then
    raise exception 'percentual_realizado é % com % casas decimais: não guarda 44,8171', tipo, coalesce(escala, 0);
  end if;
  raise notice 'percentual_realizado: % (escala %), ok', tipo, coalesce(escala::text, 'livre');
end $$;

create table avanco_fisico_historico_bkp_20261007 as
  select * from avanco_fisico_historico
   where id = '67db7f78-10b8-4dce-a7fa-0546b7371ee6';

update avanco_fisico_historico
   set pavimento            = '2º',
       percentual_realizado = 44.8171,
       hh_planejado         = 123.37,
       hh_realizado         = 55.29
 where id                   = '67db7f78-10b8-4dce-a7fa-0546b7371ee6'
   and codigo_eap           = '7.1.7'
   and pavimento            = '1º'
   and percentual_realizado = 7.5;
-- Deve atualizar 1 linha.

select id, codigo_eap, pavimento, percentual_realizado, semana_numero, data_lancamento, hh_planejado, hh_realizado
  from avanco_fisico_historico
 where codigo_eap = '7.1.7';

commit;
