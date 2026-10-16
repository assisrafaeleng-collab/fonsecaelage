-- =====================================================================
-- DESFAZER o passo 8 (chave Ref. Lançamento do TOTVS)
--
-- Só rode se nenhum fechamento foi gravado com ref (importar.js --classificador no modo acumulado).
-- O bloco 1 confere isso; o bloco 2 recusa sozinho se houver lançamento de carga com ref.
-- Se o passo 9 (preenchimento) já rodou, desfaça antes o 9 ou rode direto este: as colunas saem
-- inteiras, com o que foi preenchido.
-- Cada bloco funciona sozinho no editor do Supabase.
-- =====================================================================


-- ── 1. CONFERÊNCIA (só leitura): lançamentos gravados por carga com ref ──
select competencia, count(*) as linhas, sum(valor) as total
  from public.custos_lancamentos
 where ref_totvs is not null and importacao_id is not null
   and importacao_id in (select id from public.importacoes where criado_em >= '2026-10-14')
 group by 1 order by 1;


-- ── 2. DESFAZER A ESTRUTURA ──────────────────────────────────────────
begin;

do $$
begin
  if exists (select 1 from public.custos_lancamentos
              where ref_totvs is not null
                and importacao_id in (select id from public.importacoes where criado_em >= '2026-10-14')) then
    raise exception 'há lançamentos gravados com ref depois de 14/10/2026: desfaça essas cargas (importar.js --desfazer) antes';
  end if;
end $$;

drop index if exists public.custos_lancamentos_ref_totvs_uq;
drop index if exists public.contas_a_pagar_ref_totvs_uq;

alter table public.custos_lancamentos
  drop constraint if exists custos_lancamentos_ref_parte_ck,
  drop column if exists ref_totvs,
  drop column if exists ref_parte,
  drop column if exists data_baixa,
  drop column if exists baixa_retroativa;

alter table public.contas_a_pagar drop column if exists ref_totvs;

commit;


-- ── 3. APAGAR OS BACKUPS (opcional, só depois de conferir o bloco 2) ──
-- drop table public.custos_lancamentos_bkp_20261014;
-- drop table public.contas_a_pagar_bkp_20261014;
