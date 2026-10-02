-- =====================================================================
-- CUSTOS — PASSO 2: texto da classificação do SIGAFER 10339/01 (julho)
--   "Aço Blocos e Vigas" -> "Aço Estaca". Não muda EAP (fica 2.1.6) nem valor.
--
-- Trava: só altera se encontrar EXATAMENTE essa linha; se achar 0 ou mais
-- de 1, cancela e nada muda.
-- =====================================================================

begin;

do $$
declare n integer;
begin
  update public.custos_lancamentos
     set classificacao = 'Aço Estaca'
   where id = 'ede7985b-a95b-434c-9f1f-d32ab5923c99'
     and obra_id = 'flats_pampulha'
     and competencia = '2026-07'
     and num_documento = '10339/01'
     and fornecedor = 'SIGAFER LTDA'
     and valor = 10395.06
     and codigo_eap = '2.1.6'
     and classificacao = 'Aço Blocos e Vigas';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'esperava alterar 1 linha, alteraria %: nada foi alterado', n;
  end if;
end $$;

commit;

-- Conferência: classificacao = Aço Estaca, codigo_eap = 2.1.6, valor = 10395.06
select id, competencia, num_documento, valor, codigo_eap, classificacao
from public.custos_lancamentos
where id = 'ede7985b-a95b-434c-9f1f-d32ab5923c99';

-- ---------------------------------------------------------------------
-- DESFAZER:
--   update public.custos_lancamentos set classificacao = 'Aço Blocos e Vigas'
--    where id = 'ede7985b-a95b-434c-9f1f-d32ab5923c99' and classificacao = 'Aço Estaca';
-- ---------------------------------------------------------------------
