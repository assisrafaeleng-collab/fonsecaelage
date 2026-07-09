const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// Adicionar custo_direto_total e custo_indireto_total nos kpis
if (!c.includes('custo_direto_total:')) {
  c = c.replace(
    'orcamento_total: orcamentoTotal,',
    `orcamento_total: orcamentoTotal,
      custo_direto_total: parseFloat(totalDiretos.toFixed(2)),
      custo_indireto_total: parseFloat(totalIndiretos.toFixed(2)),`
  );
  console.log('Campos adicionados na API');
}

fs.writeFileSync('pages/api/dashboard-integrado.js', c);
const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('custo_direto_total:', check.includes('custo_direto_total:') ? 'OK' : 'FAIL');
console.log('custo_indireto_total:', check.includes('custo_indireto_total:') ? 'OK' : 'FAIL');
