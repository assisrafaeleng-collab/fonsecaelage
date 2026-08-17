const fs = require('fs');
let c = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// Trocar projecaoCustoFinal para usar eac_total (obra completa)
c = c.replace(
  'const projecaoCustoFinal = kpis.eac || 0',
  'const projecaoCustoFinal = kpis.eac_total || kpis.eac || 0'
);

fs.writeFileSync('components/Dashboard.jsx', c);
const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
console.log('usa eac_total:', check.includes('kpis.eac_total || kpis.eac') ? 'OK' : 'FAIL');
