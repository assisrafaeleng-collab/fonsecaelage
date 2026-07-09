const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// 1. BCWS: usar totalDiretos em vez de orcamentoTotal
c = c.replace(
  'const bcws = fisPlanMesAtual ? fisPlanMesAtual.percentual_acumulado * orcamentoTotal : 0',
  'const bcws = fisPlanMesAtual ? fisPlanMesAtual.percentual_acumulado * totalDiretos : 0'
);

// 2. BCWP: usar totalDiretos em vez de orcamentoTotal
c = c.replace(
  'const bcwp = (avancoFisicoReal / 100) * orcamentoTotal',
  'const bcwp = (avancoFisicoReal / 100) * totalDiretos'
);

// 3. ACWP para EVM: usar apenas custos diretos realizados (codigo_eap que NAO comeca com 18.)
// Substituir o bloco antigo de acwpProducao
const oldBloco = `// ACWP para EVM: exclui custos pre-obra (terreno, ITBI, registro, escritura, alvaras, projeto estrutural, advocaticios, ART)
    const EAP_PRE_OBRA = ['18.1.20','18.1.11','18.1.12','18.1.13','18.1.14','18.1.15','18.1.4','18.1.19','18.1.22']
    const todoslancamentos = custosRes.data || []
    const custosPreObra = todoslancamentos.filter(l => EAP_PRE_OBRA.includes(l.codigo_eap)).reduce((s,l) => s + parseFloat(l.valor||0), 0)
    const acwpProducao = Math.max(0, acwp - custosPreObra)`;

const newBloco = `// ACWP para EVM: apenas custos DIRETOS realizados (codigo_eap que nao comeca com 18.)
    const todoslancamentos = custosRes.data || []
    const acwpProducao = todoslancamentos
      .filter(l => l.status === 'Normal' && !(l.codigo_eap || '').startsWith('18.'))
      .reduce((s,l) => s + parseFloat(l.valor||0), 0)`;

if (c.includes(oldBloco)) {
  c = c.replace(oldBloco, newBloco);
  console.log('Bloco ACWP substituido');
} else {
  console.log('AVISO: bloco antigo nao encontrado exato, tentando parcial');
  // fallback simples
  c = c.replace(
    /const custosPreObra = .+\n\s*const acwpProducao = Math\.max\(0, acwp - custosPreObra\)/,
    `const acwpProducao = (custosRes.data || []).filter(l => l.status === 'Normal' && !(l.codigo_eap || '').startsWith('18.')).reduce((s,l) => s + parseFloat(l.valor||0), 0)`
  );
}

// 4. EAC: usar totalDiretos em vez de orcamentoTotal
c = c.replace(
  'const eac = cpi > 0 ? orcamentoTotal / cpi : orcamentoTotal',
  'const eac = cpi > 0 ? totalDiretos / cpi : totalDiretos'
);

// 5. saldoReal: usar totalDiretos
c = c.replace(
  'const saldoReal = orcamentoTotal - eac',
  'const saldoReal = totalDiretos - eac'
);

fs.writeFileSync('pages/api/dashboard-integrado.js', c);

const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('BCWS usa totalDiretos:', check.includes('percentual_acumulado * totalDiretos') ? 'OK' : 'FAIL');
console.log('BCWP usa totalDiretos:', check.includes('(avancoFisicoReal / 100) * totalDiretos') ? 'OK' : 'FAIL');
console.log('ACWP so diretos:', check.includes("!(l.codigo_eap || '').startsWith('18.')") ? 'OK' : 'FAIL');
console.log('EAC usa totalDiretos:', check.includes('totalDiretos / cpi') ? 'OK' : 'FAIL');
console.log('saldoReal usa totalDiretos:', check.includes('saldoReal = totalDiretos - eac') ? 'OK' : 'FAIL');
