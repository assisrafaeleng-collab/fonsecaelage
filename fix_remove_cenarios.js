const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// Buscar o bloco de "Cenários de atraso" e removê-lo
// Vai da abertura do div com "Cenários de atraso" até o </div> de fechamento
const startMark = "{/* Cenários de atraso */}";
const endMark = "{/* Projeção pelo SPI */}";

const startIdx = c.indexOf(startMark);
const endIdx = c.indexOf(endMark);

if (startIdx > -1 && endIdx > -1 && endIdx > startIdx) {
  c = c.slice(0, startIdx) + c.slice(endIdx);
  console.log('Bloco removido via markers: OK');
} else {
  console.log('AVISO: markers de comentário não encontrados, tentando por texto');
  // Fallback: buscar pela string "QUANTO CUSTA ATRASAR"
  const p = 'QUANTO CUSTA ATRASAR';
  const idx = c.indexOf(p);
  if (idx > -1) {
    // Achar o início do bloco (div pai antes)
    // Procurar o "<div style={{marginBottom:18}}>" anterior que contém isso
    const inicio = c.lastIndexOf('<div style={{marginBottom:18}}>', idx);
    if (inicio > -1) {
      // Achar o fim: precisa contar divs. Ou usar o próximo "<div style={{marginBottom:18}}>" ou "<div>{/* Projeção"
      const proxSecao = c.indexOf("<div style={{marginBottom:18}}>", idx);
      // Se tem outra seção depois, pegar até ela
      let fim = c.indexOf("{/* Projeção pelo SPI */}", idx);
      if (fim === -1) fim = proxSecao > idx ? proxSecao : -1;
      if (fim > -1) {
        // Voltar até antes do comentário/div pai da próxima seção
        // Encontrar </div> antes do próximo bloco
        c = c.slice(0, inicio) + c.slice(fim);
        console.log('Bloco removido via fallback: OK');
      } else {
        console.log('FAIL - nao consegui achar fim');
      }
    }
  }
}

fs.writeFileSync('components/ImpactoAtraso.jsx', c);

const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
console.log('QUANTO CUSTA ATRASAR removido:', !check.includes('QUANTO CUSTA ATRASAR') ? 'OK' : 'FAIL');
console.log('Cenarios de atraso removidos:', !check.includes('cen.meses === 1') ? 'OK' : 'FAIL');
