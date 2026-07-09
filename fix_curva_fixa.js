const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// 1. Remover .lte('mes_numero', mesLimite) das views planejadas (financeira e fisica)
c = c.replace(
  "supabase.from('v_curva_s_financeira_planejada').select('*').eq('obra_id', obra_id).lte('mes_numero', mesLimite).order('mes_numero')",
  "supabase.from('v_curva_s_financeira_planejada').select('*').eq('obra_id', obra_id).order('mes_numero')"
);
c = c.replace(
  "supabase.from('v_curva_s_fisica_planejada').select('*').eq('obra_id', obra_id).lte('mes_numero', mesLimite).order('mes_numero')",
  "supabase.from('v_curva_s_fisica_planejada').select('*').eq('obra_id', obra_id).order('mes_numero')"
);

// 2. Loop vai até 20 (planejado fixo), realizado só ate mesLimite
c = c.replace(
  "for (let i = 1; i <= mesLimite; i++) {",
  "for (let i = 1; i <= 20; i++) {"
);

// 3. Realizado financeiro só aparece até o mês do filtro
c = c.replace(
  "const finReal = finRealizada.find(f => f.mes_numero === i)",
  "const finReal = i <= mesLimite ? finRealizada.find(f => f.mes_numero === i) : null"
);

// 4. Realizado físico só até o filtro - ajustar a condição fisRealFinal
c = c.replace(
  "const fisRealFinal = (ultimaAnoMesFisReal && anoMesDoMes && anoMesDoMes <= ultimaAnoMesFisReal)",
  "const fisRealFinal = (i <= mesLimite && ultimaAnoMesFisReal && anoMesDoMes && anoMesDoMes <= ultimaAnoMesFisReal)"
);

fs.writeFileSync('pages/api/dashboard-integrado.js', c);

const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('view fin sem lte:', !check.includes("financeira_planejada').select('*').eq('obra_id', obra_id).lte") ? 'OK' : 'FAIL');
console.log('view fis sem lte:', !check.includes("fisica_planejada').select('*').eq('obra_id', obra_id).lte") ? 'OK' : 'FAIL');
console.log('loop ate 20:', check.includes('for (let i = 1; i <= 20; i++)') ? 'OK' : 'FAIL');
console.log('finReal cortado:', check.includes('i <= mesLimite ? finRealizada.find') ? 'OK' : 'FAIL');
console.log('fisReal cortado:', check.includes('i <= mesLimite && ultimaAnoMesFisReal') ? 'OK' : 'FAIL');
