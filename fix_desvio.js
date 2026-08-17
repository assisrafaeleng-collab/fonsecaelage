const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// Trocar acwp por acwpProducao no desvioFinanceiro
c = c.replace(
  'const desvioFinanceiro = acwp - bcws',
  'const desvioFinanceiro = acwpProducao - bcws'
);

fs.writeFileSync('pages/api/dashboard-integrado.js', c);
const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('desvio usa acwpProducao:', check.includes('desvioFinanceiro = acwpProducao - bcws') ? 'OK' : 'FAIL');
