const fs = require('fs');
let c = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');

// Restaurar a lógica original de cores (verde/amarelo/vermelho)
const atual = `function cellColor(cell) {
    if (!cell) return 'transparent'
    const { real } = cell
    if (real === 0) return '#1a1a20'  // não executado ainda
    // Verde com intensidade pelo % executado
    const alpha = 0.20 + (real/100) * 0.60
    return \`rgba(77,155,106,\${alpha})\`
  }`;

const original = `function cellColor(cell) {
    if (!cell) return 'transparent'
    const { real, plan } = cell
    if (plan === 0 && real === 0) return '#1a1a20'  // futuro
    if (real >= plan - 5) {
      // Em dia ou adiantado: verde com intensidade pelo avanço
      const alpha = 0.15 + (real/100) * 0.55
      return \`rgba(77,155,106,\${alpha})\`
    }
    if (real >= plan * 0.6) return 'rgba(200,134,10,0.45)'  // levemente atrasado
    return 'rgba(176,48,48,0.5)'  // muito atrasado
  }`;

if (c.includes(atual)) {
  c = c.replace(atual, original);
  console.log('cellColor restaurado: OK');
} else {
  console.log('AVISO: já pode estar original');
}

fs.writeFileSync('components/PaineisAnalise.jsx', c);
const check = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');
console.log('amarelo (atenção):', check.includes("rgba(200,134,10,0.45)") ? 'OK' : 'FAIL');
console.log('vermelho (atraso):', check.includes("rgba(176,48,48,0.5)") ? 'OK' : 'FAIL');
