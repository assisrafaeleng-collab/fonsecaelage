const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// Encontrar o bloco EAC Total e adicionar title (tooltip nativo do browser)
// O EAC Total aparece assim no código:
//   <div style={{fontSize:9, color:'#6d675e'}}>EAC Total</div>
//   <div style={{fontSize:13, fontWeight:600, color: eacT > C.orcamentoTotal ? '#B03030' : '#4D9B6A'}}>{fmtR(eacT)}</div>

const old = `<div style={{marginTop:6}}>
                          <div style={{fontSize:9, color:'#6d675e'}}>EAC Total</div>
                          <div style={{fontSize:13, fontWeight:600, color: eacT > C.orcamentoTotal ? '#B03030' : '#4D9B6A'}}>{fmtR(eacT)}</div>
                        </div>`;

const nova = `<div style={{marginTop:6}} title={\`Decomposição do EAC Total:
• Custo Direto Projetado (via CPI): \${fmtR(C.eacDireto)}
• Indiretos Totais: \${fmtR(C.totalIndiretosOrcado)}
• Custo do Atraso: \${fmtR(custoAtr.total)}
─────────────────
• Total: \${fmtR(eacT)}
• Orçamento original: \${fmtR(C.orcamentoTotal)}
• Diferença: \${eacT > C.orcamentoTotal ? '+' : ''}\${fmtR(eacT - C.orcamentoTotal)}\`}>
                          <div style={{fontSize:9, color:'#6d675e'}}>EAC Total ⓘ</div>
                          <div style={{fontSize:13, fontWeight:600, color: eacT > C.orcamentoTotal ? '#B03030' : '#4D9B6A', cursor:'help'}}>{fmtR(eacT)}</div>
                        </div>`;

if (c.includes(old)) {
  c = c.replace(old, nova);
  console.log('Tooltip EAC Total: OK');
} else {
  console.log('FAIL - bloco EAC Total nao encontrado');
}

fs.writeFileSync('components/ImpactoAtraso.jsx', c);

// Verificar
const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
console.log('title decomposicao:', check.includes('Decomposição do EAC Total') ? 'OK' : 'FAIL');
console.log('cursor help:', check.includes("cursor:'help'") ? 'OK' : 'FAIL');
