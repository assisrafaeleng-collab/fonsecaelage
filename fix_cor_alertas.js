const fs = require('fs');
let c = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');

// Voltar cor de fundo original (amarelo/vermelho semitransparente)
const old = `background: 'var(--bg2)',
            border: '1px solid var(--border)',`;

const nova = `background: a.nivel==='alto' ? 'rgba(176,48,48,0.12)' : 'rgba(200,134,10,0.10)',
            border: \`1px solid \${a.nivel==='alto' ? '#B0303055' : '#C8860A44'}\`,`;

if (c.includes(old)) {
  c = c.replace(old, nova);
  console.log('Cor de fundo restaurada: OK');
} else {
  console.log('AVISO: padrao nao encontrado');
}

fs.writeFileSync('components/PaineisAnalise.jsx', c);
const check = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');
console.log('cor semi-amarelo:', check.includes("rgba(200,134,10,0.10)") ? 'OK' : 'FAIL');
console.log('checkbox mantido:', check.includes('type="checkbox"') ? 'OK' : 'FAIL');
