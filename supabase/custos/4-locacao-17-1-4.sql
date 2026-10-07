-- =====================================================================
-- CUSTOS — PASSO 4: locação (grupo 17), decisão out/26
--
--   1. orcamento_planejado 17.1.4: "Locação de Martelete" ->
--      "Locação de ferramentas manuais e pequenos equipamentos".
--      Só a descrição: código, orçado (R$ 3.000,00) e meses não mudam.
--   2. Serra clipper Toyama · LOCAFAZ LOCACAO DE EQUIPAMENTOS LTDA ·
--      28520/01 · R$ 70,01 · set/26: 17.1.4 -> 17.1.7 (serra).
--      id 20f1e839-6166-41a6-8a89-61a5030b9beb
--   3. Furadeira 127V (compra, não locação) · VULCANO LTDA · 26431/01 ·
--      R$ 251,00 · jul/26: 17.1.4 -> 17.1.13 (ferramentas compradas).
--      id 9dae0e7b-4ab5-466b-b922-069909a22095
--
-- Por quê: a 17.1.4 juntava martelete, esmerilhadeira, policorte, bomba
-- d'água etc. — vira a linha de ferramentas e pequenos equipamentos sem
-- linha própria. A clipper é serra; a furadeira foi comprada.
-- Para o futuro: regra CONTEM:CLIPPER -> 17.1.7 (HC e as duas LOCAFAZ) em
-- automacao/regras_manuais.csv, vigente desde 01/09.
--
-- Efeito: total do grupo 17 não muda (orçado R$ 313.367,06; pago
-- R$ 46.543,59). 17.1.4 3.119,60 -> 2.798,59 (abaixo do teto de 3.000);
-- 17.1.7 184,19 -> 254,20; 17.1.13 10.002,92 -> 10.253,92. O valor agregado
-- da locação sobe R$ 119,60 (a 17.1.4 deixa de passar do teto).
--
-- Trava: cada alteração só acontece se encontrar EXATAMENTE a linha com
-- todos os dados; se achar 0 ou mais de 1, cancela e nada muda.
-- =====================================================================

begin;

do $$
declare n integer;
begin
  update public.orcamento_planejado
     set descricao = 'Locação de ferramentas manuais e pequenos equipamentos'
   where obra_id = 'flats_pampulha'
     and cod_eap = '17.1.4'
     and descricao = 'Locação de Martelete';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'orcamento 17.1.4: esperava alterar 1 linha, alteraria %: nada foi alterado', n;
  end if;

  update public.custos_lancamentos
     set codigo_eap = '17.1.7'
   where id = '20f1e839-6166-41a6-8a89-61a5030b9beb'
     and obra_id = 'flats_pampulha'
     and competencia = '2026-09'
     and num_documento = '28520/01'
     and fornecedor = 'LOCAFAZ LOCACAO DE EQUIPAMENTOS LTDA'
     and valor = 70.01
     and codigo_eap = '17.1.4';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'clipper 28520/01: esperava alterar 1 linha, alteraria %: nada foi alterado', n;
  end if;

  update public.custos_lancamentos
     set codigo_eap = '17.1.13'
   where id = '9dae0e7b-4ab5-466b-b922-069909a22095'
     and obra_id = 'flats_pampulha'
     and competencia = '2026-07'
     and num_documento = '26431/01'
     and fornecedor = 'VULCANO LTDA'
     and valor = 251
     and codigo_eap = '17.1.4';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'furadeira 26431/01: esperava alterar 1 linha, alteraria %: nada foi alterado', n;
  end if;
end $$;

commit;

-- Conferência 1: descrição nova da 17.1.4, orçado 3000
select cod_eap, descricao, preco_total
from public.orcamento_planejado
where obra_id = 'flats_pampulha' and cod_eap = '17.1.4';

-- Conferência 2: por linha do grupo 17. Esperado: 17.1.4 = 2798.59,
-- 17.1.7 = 254.20, 17.1.13 = 10253.92; as outras linhas não mudam
select codigo_eap, count(*) as lancamentos, sum(valor) as total
from public.custos_lancamentos
where obra_id = 'flats_pampulha' and status = 'Normal' and codigo_eap like '17.%'
group by codigo_eap
order by string_to_array(codigo_eap, '.')::int[];

-- Conferência 3: total do grupo 17 = 46543.59 (o mesmo de antes)
select sum(valor) as total_grupo_17
from public.custos_lancamentos
where obra_id = 'flats_pampulha' and status = 'Normal' and codigo_eap like '17.%';

-- ---------------------------------------------------------------------
-- DESFAZER (volta as três alterações; se reimportar setembro depois, tire
-- também a regra CONTEM:CLIPPER do regras_manuais.csv):
--   begin;
--   update public.orcamento_planejado set descricao = 'Locação de Martelete'
--    where obra_id = 'flats_pampulha' and cod_eap = '17.1.4'
--      and descricao = 'Locação de ferramentas manuais e pequenos equipamentos';
--   update public.custos_lancamentos set codigo_eap = '17.1.4'
--    where id = '20f1e839-6166-41a6-8a89-61a5030b9beb' and codigo_eap = '17.1.7';
--   update public.custos_lancamentos set codigo_eap = '17.1.4'
--    where id = '9dae0e7b-4ab5-466b-b922-069909a22095' and codigo_eap = '17.1.13';
--   commit;
-- ---------------------------------------------------------------------
