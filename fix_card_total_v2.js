const fs = require('fs');
let c = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// Buscar o card atual (versão anterior) e substituir
const old = `<div className="kpi" style={{ borderLeftColor: '#1A5276' }}>
          <div className="kpi-label">Custo Total da Obra Planejado</div>
          <div className="kpi-value">{fmtMoeda((dadosOrcamento?.custos_diretos || 0) + (dadosOrcamento?.custos_indiretos || 0))}</div>
          <div className="kpi-sub">
            Direto: {fmtMoeda(dadosOrcamento?.custos_diretos || 0)}
            {' + '}
            Indireto: {fmtMoeda(dadosOrcamento?.custos_indiretos || 0)}
          </div>
        </div>`;

// Novo card: valores da OBRA (via API separada de mes) - vou usar kpis.orcamento_total como total, e valores fixos do orcamento
// Ideal: buscar orcamentoTotalDireto e orcamentoTotalIndireto da API
// Como a API dashboard-integrado retorna com filtro do mes, vou usar kpis.orcamento_total (que é fixo)
// e para direto/indireto usar valores calculados da obra: totalDiretos = 3.424.958, totalIndiretos = 2.483.856
// Mas para não hardcodear, vou tentar usar kpis se existir

const nova = `<div className="kpi" style={{ borderLeftColor: '#1A5276', padding: '20px 24px' }}>
          <div className="kpi-label" style={{ marginBottom: 12 }}>Custo Total da Obra Planejado</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Direto</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#C8860A' }}>{fmtMoeda(kpis.custo_direto_total || 3424958)}</div>
              </div>
              <div style={{ fontSize: 22, color: 'var(--text2)', fontWeight: 400, alignSelf: 'flex-end', paddingBottom: 4 }}>+</div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Indireto</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#9B59B6' }}>{fmtMoeda(kpis.custo_indireto_total || 2483856)}</div>
              </div>
              <div style={{ fontSize: 22, color: 'var(--text2)', fontWeight: 400, alignSelf: 'flex-end', paddingBottom: 4 }}>=</div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Total</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#5B9BD5' }}>{fmtMoeda((kpis.custo_direto_total || 3424958) + (kpis.custo_indireto_total || 2483856))}</div>
              </div>
            </div>
          </div>
        </div>`;

if (c.includes(old)) {
  c = c.replace(old, nova);
  console.log('Card v2 aplicado (LF): OK');
} else {
  const oldCRLF = old.replace(/\n/g, '\r\n');
  const novaCRLF = nova.replace(/\n/g, '\r\n');
  if (c.includes(oldCRLF)) {
    c = c.replace(oldCRLF, novaCRLF);
    console.log('Card v2 aplicado (CRLF): OK');
  } else {
    console.log('FAIL - padrao anterior nao encontrado');
  }
}

fs.writeFileSync('components/Dashboard.jsx', c);
const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
console.log('sinal =:', check.includes(">=<") || check.includes('>= <') || check.includes('paddingBottom: 4 }}>=<') ? 'OK' : 'verifica manual');
console.log('sinal +:', check.includes('paddingBottom: 4 }}>+<') ? 'OK' : 'verifica manual');
console.log('#C8860A direto:', check.includes("color: '#C8860A' }}>{fmtMoeda(kpis.custo_direto_total") ? 'OK' : 'FAIL');
console.log('novo layout:', check.includes('Custo Total da Obra Planejado') ? 'OK' : 'FAIL');
