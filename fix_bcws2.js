const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// Regex mais flexível para variações de espaço/quebra
const pattern = /const finPlanMesAtual = finPlanejada\.find\(f => f\.mes_numero === mesLimite\) \|\| finPlanejada\[finPlanejada\.length - 1\]\s*\r?\n\s*const fisPlanMesAtual = fisPlanejada\.find\(f => f\.mes_numero === mesLimite\) \|\| fisPlanejada\[fisPlanejada\.length - 1\]/;

const replacement = `const mesRefBCWS = fisRealizada.length > 0
      ? Math.min(fisRealizada[fisRealizada.length - 1].mes_numero, mesLimite)
      : mesLimite
    const finPlanMesAtual = finPlanejada.find(f => f.mes_numero === mesRefBCWS) || finPlanejada[finPlanejada.length - 1]
    const fisPlanMesAtual = fisPlanejada.find(f => f.mes_numero === mesRefBCWS) || fisPlanejada[fisPlanejada.length - 1]`;

if (pattern.test(c)) {
  c = c.replace(pattern, replacement);
  fs.writeFileSync('pages/api/dashboard-integrado.js', c);
  console.log('OK via regex');
} else {
  console.log('regex FAIL - trying line by line');
  // Fallback: replace line by line
  let lines = c.split('\n');
  let idx1 = lines.findIndex(l => l.includes('const finPlanMesAtual = finPlanejada.find'));
  if (idx1 >= 0) {
    // Insert mesRefBCWS before
    lines.splice(idx1, 0, '    const mesRefBCWS = fisRealizada.length > 0 ? Math.min(fisRealizada[fisRealizada.length - 1].mes_numero, mesLimite) : mesLimite');
    // Now the following lines need mesLimite -> mesRefBCWS in both finPlan/fisPlan
    lines[idx1+1] = lines[idx1+1].replace('=== mesLimite)', '=== mesRefBCWS)');
    lines[idx1+2] = lines[idx1+2].replace('=== mesLimite)', '=== mesRefBCWS)');
    fs.writeFileSync('pages/api/dashboard-integrado.js', lines.join('\n'));
    console.log('OK via fallback');
  }
}

const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('mesRefBCWS:', check.includes('mesRefBCWS') ? 'OK' : 'FAIL');
