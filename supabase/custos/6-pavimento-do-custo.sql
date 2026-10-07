-- =====================================================================
-- CUSTO POR PAVIMENTO (decisão out/26) — rode o arquivo inteiro
--
-- Código de EAP repetido por pavimento (7.1.7 do 1º ao 6º...) passa a gravar
-- o pavimento no custo, como a medição. O dashboard põe o custo com
-- pavimento na linha daquele pavimento; sem pavimento, divide pela verba das
-- linhas, como antes. Código de uma linha só não muda.
--
--   custos_lancamentos.pavimento: JÁ EXISTE, mas o importar.js preenchia com o
--     pavimento da primeira linha do orçamento (em código repetido isso dizia
--     "1º" sem ninguém ter decidido). Passa a aceitar vazio (= sem pavimento
--     definido). Hoje não há nenhum lançamento pago em código repetido; se
--     houver, o pavimento automático é apagado (backup antes).
--   contas_a_pagar.pavimento: coluna NOVA.
--   7.1.7 do fechamento 2026-09 (Loja Elétrica, R$ 2.978,82): 2º pavimento,
--     a mesma linha da medição (passagem na primeira laje).
--
-- Rode SÓ depois que o código novo estiver em produção.
-- =====================================================================

begin;

-- Como a coluna estava antes (anote para o desfazer)
select column_name, is_nullable, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'custos_lancamentos' and column_name = 'pavimento';

alter table public.custos_lancamentos alter column pavimento drop not null;

-- Códigos repetidos por pavimento no orçamento
create temp table cod_repetido on commit drop as
  select cod_eap from public.orcamento_planejado
   where obra_id = 'flats_pampulha'
   group by cod_eap having count(*) > 1;

-- Lançamento pago em código repetido: pavimento automático sai (esperado: 0 linhas)
create table public.custos_lancamentos_pav_bkp_20261007 as
  select id, codigo_eap, pavimento from public.custos_lancamentos
   where obra_id = 'flats_pampulha' and codigo_eap in (select cod_eap from cod_repetido);
update public.custos_lancamentos set pavimento = null
 where obra_id = 'flats_pampulha' and codigo_eap in (select cod_eap from cod_repetido);

alter table public.contas_a_pagar add column pavimento text;

update public.contas_a_pagar set pavimento = '2º'
 where obra_id = 'flats_pampulha'
   and competencia_fechamento = '2026-09'
   and codigo_eap = '7.1.7'
   and classe = 'direto';

-- Conferência: 7.1.7 do fechamento 2026-09 → 2º, R$ 2.978,82
select codigo_eap, pavimento, count(*) as linhas, sum(valor) as valor
  from public.contas_a_pagar
 where obra_id = 'flats_pampulha' and competencia_fechamento = '2026-09' and codigo_eap = '7.1.7'
 group by 1, 2;
-- Lançamentos pagos que perderam o pavimento automático (esperado: 0)
select count(*) as pagos_em_codigo_repetido from public.custos_lancamentos_pav_bkp_20261007;

commit;

-- ---------------------------------------------------------------------
-- DESFAZER (volta como estava):
--   begin;
--   update public.custos_lancamentos c set pavimento = b.pavimento
--     from public.custos_lancamentos_pav_bkp_20261007 b where c.id = b.id;
--   alter table public.contas_a_pagar drop column pavimento;
--   -- só se a primeira consulta acima mostrou is_nullable = 'NO':
--   -- alter table public.custos_lancamentos alter column pavimento set not null;
--   drop table public.custos_lancamentos_pav_bkp_20261007;
--   commit;
-- Se uma carga nova já gravou lançamento sem pavimento, o "set not null"
-- falha: preencha antes ou deixe a coluna aceitando vazio.
-- ---------------------------------------------------------------------
