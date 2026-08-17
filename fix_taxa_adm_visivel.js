const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// Trocar o bloco de "Custo da margem de risco" para mostrar decomposição base + ADM
const old = `<div style={{borderTop:'1px solid #2a2a31', paddingTop:8}}>
                          <div style={{fontSize:9, color:'#6d675e'}}>Custo da margem de risco</div>
                          <div style={{fontSize:13, fontWeight:600, color: cen.cor}}>{fmtR(custoAtr.total)}</div>
                        </div>`;

const nova = `<div style={{borderTop:'1px solid #2a2a31', paddingTop:8}}>
                          <div style={{fontSize:9, color:'#6d675e'}}>Custo da margem de risco</div>
                          <div style={{fontSize:13, fontWeight:600, color: cen.cor}}>{fmtR(custoAtr.total)}</div>
                          {custoAtr.total > 0 && (
                            <div style={{fontSize:9, color:'#6d675e', marginTop:2}}>
                              {fmtR(custoAtr.base)} recorrentes + {fmtR(custoAtr.taxaAdm)} Taxa ADM (12%)
                            </div>
                          )}
                        </div>`;

if (c.includes(old)) {
  c = c.replace(old, nova);
  console.log('Decomposicao adicionada: OK');
} else {
  console.log('FAIL - padrao nao encontrado');
}

fs.writeFileSync('components/ImpactoAtraso.jsx', c);
const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
console.log('Taxa ADM (12%) visivel:', check.includes('Taxa ADM (12%)') ? 'OK' : 'FAIL');
