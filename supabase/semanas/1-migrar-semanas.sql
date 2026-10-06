-- ATENCAO: JA RODADO EM 06/10/2026 (migracao gravada e conferida). NAO RODE DE NOVO.
-- Os backups *_bkp_20261006 sao o caminho de volta (2-desfazer-semanas.sql): mantenha-os.

-- Semanas alinhadas ao fechamento do mes (decisao out/26) — PASSO 1: migracao.
--
-- COMO RODAR
--   Ensaio (nada e gravado): rode como esta, com  ensaio boolean := true  (linha logo abaixo de "declare").
--     O script faz tudo, confere e no fim PARA com a mensagem "ENSAIO CONCLUIDO SEM ERROS ... nada foi
--     gravado" e o resumo. Essa parada e proposital: e ela que desfaz tudo, inclusive os backups.
--   Para valer: troque para  ensaio boolean := false  e rode de novo. Depois rode as consultas de
--     conferencia do fim do arquivo.
--
-- POR QUE UM BLOCO SO: a migracao inteira esta dentro de um unico comando "do $$ ... $$". No Postgres um
-- comando e sempre atomico: se qualquer passo falhar (trava, conferencia, erro), NADA fica gravado, nem
-- os backups, independente de o editor respeitar begin/commit/rollback.
--
-- Regra: a semana termina no domingo OU no ultimo dia do mes, o que vier primeiro. A semana que cruza
-- a virada do mes e partida em duas. Fragmento de 1 dia no INICIO do mes junta com a semana seguinte
-- (01/11/2026 -> S20 01-08/11); fragmento de 1 dia no FIM do mes junta com a semana ANTERIOR
-- (30/11/2026 -> S23 23-30/11; idem 31/05/2027 e 31/01/2028), senao a semana cruzaria o mes.
-- S1-S13 nao mudam. De 28/09/2026 em diante: S14 28-30/09 (fechamento de setembro), S15 01-04/10 ...
-- S19 26-31/10 (fechamento de outubro) ... S96 21-27/02/2028. A obra passa de 87 para 96 semanas;
-- a data final nao muda.
-- O planejado das semanas partidas e dividido proporcionalmente aos dias: valores semanais pelos dias,
-- colunas acumuladas refeitas a partir dos incrementos (o total no fim da obra fica igual ao de hoje).
--
-- Colunas conferidas em 06/10/2026 (leitura das quatro tabelas):
--   calendario_semanas: id, obra_id, semana_numero, data_inicio, data_fim, mes_numero, mes_label, label
--   curva_s_semanal_planejada: id, obra_id, semana_numero, mes_numero, custo_evm_semanal, custo_evm_acum,
--     perc_custo_acum, hh_semanal, perc_hh_acum, financeiro_semanal, financeiro_acum,
--     parcela_a_semanal, parcela_a_acum, parcela_b_semanal, parcela_b_acum, parcela_c_semanal, parcela_c_acum
--     (parcela_x_semanal = incremento semanal de parcela_x_acum; a + b + c = custo_evm_semanal)
--   avanco_fisico_historico e avanco_fisico_realizado: so semana_numero (e mes_numero no historico) mudam,
--     por UPDATE; as outras colunas nao sao tocadas.
-- Calendario e curva sao regravados com INSERT de colunas explicitas: coluna nova nelas trava aqui.
-- Desfazer depois de gravar: 2-desfazer-semanas.sql.

do $$
declare
  ensaio boolean := true;   -- true = so ensaio (nada e gravado); false = grava
  extra text;
  dif numeric;
  velho record;
  novo record;
  resumo text;
begin
  -- 0. Travas
  if to_regclass('public.calendario_semanas_bkp_20261006') is not null
     or to_regclass('public.curva_s_semanal_planejada_bkp_20261006') is not null
     or to_regclass('public.avanco_fisico_historico_bkp_20261006') is not null
     or to_regclass('public.avanco_fisico_realizado_bkp_20261006') is not null then
    raise exception 'ja existem tabelas *_bkp_20261006. Se o calendario ainda tem 87 semanas, sao backups orfaos: apague com 3-apagar-backups-orfaos.sql. Se ja tem 96, a migracao ja rodou: desfaca com 2-desfazer-semanas.sql';
  end if;
  if (select count(*) from calendario_semanas where obra_id = 'flats_pampulha') <> 87 then
    raise exception 'o calendario nao tem 87 semanas: a migracao espera o calendario antigo';
  end if;
  select string_agg(column_name, ', ') into extra
  from information_schema.columns
  where table_schema = 'public' and table_name = 'curva_s_semanal_planejada'
    and column_name not in ('id', 'obra_id', 'semana_numero', 'mes_numero', 'custo_evm_semanal', 'custo_evm_acum',
      'perc_custo_acum', 'hh_semanal', 'perc_hh_acum', 'financeiro_semanal', 'financeiro_acum',
      'parcela_a_semanal', 'parcela_a_acum', 'parcela_b_semanal', 'parcela_b_acum', 'parcela_c_semanal', 'parcela_c_acum');
  if extra is not null then
    raise exception 'curva_s_semanal_planejada tem colunas que esta migracao nao conhece: %', extra;
  end if;
  select string_agg(column_name, ', ') into extra
  from information_schema.columns
  where table_schema = 'public' and table_name = 'calendario_semanas'
    and column_name not in ('id', 'obra_id', 'semana_numero', 'data_inicio', 'data_fim', 'mes_numero', 'mes_label', 'label');
  if extra is not null then
    raise exception 'calendario_semanas tem colunas que esta migracao nao conhece: %', extra;
  end if;

  -- 1. Backups (o desfazer usa estes)
  create table calendario_semanas_bkp_20261006 as select * from calendario_semanas;
  create table curva_s_semanal_planejada_bkp_20261006 as select * from curva_s_semanal_planejada;
  create table avanco_fisico_historico_bkp_20261006 as select * from avanco_fisico_historico;
  create table avanco_fisico_realizado_bkp_20261006 as select * from avanco_fisico_realizado;

  -- 2. Calendario novo a partir da S14
  drop table if exists pg_temp.cal_novo, pg_temp.mapa, pg_temp.inc, pg_temp.curva_nova;
  create temp table cal_novo (semana_numero int, data_inicio date, data_fim date, mes_numero int, label text) on commit drop;
  insert into cal_novo values
    (14, date '2026-09-28', date '2026-09-30', 3, 'S14 · 28/09 a 30/09'),
    (15, date '2026-10-01', date '2026-10-04', 4, 'S15 · 01/10 a 04/10'),
    (16, date '2026-10-05', date '2026-10-11', 4, 'S16 · 05/10 a 11/10'),
    (17, date '2026-10-12', date '2026-10-18', 4, 'S17 · 12/10 a 18/10'),
    (18, date '2026-10-19', date '2026-10-25', 4, 'S18 · 19/10 a 25/10'),
    (19, date '2026-10-26', date '2026-10-31', 4, 'S19 · 26/10 a 31/10'),
    (20, date '2026-11-01', date '2026-11-08', 5, 'S20 · 01/11 a 08/11'),
    (21, date '2026-11-09', date '2026-11-15', 5, 'S21 · 09/11 a 15/11'),
    (22, date '2026-11-16', date '2026-11-22', 5, 'S22 · 16/11 a 22/11'),
    (23, date '2026-11-23', date '2026-11-30', 5, 'S23 · 23/11 a 30/11'),
    (24, date '2026-12-01', date '2026-12-06', 6, 'S24 · 01/12 a 06/12'),
    (25, date '2026-12-07', date '2026-12-13', 6, 'S25 · 07/12 a 13/12'),
    (26, date '2026-12-14', date '2026-12-20', 6, 'S26 · 14/12 a 20/12'),
    (27, date '2026-12-21', date '2026-12-27', 6, 'S27 · 21/12 a 27/12'),
    (28, date '2026-12-28', date '2026-12-31', 6, 'S28 · 28/12 a 31/12'),
    (29, date '2027-01-01', date '2027-01-03', 7, 'S29 · 01/01 a 03/01'),
    (30, date '2027-01-04', date '2027-01-10', 7, 'S30 · 04/01 a 10/01'),
    (31, date '2027-01-11', date '2027-01-17', 7, 'S31 · 11/01 a 17/01'),
    (32, date '2027-01-18', date '2027-01-24', 7, 'S32 · 18/01 a 24/01'),
    (33, date '2027-01-25', date '2027-01-31', 7, 'S33 · 25/01 a 31/01'),
    (34, date '2027-02-01', date '2027-02-07', 8, 'S34 · 01/02 a 07/02'),
    (35, date '2027-02-08', date '2027-02-14', 8, 'S35 · 08/02 a 14/02'),
    (36, date '2027-02-15', date '2027-02-21', 8, 'S36 · 15/02 a 21/02'),
    (37, date '2027-02-22', date '2027-02-28', 8, 'S37 · 22/02 a 28/02'),
    (38, date '2027-03-01', date '2027-03-07', 9, 'S38 · 01/03 a 07/03'),
    (39, date '2027-03-08', date '2027-03-14', 9, 'S39 · 08/03 a 14/03'),
    (40, date '2027-03-15', date '2027-03-21', 9, 'S40 · 15/03 a 21/03'),
    (41, date '2027-03-22', date '2027-03-28', 9, 'S41 · 22/03 a 28/03'),
    (42, date '2027-03-29', date '2027-03-31', 9, 'S42 · 29/03 a 31/03'),
    (43, date '2027-04-01', date '2027-04-04', 10, 'S43 · 01/04 a 04/04'),
    (44, date '2027-04-05', date '2027-04-11', 10, 'S44 · 05/04 a 11/04'),
    (45, date '2027-04-12', date '2027-04-18', 10, 'S45 · 12/04 a 18/04'),
    (46, date '2027-04-19', date '2027-04-25', 10, 'S46 · 19/04 a 25/04'),
    (47, date '2027-04-26', date '2027-04-30', 10, 'S47 · 26/04 a 30/04'),
    (48, date '2027-05-01', date '2027-05-02', 11, 'S48 · 01/05 a 02/05'),
    (49, date '2027-05-03', date '2027-05-09', 11, 'S49 · 03/05 a 09/05'),
    (50, date '2027-05-10', date '2027-05-16', 11, 'S50 · 10/05 a 16/05'),
    (51, date '2027-05-17', date '2027-05-23', 11, 'S51 · 17/05 a 23/05'),
    (52, date '2027-05-24', date '2027-05-31', 11, 'S52 · 24/05 a 31/05'),
    (53, date '2027-06-01', date '2027-06-06', 12, 'S53 · 01/06 a 06/06'),
    (54, date '2027-06-07', date '2027-06-13', 12, 'S54 · 07/06 a 13/06'),
    (55, date '2027-06-14', date '2027-06-20', 12, 'S55 · 14/06 a 20/06'),
    (56, date '2027-06-21', date '2027-06-27', 12, 'S56 · 21/06 a 27/06'),
    (57, date '2027-06-28', date '2027-06-30', 12, 'S57 · 28/06 a 30/06'),
    (58, date '2027-07-01', date '2027-07-04', 13, 'S58 · 01/07 a 04/07'),
    (59, date '2027-07-05', date '2027-07-11', 13, 'S59 · 05/07 a 11/07'),
    (60, date '2027-07-12', date '2027-07-18', 13, 'S60 · 12/07 a 18/07'),
    (61, date '2027-07-19', date '2027-07-25', 13, 'S61 · 19/07 a 25/07'),
    (62, date '2027-07-26', date '2027-07-31', 13, 'S62 · 26/07 a 31/07'),
    (63, date '2027-08-01', date '2027-08-08', 14, 'S63 · 01/08 a 08/08'),
    (64, date '2027-08-09', date '2027-08-15', 14, 'S64 · 09/08 a 15/08'),
    (65, date '2027-08-16', date '2027-08-22', 14, 'S65 · 16/08 a 22/08'),
    (66, date '2027-08-23', date '2027-08-29', 14, 'S66 · 23/08 a 29/08'),
    (67, date '2027-08-30', date '2027-08-31', 14, 'S67 · 30/08 a 31/08'),
    (68, date '2027-09-01', date '2027-09-05', 15, 'S68 · 01/09 a 05/09'),
    (69, date '2027-09-06', date '2027-09-12', 15, 'S69 · 06/09 a 12/09'),
    (70, date '2027-09-13', date '2027-09-19', 15, 'S70 · 13/09 a 19/09'),
    (71, date '2027-09-20', date '2027-09-26', 15, 'S71 · 20/09 a 26/09'),
    (72, date '2027-09-27', date '2027-09-30', 15, 'S72 · 27/09 a 30/09'),
    (73, date '2027-10-01', date '2027-10-03', 16, 'S73 · 01/10 a 03/10'),
    (74, date '2027-10-04', date '2027-10-10', 16, 'S74 · 04/10 a 10/10'),
    (75, date '2027-10-11', date '2027-10-17', 16, 'S75 · 11/10 a 17/10'),
    (76, date '2027-10-18', date '2027-10-24', 16, 'S76 · 18/10 a 24/10'),
    (77, date '2027-10-25', date '2027-10-31', 16, 'S77 · 25/10 a 31/10'),
    (78, date '2027-11-01', date '2027-11-07', 17, 'S78 · 01/11 a 07/11'),
    (79, date '2027-11-08', date '2027-11-14', 17, 'S79 · 08/11 a 14/11'),
    (80, date '2027-11-15', date '2027-11-21', 17, 'S80 · 15/11 a 21/11'),
    (81, date '2027-11-22', date '2027-11-28', 17, 'S81 · 22/11 a 28/11'),
    (82, date '2027-11-29', date '2027-11-30', 17, 'S82 · 29/11 a 30/11'),
    (83, date '2027-12-01', date '2027-12-05', 18, 'S83 · 01/12 a 05/12'),
    (84, date '2027-12-06', date '2027-12-12', 18, 'S84 · 06/12 a 12/12'),
    (85, date '2027-12-13', date '2027-12-19', 18, 'S85 · 13/12 a 19/12'),
    (86, date '2027-12-20', date '2027-12-26', 18, 'S86 · 20/12 a 26/12'),
    (87, date '2027-12-27', date '2027-12-31', 18, 'S87 · 27/12 a 31/12'),
    (88, date '2028-01-01', date '2028-01-02', 19, 'S88 · 01/01 a 02/01'),
    (89, date '2028-01-03', date '2028-01-09', 19, 'S89 · 03/01 a 09/01'),
    (90, date '2028-01-10', date '2028-01-16', 19, 'S90 · 10/01 a 16/01'),
    (91, date '2028-01-17', date '2028-01-23', 19, 'S91 · 17/01 a 23/01'),
    (92, date '2028-01-24', date '2028-01-31', 19, 'S92 · 24/01 a 31/01'),
    (93, date '2028-02-01', date '2028-02-06', 20, 'S93 · 01/02 a 06/02'),
    (94, date '2028-02-07', date '2028-02-13', 20, 'S94 · 07/02 a 13/02'),
    (95, date '2028-02-14', date '2028-02-20', 20, 'S95 · 14/02 a 20/02'),
    (96, date '2028-02-21', date '2028-02-27', 20, 'S96 · 21/02 a 27/02');

  -- 3. Mapa semana antiga x semana nova, com os dias em comum
  create temp table mapa on commit drop as
  select o.semana_numero as s_old, n.semana_numero as s_new,
         (least(o.data_fim, n.data_fim) - greatest(o.data_inicio, n.data_inicio) + 1)::numeric as dias,
         (o.data_fim - o.data_inicio + 1)::numeric as dias_old
  from calendario_semanas_bkp_20261006 o
  join cal_novo n on n.data_inicio <= o.data_fim and n.data_fim >= o.data_inicio
  where o.obra_id = 'flats_pampulha' and o.semana_numero >= 14;

  if exists (select s_old from mapa group by s_old, dias_old having sum(dias) <> dias_old) then
    raise exception 'mapa de semanas nao cobre todos os dias de alguma semana antiga';
  end if;
  if (select max(data_fim) from cal_novo) <> (select max(data_fim) from calendario_semanas_bkp_20261006 where obra_id = 'flats_pampulha') then
    raise exception 'o calendario novo nao termina na mesma data do antigo';
  end if;

  -- 4. Curva planejada: incrementos da semana antiga repartidos pelos dias
  create temp table inc on commit drop as
  select semana_numero as s,
         custo_evm_semanal, hh_semanal, financeiro_semanal,
         parcela_a_semanal, parcela_b_semanal, parcela_c_semanal,
         custo_evm_acum  - lag(custo_evm_acum)  over w as d_custo,
         perc_custo_acum - lag(perc_custo_acum) over w as d_perc_custo,
         perc_hh_acum    - lag(perc_hh_acum)    over w as d_perc_hh,
         financeiro_acum - lag(financeiro_acum) over w as d_fin,
         parcela_a_acum  - lag(parcela_a_acum)  over w as d_a,
         parcela_b_acum  - lag(parcela_b_acum)  over w as d_b,
         parcela_c_acum  - lag(parcela_c_acum)  over w as d_c
  from curva_s_semanal_planejada_bkp_20261006
  where obra_id = 'flats_pampulha'
  window w as (order by semana_numero);

  create temp table curva_nova on commit drop as
  with base as (
    select * from curva_s_semanal_planejada_bkp_20261006 where obra_id = 'flats_pampulha' and semana_numero = 13
  ), sem as (
    select m.s_new,
           sum(i.custo_evm_semanal * m.dias / m.dias_old) as custo_sem,
           sum(i.hh_semanal * m.dias / m.dias_old) as hh_sem,
           sum(i.financeiro_semanal * m.dias / m.dias_old) as fin_sem,
           sum(i.parcela_a_semanal * m.dias / m.dias_old) as a_sem,
           sum(i.parcela_b_semanal * m.dias / m.dias_old) as b_sem,
           sum(i.parcela_c_semanal * m.dias / m.dias_old) as c_sem,
           sum(i.d_custo * m.dias / m.dias_old) as d_custo,
           sum(i.d_perc_custo * m.dias / m.dias_old) as d_perc_custo,
           sum(i.d_perc_hh * m.dias / m.dias_old) as d_perc_hh,
           sum(i.d_fin * m.dias / m.dias_old) as d_fin,
           sum(i.d_a * m.dias / m.dias_old) as d_a,
           sum(i.d_b * m.dias / m.dias_old) as d_b,
           sum(i.d_c * m.dias / m.dias_old) as d_c
    from mapa m join inc i on i.s = m.s_old
    group by m.s_new
  )
  select s.s_new as semana_numero, n.mes_numero,
         round(s.custo_sem, 2) as custo_evm_semanal,
         round(b.custo_evm_acum  + sum(s.d_custo)      over w, 2) as custo_evm_acum,
         round(b.perc_custo_acum + sum(s.d_perc_custo) over w, 6) as perc_custo_acum,
         round(s.hh_sem, 2) as hh_semanal,
         round(b.perc_hh_acum    + sum(s.d_perc_hh)    over w, 6) as perc_hh_acum,
         round(s.fin_sem, 2) as financeiro_semanal,
         round(b.financeiro_acum + sum(s.d_fin)        over w, 2) as financeiro_acum,
         round(s.a_sem, 2) as parcela_a_semanal,
         round(b.parcela_a_acum  + sum(s.d_a)          over w, 2) as parcela_a_acum,
         round(s.b_sem, 2) as parcela_b_semanal,
         round(b.parcela_b_acum  + sum(s.d_b)          over w, 2) as parcela_b_acum,
         round(s.c_sem, 2) as parcela_c_semanal,
         round(b.parcela_c_acum  + sum(s.d_c)          over w, 2) as parcela_c_acum
  from sem s join cal_novo n on n.semana_numero = s.s_new cross join base b
  window w as (order by s.s_new);

  -- os valores semanais das semanas novas somam o mesmo que os das antigas (S14 em diante)
  select abs(coalesce(sum(n.custo_evm_semanal), 0) - (select sum(custo_evm_semanal) from inc where s >= 14))
       + abs(coalesce(sum(n.hh_semanal), 0) - (select sum(hh_semanal) from inc where s >= 14))
       + abs(coalesce(sum(n.financeiro_semanal), 0) - (select sum(financeiro_semanal) from inc where s >= 14))
       + abs(coalesce(sum(n.parcela_a_semanal), 0) - (select sum(parcela_a_semanal) from inc where s >= 14))
       + abs(coalesce(sum(n.parcela_b_semanal), 0) - (select sum(parcela_b_semanal) from inc where s >= 14))
       + abs(coalesce(sum(n.parcela_c_semanal), 0) - (select sum(parcela_c_semanal) from inc where s >= 14))
    into dif from curva_nova n;
  if dif > 1.00 then
    raise exception 'os valores semanais da curva nova nao somam o mesmo que os da antiga (diferenca %)', dif;
  end if;
  select * into velho from curva_s_semanal_planejada_bkp_20261006 where obra_id = 'flats_pampulha' order by semana_numero desc limit 1;
  select * into novo from curva_nova order by semana_numero desc limit 1;
  if abs(velho.custo_evm_acum - novo.custo_evm_acum) > 0.05 or abs(velho.parcela_a_acum - novo.parcela_a_acum) > 0.05
     or abs(velho.parcela_b_acum - novo.parcela_b_acum) > 0.05 or abs(velho.parcela_c_acum - novo.parcela_c_acum) > 0.05
     or abs(velho.perc_hh_acum - novo.perc_hh_acum) > 0.0001 or abs(velho.financeiro_acum - novo.financeiro_acum) > 0.05 then
    raise exception 'o total da curva nova nao fecha com o da antiga (custo % x %)', novo.custo_evm_acum, velho.custo_evm_acum;
  end if;

  -- 5. Grava calendario e curva
  delete from calendario_semanas where obra_id = 'flats_pampulha' and semana_numero >= 14;
  insert into calendario_semanas (obra_id, semana_numero, data_inicio, data_fim, mes_numero, mes_label, label)
  select 'flats_pampulha', n.semana_numero, n.data_inicio, n.data_fim, n.mes_numero,
         (select o.mes_label from calendario_semanas_bkp_20261006 o
          where o.obra_id = 'flats_pampulha' and o.mes_numero = n.mes_numero limit 1),
         n.label
  from cal_novo n;

  delete from curva_s_semanal_planejada where obra_id = 'flats_pampulha' and semana_numero >= 14;
  insert into curva_s_semanal_planejada (obra_id, semana_numero, mes_numero, custo_evm_semanal, custo_evm_acum,
    perc_custo_acum, hh_semanal, perc_hh_acum, financeiro_semanal, financeiro_acum,
    parcela_a_semanal, parcela_a_acum, parcela_b_semanal, parcela_b_acum, parcela_c_semanal, parcela_c_acum)
  select 'flats_pampulha', semana_numero, mes_numero, custo_evm_semanal, custo_evm_acum, perc_custo_acum, hh_semanal,
         perc_hh_acum, financeiro_semanal, financeiro_acum,
         parcela_a_semanal, parcela_a_acum, parcela_b_semanal, parcela_b_acum, parcela_c_semanal, parcela_c_acum
  from curva_nova;

  -- 6. Retratos: semana e mes pela data do lancamento no fuso da obra (28-30/09 passam a ser setembro)
  update avanco_fisico_historico h
  set semana_numero = n.semana_numero, mes_numero = n.mes_numero
  from cal_novo n
  where h.obra_id = 'flats_pampulha'
    and (h.data_lancamento at time zone 'America/Sao_Paulo')::date between n.data_inicio and n.data_fim;

  -- 7. Avanco mensal (uma linha por mes, na ultima semana do mes): vai para a nova ultima semana do mes.
  --    Em dois passos (numero negativo no meio) por causa do indice unico ux_avanco_semana.
  update avanco_fisico_realizado r
  set semana_numero = -(select max(n.semana_numero) from cal_novo n where n.mes_numero = o.mes_numero)
  from calendario_semanas_bkp_20261006 o
  where r.obra_id = 'flats_pampulha' and o.obra_id = 'flats_pampulha'
    and o.semana_numero = r.semana_numero and r.semana_numero >= 14;
  update avanco_fisico_realizado set semana_numero = -semana_numero
  where obra_id = 'flats_pampulha' and semana_numero < 0;

  -- 8. Resumo
  select format('%s semanas (ultima S%s, fim %s); S14 %s a %s com custo planejado %s; fim da curva %s (antes %s)',
                count(*), max(c.semana_numero), to_char(max(c.data_fim), 'DD/MM/YYYY'),
                (select to_char(data_inicio, 'DD/MM') from calendario_semanas where obra_id = 'flats_pampulha' and semana_numero = 14),
                (select to_char(data_fim, 'DD/MM') from calendario_semanas where obra_id = 'flats_pampulha' and semana_numero = 14),
                (select custo_evm_semanal from curva_s_semanal_planejada where obra_id = 'flats_pampulha' and semana_numero = 14),
                novo.custo_evm_acum, velho.custo_evm_acum)
    into resumo
  from calendario_semanas c where c.obra_id = 'flats_pampulha';

  if ensaio then
    raise exception 'ENSAIO CONCLUIDO SEM ERROS (parada proposital: nada foi gravado, nem os backups). %', resumo;
  end if;
  raise notice 'MIGRACAO GRAVADA. %', resumo;
end $$;

-- Conferencia (rode depois da migracao para valer; so leitura)
-- select semana_numero, data_inicio, data_fim, mes_numero, label
-- from calendario_semanas where obra_id = 'flats_pampulha' and semana_numero between 12 and 21 order by semana_numero;
-- select semana_numero, mes_numero, custo_evm_semanal, parcela_a_semanal + parcela_b_semanal + parcela_c_semanal as soma_parcelas,
--        custo_evm_acum, perc_hh_acum
-- from curva_s_semanal_planejada where obra_id = 'flats_pampulha' and semana_numero between 12 and 21 order by semana_numero;
-- select count(*) as semanas, max(semana_numero) as ultima, max(data_fim) as fim
-- from calendario_semanas where obra_id = 'flats_pampulha';
