-- =====================================================================
-- CONTAS A PAGAR — PASSO 1: tabela do card (rode o arquivo inteiro)
--
-- Cria a tabela contas_a_pagar: títulos SEM pagamento do relatório TOTVS da
-- obra toda com vencimento no mês seguinte ao fechamento, já classificados
-- por EAP (automacao/contas_a_pagar.py) e gravados pelo
--   node ferramentas/fechamento/importar.js --contas-classificador automacao/contas_a_pagar.csv --confirmar
--
-- Uma linha por título e EAP (um título pode ser rateado entre direto e
-- indireto). Cada carga tem um carga_id: a nova entra inteira e só depois a
-- anterior do mesmo fechamento sai.
--
-- NÃO é custo realizado: nada daqui vai para custos_lancamentos. O IPC soma
-- só as linhas com classe = 'direto' (com NF e "Prev. Financ.").
--
-- Conferido antes (out/26): não existia tabela contas_a_pagar no banco.
-- Segurança: RLS ativo, sem políticas (como na Etapa B) — só o servidor e os
-- scripts com a chave secreta enxergam.
-- =====================================================================

begin;

create table public.contas_a_pagar (
  id                      uuid primary key default gen_random_uuid(),
  obra_id                 text not null,
  carga_id                uuid not null,
  competencia_fechamento  text not null check (competencia_fechamento ~ '^\d{4}-\d{2}$'),  -- 2026-09
  competencia_vencimento  text not null check (competencia_vencimento ~ '^\d{4}-\d{2}$'),  -- 2026-10
  cnpj                    text,                       -- raiz do CNPJ ou CPF
  fornecedor              text not null,
  num_documento           text not null,
  seq                     smallint not null default 1, -- linha do título (rateio / item da OC)
  historico               text,
  item                    text,
  oc                      text,
  data_emissao            date,
  data_vencimento         date,
  data_previsao           date,                       -- previsão de baixa (a que define o mês)
  valor_titulo            numeric(14,2),
  valor                   numeric(14,2) not null,     -- valor desta linha
  codigo_eap              text,                       -- vazio = pendente
  classe                  text not null check (classe in ('direto', 'indireto', 'pendente')),
  natureza                text not null check (natureza in ('nf', 'previsto_sem_nf')),
  vinculo_oc              text,
  regra                   text,
  alertas                 text[] not null default '{}',
  importado_em            timestamptz not null default now(),
  unique (carga_id, cnpj, num_documento, seq)
);

create index contas_a_pagar_fechamento on public.contas_a_pagar (obra_id, competencia_fechamento);

alter table public.contas_a_pagar enable row level security;

commit;

-- Conferência (deve voltar 0 linhas antes da primeira carga):
-- select competencia_fechamento, classe, natureza, count(*), sum(valor)
--   from public.contas_a_pagar group by 1, 2, 3 order by 1, 2, 3;
