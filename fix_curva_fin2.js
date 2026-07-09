const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// Adicionar constante do recorrente mensal antes do loop "const meses = []"
if (!c.includes('RECORRENTE_MENSAL_PLAN')) {
  c = c.replace(
    'const meses = []',
    `// Indiretos recorrentes que compoem a curva financeira (funcao do tempo)
    // Adm local 23500 + Locacoes/Funcionarios ~40632 + Contabeis 1459 + IPTU 463
    const RECORRENTE_MENSAL_PLAN = 23500 + 1459 + 463 + (356776/20) + (455860/20)
    const meses = []`
  );
}

// Substituir o financeiro_planejado: curva fisica × totalDiretos + recorrentes acumulados
c = c.replace(
  'financeiro_planejado: finPlan ? finPlan.valor_acumulado : null,',
  'financeiro_planejado: fisPlan ? (fisPlan.percentual_acumulado * totalDiretos + RECORRENTE_MENSAL_PLAN * i) : null,'
);

// Substituir o financeiro_realizado: usar custo direto realizado acumulado + recorrentes proporcionais
// (mantém a lógica de cortar no mês, mas usa valor_direto se disponível)
c = c.replace(
  'financeiro_realizado: i <= ultimoMesFinReal && finReal ? finReal.valor_acumulado : null,',
  'financeiro_realizado: (i <= mesLimite && i <= ultimoMesFinReal && finReal) ? (finReal.valor_direto != null ? finReal.valor_direto + RECORRENTE_MENSAL_PLAN * i : finReal.valor_acumulado) : null,'
);

fs.writeFileSync('pages/api/dashboard-integrado.js', c);

const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('RECORRENTE const:', check.includes('RECORRENTE_MENSAL_PLAN =') ? 'OK' : 'FAIL');
console.log('fin_plan novo:', check.includes('fisPlan.percentual_acumulado * totalDiretos + RECORRENTE_MENSAL_PLAN') ? 'OK' : 'FAIL');
console.log('fin_real novo:', check.includes('finReal.valor_direto != null') ? 'OK' : 'FAIL');
