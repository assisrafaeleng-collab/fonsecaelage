const fs = require('fs');
let c = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// 1. Trocar cores dos valores para branco
c = c.replace("color: '#C8860A' }}>{fmtMoeda(kpis.custo_direto_total", "color: '#ece9e4' }}>{fmtMoeda(kpis.custo_direto_total");
c = c.replace("color: '#9B59B6' }}>{fmtMoeda(kpis.custo_indireto_total", "color: '#ece9e4' }}>{fmtMoeda(kpis.custo_indireto_total");
c = c.replace("color: '#5B9BD5' }}>{fmtMoeda((kpis.custo_direto_total", "color: '#ece9e4' }}>{fmtMoeda((kpis.custo_direto_total");

// 2. Trocar as palavras Direto, Indireto, Total para maiúsculas
c = c.replace(">Direto</div>", ">DIRETO</div>");
c = c.replace(">Indireto</div>", ">INDIRETO</div>");
c = c.replace(">Total</div>", ">TOTAL</div>");

fs.writeFileSync('components/Dashboard.jsx', c);
const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
console.log('DIRETO uppercase:', check.includes('>DIRETO</div>') ? 'OK' : 'FAIL');
console.log('INDIRETO uppercase:', check.includes('>INDIRETO</div>') ? 'OK' : 'FAIL');
console.log('TOTAL uppercase:', check.includes('>TOTAL</div>') ? 'OK' : 'FAIL');
console.log('Cor branca (#ece9e4):', (check.match(/color: '#ece9e4' }}>\{fmtMoeda/g) || []).length + ' ocorrências (esperado 3)');
