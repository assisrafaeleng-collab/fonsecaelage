-- =====================================================================
-- CONCILIAÇÃO DASHBOARD × TOTVS — correções de 2026-07 (histórico manual)
-- (automacao/conciliacao_dashboard_totvs.xlsx, aba "Correções propostas")
--
-- Fonte: TOTVS da obra toda (FLAT BH.XLSX, VALOR PAGO pintado) e relatórios de OC.
--   1. Comercial Urbano, "UNIFORME" R$ 1.293,50 lançado duas vezes. A NF 10621 (OC 1647,
--      R$ 2.587,00) foi paga pelo adiantamento Promotextil OC 1647 (R$ 1.293,50, já lançado
--      item a item) + parcela 10621/01 (R$ 1.293,50). A 10621/02 não tem pagamento no TOTVS
--      (é resto). Sai o lançamento duplicado, o de vencimento 09/06 (a /02).
--   2. Vulcano NF 26489/01 (OC 1637) = R$ 243,30: o arame PG7 é R$ 39,80 (2 un.), não 19,90.
--      Não é frete. Os três itens ganham o número da NF.
--   3. Vulcano NF 26646/01 (OC 1655), R$ 205,00, paga e fora do dashboard: boia de caixa
--      d'água, engate flexível e pinos 2P+T → 1.1.4 (ligação provisória), como a hidráulica
--      do canteiro.
--   4. Casa Ferreira Gonçalves NF 553612/01 (OC 1612), R$ 740,80, paga e fora do dashboard:
--      hidráulica do canteiro (caixa d'água 500 L, tubo e conexões 25 mm, registro, tanque,
--      sifão, cola) R$ 587,77 → 1.1.4, como a NF 553613/01 do mesmo fornecedor; lâmina e
--      arco de serra e lixa R$ 153,03 → 17.1.13 (ferramentas, como as de julho).
--   Competência 2026-07 (histórico de fev–jul), datas da NF e do vencimento do TOTVS.
--
-- Efeito: −1.293,50 + 19,90 + 205,00 + 740,80 = −327,80, tudo custo direto.
--   julho R$ 1.632.943,20 → R$ 1.632.615,40; custo direto realizado R$ 536.436,90 →
--   R$ 536.109,10; total do dashboard R$ 2.170.837,40 → R$ 2.170.509,60.
-- =====================================================================

begin;

-- Backup das linhas que mudam ou saem
create table public.custos_lancamentos_conc_bkp_20261007 as
  select * from public.custos_lancamentos
   where id in ('0e7ec387-a8ec-4616-a07a-d914bf265162',   -- Comercial Urbano duplicado
                '77f3a307-249e-4de5-b16c-4aa3169f7079',   -- Vulcano vergalhão 5 mm
                '7b1d0e08-5fa6-4b9b-a554-28353f2a3751',   -- Vulcano vergalhão 6,3 mm
                '4120b11d-a357-4a3e-9a42-2af826d151f7');  -- Vulcano arame PG7

-- 1. duplicado
delete from public.custos_lancamentos
 where id = '0e7ec387-a8ec-4616-a07a-d914bf265162'
   and competencia = '2026-07' and valor = 1293.50;

-- 2. Vulcano 26489/01
update public.custos_lancamentos set num_documento = '26489/01'
 where id in ('77f3a307-249e-4de5-b16c-4aa3169f7079', '7b1d0e08-5fa6-4b9b-a554-28353f2a3751',
              '4120b11d-a357-4a3e-9a42-2af826d151f7')
   and competencia = '2026-07';
update public.custos_lancamentos
   set valor = 39.80, historico = 'ARAME RECOZIDO PG7 (TRANCADO) - 2 UN'
 where id = '4120b11d-a357-4a3e-9a42-2af826d151f7' and valor = 19.90;

-- 3 e 4. títulos pagos fora do dashboard
insert into public.custos_lancamentos
  (id, obra_id, competencia, seq, data_emissao, data_vencimento, fornecedor, historico, num_documento,
   classificacao, grupo_custo, fase_obra, valor, status, codigo_eap, pavimento, cnpj)
values
  ('5959dcbe-76ff-4389-923f-2afe066717fb', 'flats_pampulha', '2026-07', 169, '2026-05-28', '2026-06-15',
   'VULCANO LTDA', 'BOIA CAIXA DAGUA 3/4, ENGATE FLEXIVEL 50CM, PINOS 2P+T 20A (OC 1655)', '26646/01',
   'Material Hidráulico Canteiro', '6. Canteiro de Obras', 'Construção do Canteiro', 205.00, 'Normal', '1.1.4', '1º', '21095682'),
  ('bd81091e-df26-4889-ac5c-05dc81f85bfa', 'flats_pampulha', '2026-07', 170, '2026-05-11', '2026-06-15',
   'CASA FERREIRA GONCALVES LTDA', 'CAIXA DAGUA 500L, TUBO E CONEXOES 25MM, REGISTRO, TANQUE, SIFAO, COLA (OC 1612)', '553612/01',
   'Material Hidráulico Canteiro', '6. Canteiro de Obras', 'Construção do Canteiro', 587.77, 'Normal', '1.1.4', '1º', '17250275'),
  ('ceeb82c8-54b3-4687-95a2-427c1d9cc36a', 'flats_pampulha', '2026-07', 171, '2026-05-11', '2026-06-15',
   'CASA FERREIRA GONCALVES LTDA', 'LAMINA DE SERRA, ARCO DE SERRA, LIXA (OC 1612)', '553612/01',
   'Ferramenta Manual', '8. Ferramentas', 'Construção do Canteiro', 153.03, 'Normal', '17.1.13', 'Edifício', '17250275');

-- Conferência: julho deve dar 1.632.615,40 (−327,80) e 216 linhas (214 − 1 + 3)
select competencia, count(*) as linhas, sum(valor) as total
  from public.custos_lancamentos
 where obra_id = 'flats_pampulha' and competencia = '2026-07' and status = 'Normal'
 group by 1;

commit;

-- ---------------------------------------------------------------------
-- DESFAZER:
--   begin;
--   delete from public.custos_lancamentos
--    where id in ('5959dcbe-76ff-4389-923f-2afe066717fb', 'bd81091e-df26-4889-ac5c-05dc81f85bfa',
--                 'ceeb82c8-54b3-4687-95a2-427c1d9cc36a');
--   update public.custos_lancamentos c
--      set valor = b.valor, historico = b.historico, num_documento = b.num_documento
--     from public.custos_lancamentos_conc_bkp_20261007 b
--    where c.id = b.id;
--   insert into public.custos_lancamentos
--     select * from public.custos_lancamentos_conc_bkp_20261007
--      where id = '0e7ec387-a8ec-4616-a07a-d914bf265162';
--   drop table public.custos_lancamentos_conc_bkp_20261007;
--   commit;
-- ---------------------------------------------------------------------
