const fs = require('fs');
let c = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');

// 1. Adicionar cálculo de eac_total antes do "const kpis"
if (!c.includes('const eacTotal')) {
  const marker = 'const kpis = {';
  const insercao = `// EAC Total: obra completa (direto + indiretos + custo do atraso no cenario realista)
    const _spiRealista = spi > 0.05 ? (spi + 1) / 2 : 1
    const _prazoRealista = Math.min((20 / Math.min(_spiRealista, 1)) * 1.15, 60)
    const _atrasoRealista = Math.max(0, _prazoRealista - 20)
    const _recorrenteMensal = 66054 // adm + locacoes + funcionarios + contabeis + iptu
    const _custoAtrasoRealista = _atrasoRealista * _recorrenteMensal * 1.12 // + 12% taxa ADM
    const eacTotal = eac + totalIndiretos + _custoAtrasoRealista

    ${marker}`;
  c = c.replace(marker, insercao);
}

// 2. Adicionar eac_total no retorno dos kpis
if (!c.includes('eac_total:')) {
  c = c.replace(
    'eac: parseFloat(eac.toFixed(2)),',
    'eac: parseFloat(eac.toFixed(2)),\n      eac_total: parseFloat(eacTotal.toFixed(2)),'
  );
}

fs.writeFileSync('pages/api/dashboard-integrado.js', c);

const check = fs.readFileSync('pages/api/dashboard-integrado.js', 'utf8');
console.log('const eacTotal:', check.includes('const eacTotal') ? 'OK' : 'FAIL');
console.log('eac_total nos kpis:', check.includes('eac_total: parseFloat') ? 'OK' : 'FAIL');
