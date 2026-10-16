-- =====================================================================
-- DESFAZER o passo 9: limpa o ref_totvs dos lançamentos que o 9 preencheu
--
-- Volta ref_totvs, ref_parte e data_baixa ao que estava no backup do passo 8
-- (custos_lancamentos_bkp_20261014, onde essas colunas ainda não existiam = vazias).
-- Não mexe em lançamento gravado depois (que não está no backup).
-- Cada bloco funciona sozinho no editor do Supabase.
-- =====================================================================


-- ── 1. PRÉVIA (só leitura): linhas que voltam a ficar sem ref ────────
select c.competencia, count(*) as linhas, count(distinct c.ref_totvs) as titulos, sum(c.valor) as total
  from public.custos_lancamentos c
  join public.custos_lancamentos_bkp_20261014 b on b.id = c.id
 where c.ref_totvs is not null
 group by 1 order by 1;


-- ── 2. DESFAZER ──────────────────────────────────────────────────────
begin;

update public.custos_lancamentos c
   set ref_totvs = null, ref_parte = null, data_baixa = null
  from public.custos_lancamentos_bkp_20261014 b
 where b.id = c.id and c.ref_totvs is not null;

commit;


-- ── 3. CONFERÊNCIA: deve voltar 0 ────────────────────────────────────
select count(*) as ainda_com_ref
  from public.custos_lancamentos c
  join public.custos_lancamentos_bkp_20261014 b on b.id = c.id
 where c.ref_totvs is not null;
