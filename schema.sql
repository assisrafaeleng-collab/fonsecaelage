-- ============================================================
-- OBRA DASHBOARD — Schema do banco de dados (Supabase / PostgreSQL)
-- Rode este script no SQL Editor do seu projeto Supabase
-- ============================================================

-- Tabela principal de atualizações da obra
CREATE TABLE IF NOT EXISTS atualizacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data        DATE NOT NULL,
  semana      INTEGER,
  avanco_real NUMERIC(5,2) NOT NULL,
  avanco_plan NUMERIC(5,2) NOT NULL DEFAULT 0,
  desvio_dias INTEGER       DEFAULT 0,
  custo_real  NUMERIC(12,2) NOT NULL,
  orcamento   NUMERIC(12,2) NOT NULL DEFAULT 15000,
  projecao    NUMERIC(12,2) NOT NULL,
  notas       TEXT,
  disciplinas JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_atualizacoes_data ON atualizacoes(data DESC);

-- Row Level Security (RLS) — permite leitura e escrita pública para MVP
-- Em produção, adicione autenticação e restrinja as políticas
ALTER TABLE atualizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública"  ON atualizacoes FOR SELECT USING (true);
CREATE POLICY "Inserção pública" ON atualizacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Exclusão pública" ON atualizacoes FOR DELETE USING (true);
CREATE POLICY "Atualização pública" ON atualizacoes FOR UPDATE USING (true);

-- ============================================================
-- Dados de exemplo (opcional — delete depois do teste)
-- ============================================================
INSERT INTO atualizacoes (data, semana, avanco_real, avanco_plan, desvio_dias, custo_real, orcamento, projecao, notas, disciplinas) VALUES
('2026-01-31', 4,  4,  5,   0,  620,  15000, 15000, 'Mobilização completa. Início das fundações.',
 '[{"key":"estrutura","label":"Estrutura","orc":3200,"fr":4,"fp":5,"fn":620},{"key":"alvenaria","label":"Alvenaria","orc":1400,"fr":0,"fp":0,"fn":0},{"key":"eletrica","label":"Inst. Elétrica","orc":980,"fr":0,"fp":0,"fn":0},{"key":"hidraulica","label":"Hidráulica","orc":860,"fr":0,"fp":0,"fn":0},{"key":"revestimento","label":"Revestimento","orc":1100,"fr":0,"fp":0,"fn":0},{"key":"fachada","label":"Fachada","orc":1250,"fr":0,"fp":0,"fn":0},{"key":"arcond","label":"Ar-cond./Elev.","orc":900,"fr":0,"fp":0,"fn":0}]'),
('2026-02-28', 8,  11, 12, -2,  1730, 15000, 15100, 'Estrutura em bom ritmo. Leve atraso na mobilização de armadores.',
 '[{"key":"estrutura","label":"Estrutura","orc":3200,"fr":35,"fp":38,"fn":1400},{"key":"alvenaria","label":"Alvenaria","orc":1400,"fr":5,"fp":7,"fn":330},{"key":"eletrica","label":"Inst. Elétrica","orc":980,"fr":0,"fp":0,"fn":0},{"key":"hidraulica","label":"Hidráulica","orc":860,"fr":0,"fp":0,"fn":0},{"key":"revestimento","label":"Revestimento","orc":1100,"fr":0,"fp":0,"fn":0},{"key":"fachada","label":"Fachada","orc":1250,"fr":0,"fp":0,"fn":0},{"key":"arcond","label":"Ar-cond./Elev.","orc":900,"fr":0,"fp":0,"fn":0}]'),
('2026-03-31', 13, 19, 20, -3,  3120, 15000, 15200, 'Alvenaria iniciada nos andares inferiores.',
 '[{"key":"estrutura","label":"Estrutura","orc":3200,"fr":60,"fp":62,"fn":2200},{"key":"alvenaria","label":"Alvenaria","orc":1400,"fr":20,"fp":22,"fn":600},{"key":"eletrica","label":"Inst. Elétrica","orc":980,"fr":5,"fp":5,"fn":150},{"key":"hidraulica","label":"Hidráulica","orc":860,"fr":0,"fp":0,"fn":0},{"key":"revestimento","label":"Revestimento","orc":1100,"fr":0,"fp":0,"fn":0},{"key":"fachada","label":"Fachada","orc":1250,"fr":0,"fp":0,"fn":0},{"key":"arcond","label":"Ar-cond./Elev.","orc":900,"fr":0,"fp":0,"fn":0}]'),
('2026-04-30', 17, 29, 30, -5,  4600, 15000, 15350, 'Instalações iniciadas. Atraso em hidráulica por falta de material.',
 '[{"key":"estrutura","label":"Estrutura","orc":3200,"fr":80,"fp":82,"fn":2900},{"key":"alvenaria","label":"Alvenaria","orc":1400,"fr":45,"fp":48,"fn":850},{"key":"eletrica","label":"Inst. Elétrica","orc":980,"fr":18,"fp":20,"fn":380},{"key":"hidraulica","label":"Hidráulica","orc":860,"fr":10,"fp":12,"fn":200},{"key":"revestimento","label":"Revestimento","orc":1100,"fr":0,"fp":0,"fn":0},{"key":"fachada","label":"Fachada","orc":1250,"fr":0,"fp":0,"fn":0},{"key":"arcond","label":"Ar-cond./Elev.","orc":900,"fr":0,"fp":0,"fn":0}]'),
('2026-05-11', 38, 62, 68, -18, 8700, 15000, 15900, 'Revestimento crítico: −17% de avanço e +23% de custo. Hidráulica e elétrica com defasagem relevante.',
 '[{"key":"estrutura","label":"Estrutura","orc":3200,"fr":100,"fp":100,"fn":3180},{"key":"alvenaria","label":"Alvenaria","orc":1400,"fr":88,"fp":85,"fn":1430},{"key":"eletrica","label":"Inst. Elétrica","orc":980,"fr":60,"fp":72,"fn":1090},{"key":"hidraulica","label":"Hidráulica","orc":860,"fr":54,"fp":68,"fn":940},{"key":"revestimento","label":"Revestimento","orc":1100,"fr":28,"fp":45,"fn":1360},{"key":"fachada","label":"Fachada","orc":1250,"fr":10,"fp":22,"fn":980},{"key":"arcond","label":"Ar-cond./Elev.","orc":900,"fr":35,"fp":40,"fn":720}]');
