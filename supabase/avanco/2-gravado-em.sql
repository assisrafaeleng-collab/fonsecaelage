-- =====================================================================
-- AVANÇO — PASSO 2: hora da gravação de cada medição (decisão de 16/10/2026)
--
-- Duas medições do mesmo item no mesmo dia: vale a ÚLTIMA GRAVADA. A tabela só tinha a data da medição
-- e um id aleatório, então o empate não tinha ordem. A coluna gravado_em guarda a hora em que a medição
-- foi gravada (ou editada) pela página semanal (pages/api/avanco-lancamento.js).
-- As medições que já existem ficam com gravado_em vazio (não há como saber a hora) e, no empate, valem
-- antes das gravadas daqui em diante. Nada mais muda: percentual, data e semana continuam iguais.
-- O código funciona com ou sem esta coluna (lib/medicao-linha.js, carregarMedicoes).
-- Desfazer: 2-gravado-em-desfazer.sql.
-- =====================================================================

-- 1. Coluna sem default (as medições antigas ficam vazias), depois o default para as novas
alter table public.avanco_fisico_historico add column if not exists gravado_em timestamptz;
alter table public.avanco_fisico_historico alter column gravado_em set default now();

-- 2. Conferência: total de medições e quantas já têm a hora da gravação (as antigas: 0)
select count(*) as medicoes, count(gravado_em) as com_gravado_em
from public.avanco_fisico_historico
where obra_id = 'flats_pampulha';
