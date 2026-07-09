const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// Verificar variaveis disponiveis
const hasCustosRes = c.includes('custosRes.data');
console.log('custosRes disponivel:', hasCustosRes);

// EAPs pré-obra
const EAP_PRE_OBRA_STR = "['18.1.20','18.1.11','18.1.12','18.1.13','18.1.14','18.1.15','18.1.4','18.1.19','18.1.22']";

// Bloco a inserir - vamos usar lancRes ou custosRes conforme disponivel
// Vamos primeiro achar como o lancamentos direto+indireto está
const bloco = `
    // ACWP para EVM: exclui custos pre-obra (terreno, ITBI, registro, escritura, alvaras, projeto estrutural, advocaticios, ART)
    const EAP_PRE_OBRA = ${EAP_PRE_OBRA_STR}
    const todoslancamentos = custosRes.data || []
    const custosPreObra = todoslancamentos.filter(l => EAP_PRE_OBRA.includes(l.codigo_eap)).reduce((s,l) => s + parseFloat(l.valor||0), 0)
    const acwpProducao = Math.max(0, acwp - custosPreObra)
`;

// Insere antes do calculo do CPI
if (!c.includes('acwpProducao')) {
  c = c.replace(
    'const cpi = acwp > 0 ? bcwp / acwp : 1',
    bloco.trim() + '\n    const cpi = acwpProducao > 0 ? bcwp / acwpProducao : 1'
  );
  fs.writeFileSync('pages/api/dashboard-integrado.js', c);
}

const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('acwpProducao:', check.includes('acwpProducao') ? 'OK' : 'FAIL');
console.log('EAP_PRE_OBRA:', check.includes('EAP_PRE_OBRA') ? 'OK' : 'FAIL');
console.log('cpi usa acwpProducao:', check.includes('cpi = acwpProducao > 0') ? 'OK' : 'FAIL');
