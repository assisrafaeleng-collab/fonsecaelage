-- =====================================================================
-- CUSTOS — PASSO 3: remove de JULHO a linha da SIGAFER sem número de
-- documento — é a parcela 10339/02 (paga em 31/08), lançada à mão em 18/09
-- na competência errada. As duas linhas de julho somam R$ 20.790,12 = a NF
-- inteira; a /02 volta pela carga de agosto.
--
--   id 3d98ccfc-cc0d-4e0c-bb8d-18a8bea900d5 · SIGAFER LTDA · R$ 10.395,06
--   competência 2026-07 · EAP 2.1.6 · documento vazio · histórico "SIGAFER LTDA"
--
-- Por quê: a NF 10339 tem 2 parcelas (/01 baixa 30/07 e /02 baixa 31/08).
-- O banco já tem as duas em julho; a carga de agosto traz a /02 pela data
-- de baixa. Sem remover esta linha, a SIGAFER somaria 3 parcelas.
-- Efeito: julho cai R$ 10.395,06; agosto (depois da carga) sobe o mesmo valor.
--
-- Trava: só apaga se encontrar EXATAMENTE essa linha com todos os dados.
-- =====================================================================

begin;

do $$
declare n integer;
begin
  delete from public.custos_lancamentos
   where id = '3d98ccfc-cc0d-4e0c-bb8d-18a8bea900d5'
     and obra_id = 'flats_pampulha'
     and competencia = '2026-07'
     and num_documento is null
     and fornecedor = 'SIGAFER LTDA'
     and historico = 'SIGAFER LTDA'
     and data_emissao = '2026-07-02'
     and valor = 10395.06
     and codigo_eap = '2.1.6';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'esperava apagar 1 linha, apagaria %: nada foi apagado', n;
  end if;
end $$;

commit;

-- Conferência: deve sobrar só o 10339/01 em julho
select competencia, num_documento, valor, codigo_eap, classificacao
from public.custos_lancamentos
where fornecedor ilike '%SIGAFER%'
order by competencia, num_documento;

-- ---------------------------------------------------------------------
-- DESFAZER (recria a linha exatamente como estava):
--   insert into public.custos_lancamentos
--     (id, obra_id, competencia, seq, data_emissao, fornecedor, historico, classificacao,
--      grupo_custo, fase_obra, num_documento, data_vencimento, valor, status,
--      importado_em, created_at, codigo_eap, pavimento, importacao_id, cnpj)
--   values
--     ('3d98ccfc-cc0d-4e0c-bb8d-18a8bea900d5', 'flats_pampulha', '2026-07', null, '2026-07-02',
--      'SIGAFER LTDA', 'SIGAFER LTDA', 'Aço Blocos e Vigas', '2. MOVIMENTO DE TERRA E FUNDAÇÕES',
--      'Fundações', null, null, 10395.06, 'Normal', '2026-09-18T12:53:05.502103+00:00',
--      '2026-09-18T12:53:05.502103+00:00', '2.1.6', 'Edifício', null, null);
-- ---------------------------------------------------------------------
