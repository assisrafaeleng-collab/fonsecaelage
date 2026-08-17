const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// Substitui o cálculo de finPlanMesAtual e fisPlanMesAtual para usar o último mês com avanço real
const oldCode = `const finPlanMesAtual = finPlanejada.find(f => f.mes_numero === mesLimite) || finPlanejada[finPlanejada.length - 1]
    const fisPlanMesAtual = fisPlanejada.find(f => f.mes_numero === mesLimite) || fisPlanejada[fisPlanejada.length - 1]`;

const newCode = `// Mes de referencia para BCWS = ultimo mes com avanco fisico real lancado
    // Se nao houver avanco real, usa o mes do filtro
    const mesRefBCWS = fisRealizada.length > 0
      ? Math.min(fisRealizada[fisRealizada.length - 1].mes_numero, mesLimite)
      : mesLimite
    const finPlanMesAtual = finPlanejada.find(f => f.mes_numero === mesRefBCWS) || finPlanejada[finPlanejada.length - 1]
    const fisPlanMesAtual = fisPlanejada.find(f => f.mes_numero === mesRefBCWS) || fisPlanejada[fisPlanejada.length - 1]`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  fs.writeFileSync('pages/api/dashboard-integrado.js', c);
  console.log('OK - BCWS agora usa ultimo mes com avanco real');
} else {
  console.log('FAIL - padrao nao encontrado');
}

// Verify
const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('mesRefBCWS:', check.includes('mesRefBCWS') ? 'OK' : 'FAIL');
