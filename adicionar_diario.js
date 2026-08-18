// adicionar_diario.js
// Adiciona import e uso do DiarioOcorrencias no Dashboard.jsx sem tocar em mais nada
const fs = require('fs');
const path = 'components/Dashboard.jsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Adicionar o import se não existir
if (!c.includes("import DiarioOcorrencias")) {
  // Insere após o último import de './'
  const importRegex = /(import [^\n]+ from '\.\/[^']+'\r?\n)(?![\s\S]*import [^\n]+ from '\.\/)/;
  if (importRegex.test(c)) {
    c = c.replace(importRegex, `$1import DiarioOcorrencias from './DiarioOcorrencias'\n`);
    console.log('Import adicionado após o último import local: OK');
  } else {
    // Fallback: adiciona no topo depois do 1º import
    c = c.replace(/(import [^\n]+\r?\n)/, `$1import DiarioOcorrencias from './DiarioOcorrencias'\n`);
    console.log('Import adicionado no topo: OK (fallback)');
  }
} else {
  console.log('Import já existia, mantido');
}

// 2. Adicionar <DiarioOcorrencias /> após <PaineisAnalise mes={mesLimite} />
if (!c.includes('<DiarioOcorrencias')) {
  const markerLF = '<PaineisAnalise mes={mesLimite} />';
  if (c.includes(markerLF)) {
    c = c.replace(markerLF, markerLF + '\n      <DiarioOcorrencias />');
    console.log('Componente adicionado após PaineisAnalise: OK');
  } else {
    console.log('AVISO: <PaineisAnalise mes={mesLimite} /> não encontrado. Componente NÃO foi adicionado.');
    console.log('Você precisará adicionar manualmente <DiarioOcorrencias /> onde quiser no return.');
  }
} else {
  console.log('Componente já existia, mantido');
}

fs.writeFileSync(path, c);

// Verificação final
const check = fs.readFileSync(path, 'utf8');
console.log('\n--- Verificação ---');
console.log('import presente:', check.includes("import DiarioOcorrencias") ? 'OK' : 'FAIL');
console.log('uso presente:', check.includes("<DiarioOcorrencias") ? 'OK' : 'FAIL');
