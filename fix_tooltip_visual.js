const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// Substituir o bloco com tooltip nativo por um tooltip visual customizado
const old = `<div style={{marginTop:6}} title={\`Decomposição do EAC Total:
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

const nova = `<div style={{marginTop:6, position:'relative'}} className="eac-tooltip-wrap">
                          <div style={{fontSize:9, color:'#6d675e'}}>EAC Total <span style={{color:'#e6a338'}}>ⓘ</span></div>
                          <div style={{fontSize:13, fontWeight:600, color: eacT > C.orcamentoTotal ? '#B03030' : '#4D9B6A', cursor:'help'}}>{fmtR(eacT)}</div>
                          <div className="eac-tooltip-box" style={{
                            position:'absolute', bottom:'calc(100% + 8px)', left:0, right:0,
                            background:'#0f0f11', border:'1px solid #3a3a44', borderRadius:8,
                            padding:'10px 12px', fontSize:11, color:'#ece9e4', lineHeight:1.6,
                            zIndex:1000, boxShadow:'0 8px 20px rgba(0,0,0,0.6)',
                            display:'none', minWidth:220,
                          }}>
                            <div style={{fontWeight:700, color:'#e6a338', marginBottom:6, fontSize:10, textTransform:'uppercase', letterSpacing:.5}}>Decomposição do EAC Total</div>
                            <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                              <span style={{color:'#a09a90'}}>Custo Direto (÷CPI)</span>
                              <span style={{fontWeight:600}}>{fmtR(C.eacDireto)}</span>
                            </div>
                            <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                              <span style={{color:'#a09a90'}}>Indiretos Totais</span>
                              <span style={{fontWeight:600}}>{fmtR(C.totalIndiretosOrcado)}</span>
                            </div>
                            <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                              <span style={{color:'#a09a90'}}>Custo do Atraso</span>
                              <span style={{fontWeight:600}}>{fmtR(custoAtr.total)}</span>
                            </div>
                            <div style={{borderTop:'1px solid #3a3a44', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between', gap:12}}>
                              <span style={{color:'#ece9e4', fontWeight:600}}>Total EAC</span>
                              <span style={{fontWeight:700, color: eacT > C.orcamentoTotal ? '#B03030' : '#4D9B6A'}}>{fmtR(eacT)}</span>
                            </div>
                            <div style={{display:'flex', justifyContent:'space-between', gap:12, marginTop:4}}>
                              <span style={{color:'#6d675e'}}>Orçamento original</span>
                              <span style={{color:'#a09a90'}}>{fmtR(C.orcamentoTotal)}</span>
                            </div>
                            <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                              <span style={{color:'#6d675e'}}>Diferença</span>
                              <span style={{fontWeight:600, color: eacT > C.orcamentoTotal ? '#B03030' : '#4D9B6A'}}>
                                {eacT > C.orcamentoTotal ? '+' : ''}{fmtR(eacT - C.orcamentoTotal)}
                              </span>
                            </div>
                          </div>
                        </div>`;

if (c.includes(old)) {
  c = c.replace(old, nova);
  console.log('Tooltip visual: OK');
} else {
  console.log('FAIL - bloco anterior nao encontrado');
}

// Adicionar CSS para mostrar tooltip on hover
if (!c.includes('.eac-tooltip-wrap:hover .eac-tooltip-box')) {
  const styleTag = `
// Estilo global inline para o tooltip
if (typeof window !== 'undefined' && !document.getElementById('eac-tooltip-style')) {
  const style = document.createElement('style')
  style.id = 'eac-tooltip-style'
  style.textContent = \`.eac-tooltip-wrap:hover .eac-tooltip-box { display: block !important; }\`
  document.head.appendChild(style)
}
`;
  // Insere logo após os imports
  c = c.replace(
    "import React, { useState, useEffect, useMemo } from 'react'",
    "import React, { useState, useEffect, useMemo } from 'react'\n" + styleTag
  );
  console.log('CSS injetado: OK');
}

fs.writeFileSync('components/ImpactoAtraso.jsx', c);

const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
console.log('eac-tooltip-wrap:', check.includes('eac-tooltip-wrap') ? 'OK' : 'FAIL');
console.log('CSS style:', check.includes('eac-tooltip-style') ? 'OK' : 'FAIL');
