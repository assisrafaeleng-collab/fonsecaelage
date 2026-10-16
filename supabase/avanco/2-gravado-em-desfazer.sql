-- Desfaz o 2-gravado-em.sql: remove a coluna gravado_em de avanco_fisico_historico.
-- Percentual, data e semana das medições não mudam. O código volta a desempatar só pela ordem da consulta.
alter table public.avanco_fisico_historico drop column if exists gravado_em;
