const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// 1. Substituir bloco de cálculo do prazo por 3 cenários
const oldCalc = `    // ── Prazo projetado ──
    // Guarda de sanidade: SPI só é confiável com avanço mínimo; antes disso, mostrar cenários
    const spiConfiavel = avancoReal >= 3  // pelo menos 3% físico executado
    let prazoProjetado = null
    let mesesAtraso = null
    if (spi > 0.05) {
      prazoProjetado = Math.min(PRAZO_ORIGINAL / spi, 60)  // cap 60 meses
      mesesAtraso = Math.max(0, prazoProjetado - PRAZO_ORIGINAL)
    }`;

const newCalc = `    // ── Prazo projetado: 3 cenários ──
    const cpi = kpis.cpi || 1
    const spiConfiavel = avancoReal >= 3  // pelo menos 3% físico executado
    let cen3 = null
    if (spi > 0.05) {
      // Otimista: só SPI (mantém eficiência atual)
      const otimistaPrazo = Math.min(PRAZO_ORIGINAL / spi, 60)
      // Pessimista: SPI × CPI (ponderação clássica EAC penalizada)
      // Quando SPI×CPI > 1 (obra bem), força mínimo do prazo planejado (nao terminar antes por otimismo)
      const fator = spi * cpi
      const pessimistaPrazo = fator > 0.05
        ? Math.min(Math.max(PRAZO_ORIGINAL / fator, PRAZO_ORIGINAL * 0.9), 60)
        : 60
      // Realista: média entre planejado e pior cenário observado
      const piorObs = Math.max(otimistaPrazo, pessimistaPrazo, PRAZO_ORIGINAL)
      const realistaPrazo = (PRAZO_ORIGINAL + piorObs) / 2
      cen3 = {
        otimista: { prazo: otimistaPrazo, atraso: Math.max(0, otimistaPrazo - PRAZO_ORIGINAL) },
        realista: { prazo: realistaPrazo, atraso: Math.max(0, realistaPrazo - PRAZO_ORIGINAL) },
        pessimista: { prazo: pessimistaPrazo, atraso: Math.max(0, pessimistaPrazo - PRAZO_ORIGINAL) },
      }
    }
    const prazoProjetado = cen3 ? cen3.realista.prazo : null
    const mesesAtraso = cen3 ? cen3.realista.atraso : null`;

if (c.includes('const spiConfiavel = avancoReal >= 3')) {
  c = c.replace(oldCalc, newCalc);
  console.log('Bloco calculo substituido: OK');
} else {
  console.log('FAIL - bloco calculo');
}

// 2. Adicionar cen3 ao retorno do useMemo (procurar por "projetado, cenarios,")
c = c.replace(
  'prazoProjetado, mesesAtraso, projetado, cenarios,',
  'prazoProjetado, mesesAtraso, projetado, cenarios, cen3,'
);

// 3. Substituir bloco de exibição da projeção
const oldDisplay = `) : C.projetado && (
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:10}}>
                <div style={{background:'#1a1a20', borderRadius:10, padding:'14px 16px', borderLeft:'3px solid #B03030'}}>
                  <div style={{fontSize:10, color:'#6d675e', marginBottom:4}}>Prazo projetado</div>
                  <div style={{fontSize:20, fontWeight:700, color:'#B03030'}}>{C.prazoProjetado.toFixed(1)} meses</div>
                  <div style={{fontSize:10, color:'#6d675e'}}>vs {PRAZO_ORIGINAL} planejados (+{C.mesesAtraso.toFixed(1)}m)</div>
                </div>
                <div style={{background:'#1a1a20', borderRadius:10, padding:'14px 16px', borderLeft:'3px solid #B03030'}}>
                  <div style={{fontSize:10, color:'#6d675e', marginBottom:4}}>Custo do atraso projetado</div>
                  <div style={{fontSize:20, fontWeight:700, color:'#B03030'}}>{fmtR(C.projetado.total)}</div>
                  <div style={{fontSize:10, color:'#6d675e'}}>{fmtR(C.projetado.base)} recorrentes + {fmtR(C.projetado.taxaAdm)} ADM</div>
                </div>
                <div style={{background:'#1a1a20', borderRadius:10, padding:'14px 16px', borderLeft:\`3px solid \${C.eacTotal > C.orcamentoTotal ? '#B03030' : '#4D9B6A'}\`}}>
                  <div style={{fontSize:10, color:'#6d675e', marginBottom:4}}>EAC Total da obra (com atraso)</div>
                  <div style={{fontSize:20, fontWeight:700, color: C.eacTotal > C.orcamentoTotal ? '#B03030' : '#4D9B6A'}}>{fmtR(C.eacTotal)}</div>
                  <div style={{fontSize:10, color:'#6d675e'}}>vs orçamento {fmtR(C.orcamentoTotal)}</div>
                </div>
              </div>
            )}`;

const newDisplay = `) : C.cen3 && (
              <div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:12}}>
                  {[
                    { key:'otimista', label:'Otimista (SPI puro)', desc:'mantém eficiência atual', cor:'#4D9B6A', data: C.cen3.otimista },
                    { key:'realista', label:'Realista (média)', desc:'ponderado entre planejado e pior caso', cor:'#C8860A', data: C.cen3.realista },
                    { key:'pessimista', label:'Pessimista (SPI × CPI)', desc:'penaliza prazo e custo juntos', cor:'#B03030', data: C.cen3.pessimista },
                  ].map(cen => {
                    const custoAtr = { base: cen.data.atraso * C.recorrenteMensal, taxaAdm: cen.data.atraso * C.recorrenteMensal * ${'0.12'} }
                    custoAtr.total = custoAtr.base + custoAtr.taxaAdm
                    const eacT = C.eacDireto + C.totalIndiretosOrcado + custoAtr.total
                    return (
                      <div key={cen.key} style={{background:'#1a1a20', borderRadius:10, padding:'14px 16px', borderLeft:\`3px solid \${cen.cor}\`}}>
                        <div style={{fontSize:10, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:6}}>{cen.label}</div>
                        <div style={{fontSize:20, fontWeight:700, color: cen.cor, marginBottom:2}}>{cen.data.prazo.toFixed(1)} meses</div>
                        <div style={{fontSize:9, color:'#6d675e', marginBottom:10}}>{cen.data.atraso > 0.05 ? \`+\${cen.data.atraso.toFixed(1)}m atraso\` : 'no prazo ou adiantado'} · {cen.desc}</div>
                        <div style={{borderTop:'1px solid #2a2a31', paddingTop:8}}>
                          <div style={{fontSize:9, color:'#6d675e'}}>Custo do atraso</div>
                          <div style={{fontSize:13, fontWeight:600, color: cen.cor}}>{fmtR(custoAtr.total)}</div>
                        </div>
                        <div style={{marginTop:6}}>
                          <div style={{fontSize:9, color:'#6d675e'}}>EAC Total</div>
                          <div style={{fontSize:13, fontWeight:600, color: eacT > C.orcamentoTotal ? '#B03030' : '#4D9B6A'}}>{fmtR(eacT)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{fontSize:10, color:'#6d675e', textAlign:'center', fontStyle:'italic'}}>
                  Orçamento original: {fmtR(C.orcamentoTotal)} · SPI atual: {C.spi.toFixed(2)} · CPI atual: {C.cpi?.toFixed?.(2) || (kpis.cpi || 1).toFixed(2)}
                </div>
              </div>
            )}`;

if (c.includes(") : C.projetado && (")) {
  c = c.replace(oldDisplay, newDisplay);
  console.log('Bloco display substituido: OK');
} else {
  console.log('FAIL - display');
}

fs.writeFileSync('components/ImpactoAtraso.jsx', c);

const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
console.log('cen3:', check.includes('const cen3') ? 'OK' : 'FAIL');
console.log('Otimista:', check.includes('Otimista (SPI puro)') ? 'OK' : 'FAIL');
console.log('Realista:', check.includes('Realista (média)') ? 'OK' : 'FAIL');
console.log('Pessimista:', check.includes('Pessimista (SPI × CPI)') ? 'OK' : 'FAIL');
