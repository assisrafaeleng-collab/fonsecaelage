const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// Localizar e substituir o bloco de cálculo dos 3 cenários
// Procurar pela seção que começa com "let cen3 = null"
const startMark = 'let cen3 = null';
const endMark = 'const prazoProjetado = cen3 ? cen3.realista.prazo : null';

const startIdx = c.indexOf(startMark);
const endIdx = c.indexOf(endMark);

if (startIdx === -1 || endIdx === -1) {
  console.log('FAIL - marcadores nao encontrados. start:', startIdx, 'end:', endIdx);
  process.exit(1);
}

const novoBloco = `let cen3 = null
    if (spi > 0.05) {
      // OTIMISTA: mantém o ritmo atual (SPI), mas nunca termina antes do planejado
      // (não faz sentido projetar entrega antes do prazo com base em início de obra)
      const otimistaPrazo = Math.min(Math.max(PRAZO_ORIGINAL / spi, PRAZO_ORIGINAL), 60)

      // REALISTA: assume perda parcial do ritmo — SPI ponderado (média entre SPI atual e 1,0)
      // + margem de risco de 15%
      const spiRealista = (spi + 1) / 2
      const realistaPrazo = Math.min((PRAZO_ORIGINAL / Math.min(spiRealista, 1)) * 1.15, 60)

      // PESSIMISTA: assume que o ritmo cai para no máximo 1,0 (não conta o "adiantamento" atual)
      // e adiciona margem de risco de 30% (imprevistos, retrabalho, clima)
      const spiPessimista = Math.min(spi, 1)
      const pessimistaPrazo = Math.min((PRAZO_ORIGINAL / spiPessimista) * 1.30, 60)

      cen3 = {
        otimista: { prazo: otimistaPrazo, atraso: Math.max(0, otimistaPrazo - PRAZO_ORIGINAL) },
        realista: { prazo: realistaPrazo, atraso: Math.max(0, realistaPrazo - PRAZO_ORIGINAL) },
        pessimista: { prazo: pessimistaPrazo, atraso: Math.max(0, pessimistaPrazo - PRAZO_ORIGINAL) },
      }
    }
    `;

c = c.slice(0, startIdx) + novoBloco + c.slice(endIdx);

fs.writeFileSync('components/ImpactoAtraso.jsx', c);

const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
console.log('spiRealista:', check.includes('spiRealista') ? 'OK' : 'FAIL');
console.log('spiPessimista:', check.includes('spiPessimista') ? 'OK' : 'FAIL');
console.log('margem 1.30:', check.includes('* 1.30') ? 'OK' : 'FAIL');
