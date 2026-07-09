const fs = require('fs');
let c = fs.readFileSync('components/Dashboard.jsx', 'utf8');

const old = `<div className="kpi kpi-clickable" style={{ borderLeftColor: '#1A5276' }} onClick={() => router.push('/orcamento')}>
          <div className="kpi-label">Custo Total</div>
          <div className="kpi-value">{fmtMoeda(kpis.orcamento_total)}</div>
          <div className="kpi-sub">{mesLimite === 20 ? "Planejado para 20 meses" : \`Acumulado até M\${mesLimite}\`} · 📊 Ver detalhes</div>
        </div>`;

const nova = `<div className="kpi" style={{ borderLeftColor: '#1A5276' }}>
          <div className="kpi-label">Custo Total da Obra Planejado</div>
          <div className="kpi-value">{fmtMoeda((dadosOrcamento?.custos_diretos || 0) + (dadosOrcamento?.custos_indiretos || 0))}</div>
          <div className="kpi-sub">
            Direto: {fmtMoeda(dadosOrcamento?.custos_diretos || 0)}
            {' + '}
            Indireto: {fmtMoeda(dadosOrcamento?.custos_indiretos || 0)}
          </div>
        </div>`;

if (c.includes(old)) {
  c = c.replace(old, nova);
  console.log('Card Custo Total substituido: OK');
} else {
  console.log('FAIL - padrao nao encontrado, tentando CRLF');
  const oldCRLF = old.replace(/\n/g, '\r\n');
  const novaCRLF = nova.replace(/\n/g, '\r\n');
  if (c.includes(oldCRLF)) {
    c = c.replace(oldCRLF, novaCRLF);
    console.log('CRLF: OK');
  } else {
    console.log('FAIL total');
  }
}

fs.writeFileSync('components/Dashboard.jsx', c);
const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
console.log('sem kpi-clickable no total:', !check.includes('kpi-clickable" style={{ borderLeftColor: \'#1A5276\'') ? 'OK' : 'FAIL');
console.log('novo titulo:', check.includes('Custo Total da Obra Planejado') ? 'OK' : 'FAIL');
console.log('decomposicao Direto+Indireto:', check.includes('Direto: {fmtMoeda(dadosOrcamento?.custos_diretos') ? 'OK' : 'FAIL');
