const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// Adicionar acwp_producao aos kpis (logo apos a linha do acwp:)
if (!c.includes('acwp_producao')) {
  c = c.replace(
    /acwp: parseFloat\(acwp\.toFixed\(2\)\),/,
    'acwp: parseFloat(acwp.toFixed(2)),\n      acwp_producao: parseFloat(acwpProducao.toFixed(2)),'
  );
}

fs.writeFileSync('pages/api/dashboard-integrado.js', c);
const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('acwp_producao no kpi:', check.includes('acwp_producao: parseFloat') ? 'OK' : 'FAIL');
console.log('cv usa acwpProducao:', check.includes('cv = bcwp - acwpProducao') ? 'OK' : 'FAIL');
