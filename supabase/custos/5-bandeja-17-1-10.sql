-- =====================================================================
-- CUSTOS — PASSO 5: bandeja (17.1.10) medida por unidade, decisão out/26
--
--   1. orcamento_planejado 17.1.10 "Locação Bandeja" (verba R$ 41.887,00,
--      sem mudança): entra_evm = true. A linha passa a ser compra POR
--      ENTREGA: entra no contas a pagar e no IPC (o importar.js deixa de
--      marcá-la como recorrente) e o valor agregado vem da medição, não da
--      regra da locação (gasto limitado à verba; lib/painel-semanal.js).
--      hh continua 0: o avanço físico em horas não muda.
--   2. Medição da 17.1.10: 33,33% em 30/09/2026 (S14, fechamento de
--      setembro) — 1 de 3 bandejas, a primária, pronta em setembro.
--      A 2ª e a 3ª entram como 66,67% e 100% quando ficarem prontas.
--
-- Rode ANTES da recarga do contas a pagar (importar.js
-- --contas-classificador --confirmar): sem o entra_evm, a parte da madeira
-- da bandeja no a pagar sai do IPC como recorrente.
--
-- Trava: só altera se encontrar exatamente a linha do orçamento com
-- entra_evm = false e se ainda não houver medição da 17.1.10; a medição
-- tem que cair na S14. Senão cancela e nada muda.
-- =====================================================================

begin;

do $$
declare n integer; s integer;
begin
  update public.orcamento_planejado
     set entra_evm = true
   where obra_id = 'flats_pampulha'
     and cod_eap = '17.1.10'
     and preco_total = 41887
     and entra_evm = false;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'orcamento 17.1.10: esperava alterar 1 linha, alteraria %: nada foi alterado', n;
  end if;

  insert into public.avanco_fisico_historico
    (obra_id, codigo_eap, percentual_realizado, data_lancamento, semana_numero, mes_numero,
     competencia, pavimento, atividade_nome, grupo_num, hh_planejado, hh_realizado)
  select 'flats_pampulha', '17.1.10', 33.33, '2026-09-30T12:00:00Z', c.semana_numero, c.mes_numero,
         '2026-09-01', o.pavimento, o.descricao, o.grupo_numero, null, null
    from public.calendario_semanas c
    join public.orcamento_planejado o on o.obra_id = c.obra_id and o.cod_eap = '17.1.10'
   where c.obra_id = 'flats_pampulha'
     and date '2026-09-30' between c.data_inicio and c.data_fim
     and not exists (select 1 from public.avanco_fisico_historico h
                      where h.obra_id = 'flats_pampulha' and h.codigo_eap = '17.1.10');
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'medição 17.1.10: esperava inserir 1 linha, inseriria %: nada foi alterado', n;
  end if;
  select semana_numero into s from public.avanco_fisico_historico
   where obra_id = 'flats_pampulha' and codigo_eap = '17.1.10';
  if s <> 14 then
    raise exception 'medição 17.1.10 caiu na semana %, esperado S14: nada foi alterado', s;
  end if;
end $$;

commit;

-- Conferência 1: entra_evm = true, verba 41887
select cod_eap, descricao, preco_total, entra_evm, hh
from public.orcamento_planejado
where obra_id = 'flats_pampulha' and cod_eap = '17.1.10';

-- Conferência 2: uma medição, 33.33 em 30/09, semana 14
select id, codigo_eap, percentual_realizado, data_lancamento, semana_numero, mes_numero
from public.avanco_fisico_historico
where obra_id = 'flats_pampulha' and codigo_eap = '17.1.10';

-- ---------------------------------------------------------------------
-- DESFAZER (antes, volte as decisões da madeira em automacao/ e recarregue
-- o contas a pagar, senão a bandeja volta a ser recorrente com custo):
--   begin;
--   delete from public.avanco_fisico_historico
--    where obra_id = 'flats_pampulha' and codigo_eap = '17.1.10'
--      and percentual_realizado = 33.33 and semana_numero = 14;
--   update public.orcamento_planejado set entra_evm = false
--    where obra_id = 'flats_pampulha' and cod_eap = '17.1.10' and entra_evm = true;
--   commit;
-- ---------------------------------------------------------------------
