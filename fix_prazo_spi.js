const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

const old = `const velocidadeAtual = avancoFisicoReal > 0 ? avancoFisicoReal / mesAtual : 0
    const fisicoPendente = Math.max(100 - avancoFisicoReal, 0)
    const mesesRestantes = velocidadeAtual > 0 ? fisicoPendente / velocidadeAtual : 0
    // Obra termina Fev/2028 (M20)
    const dataProjetadaConclusao = new Date(2026, 5 + mesAtual + Math.ceil(mesesRestantes), 1)
    const dataPlanejadaConclusao = new Date('2028-02-28')
    const diffDias = Math.round((dataProjetadaConclusao - dataPlanejadaConclusao) / (1000 * 60 * 60 * 24))`;

const nova = `const velocidadeAtual = avancoFisicoReal > 0 ? avancoFisicoReal / mesAtual : 0
    // Prazo projetado via SPI (cenario realista: media entre planejado e projetado pelo SPI)
    const PRAZO_PLAN = 20
    const prazoProjSPI = spi > 0.05 ? Math.min(PRAZO_PLAN / spi, 60) : PRAZO_PLAN
    const prazoRealista = (PRAZO_PLAN + Math.max(prazoProjSPI, PRAZO_PLAN)) / 2
    const mesesRestantes = Math.max(prazoRealista - mesAtual, 0)
    // Obra comeca Jul/2026 (M1). Conclusao projetada = inicio + prazoRealista meses
    const dataProjetadaConclusao = new Date(2026, 6 + Math.ceil(prazoRealista) - 1, 1)
    const dataPlanejadaConclusao = new Date('2028-02-28')
    const diffDias = Math.round((dataProjetadaConclusao - dataPlanejadaConclusao) / (1000 * 60 * 60 * 24))`;

if (c.includes(old)) {
  c = c.replace(old, nova);
  console.log('Bloco prazo substituido: OK');
} else {
  console.log('FAIL - bloco nao encontrado');
}

fs.writeFileSync('pages/api/dashboard-integrado.js', c);
const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('prazoRealista:', check.includes('prazoRealista') ? 'OK' : 'FAIL');
console.log('prazoProjSPI:', check.includes('prazoProjSPI') ? 'OK' : 'FAIL');
