const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// Normaliza CRLF para trabalhar, depois mantém
// Trabalhar linha por linha para evitar problema de \r\n
let lines = c.split('\n');

// Achar as linhas do bloco
let idxVel = lines.findIndex(l => l.includes('const velocidadeAtual = avancoFisicoReal'));
let idxDiff = lines.findIndex(l => l.includes('const diffDias = Math.round'));

if (idxVel >= 0 && idxDiff >= 0) {
  // Substituir da linha velocidadeAtual até diffDias (inclusive)
  const novasLinhas = [
    "    const velocidadeAtual = avancoFisicoReal > 0 ? avancoFisicoReal / mesAtual : 0",
    "    // Prazo projetado via SPI (cenario realista: media entre planejado e projetado pelo SPI)",
    "    const PRAZO_PLAN = 20",
    "    const prazoProjSPI = spi > 0.05 ? Math.min(PRAZO_PLAN / spi, 60) : PRAZO_PLAN",
    "    const prazoRealista = (PRAZO_PLAN + Math.max(prazoProjSPI, PRAZO_PLAN)) / 2",
    "    const mesesRestantes = Math.max(prazoRealista - mesAtual, 0)",
    "    const dataProjetadaConclusao = new Date(2026, 6 + Math.ceil(prazoRealista) - 1, 1)",
    "    const dataPlanejadaConclusao = new Date('2028-02-28')",
    "    const diffDias = Math.round((dataProjetadaConclusao - dataPlanejadaConclusao) / (1000 * 60 * 60 * 24))"
  ].map(l => l + '\r');  // manter CRLF

  lines.splice(idxVel, idxDiff - idxVel + 1, ...novasLinhas);
  fs.writeFileSync('pages/api/dashboard-integrado.js', lines.join('\n'));
  console.log('Substituido linhas', idxVel, 'a', idxDiff);
} else {
  console.log('FAIL - idxVel:', idxVel, 'idxDiff:', idxDiff);
}

const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('prazoRealista:', check.includes('prazoRealista') ? 'OK' : 'FAIL');
console.log('prazoProjSPI:', check.includes('prazoProjSPI') ? 'OK' : 'FAIL');
