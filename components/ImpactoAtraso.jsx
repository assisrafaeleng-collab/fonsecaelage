// components/ImpactoAtraso.jsx
// Painel de impacto do atraso: prazo projetado + custos recorrentes estendidos + Taxa ADM
import React, { useState, useEffect, useMemo } from 'react'

// Estilo global inline para o tooltip
if (typeof window !== 'undefined' && !document.getElementById('eac-tooltip-style')) {
  const style = document.createElement('style')
  style.id = 'eac-tooltip-style'
  style.textContent = `.eac-tooltip-wrap:hover .eac-tooltip-box { display: block !important; }`
  document.head.appendChild(style)
}


const fmtR = v => 'R$ ' + Math.round(v || 0).toLocaleString('pt-BR')

const PRAZO_ORIGINAL = 20
const TAXA_ADM_PCT = 0.12

// Categorias indiretas recorrentes (mes_desembolso = 0, distribuídas linearmente)
const INDIRETOS_RECORRENTES = [
  'Administração local da obra (engenheiro)',
  'Serviços Contabeis',
  'IPTU Terreno',
]

export default function ImpactoAtraso({ mes }) {
  const [open, setOpen] = useState(false)
  const [kpis, setKpis] = useState(null)
  const [dados, setDados] = useState([])
  const [indiretos, setIndiretos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [k, d, ind] = await Promise.all([
          fetch(`/api/dashboard-integrado?mes=${mes}`).then(r => r.json()),
          fetch('/dados.json').then(r => r.json()),
          fetch(`/api/custos-indiretos-planejados?mes=20`).then(r => r.json()),
        ])
        setKpis(k.kpis || null)
        setDados(d || [])
        setIndiretos(ind.categorias || [])
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [mes])

  const calc = useMemo(() => {
    if (!kpis || !dados.length) return null

    const spi = kpis.spi || 0
    const avancoReal = kpis.avanco_fisico_realizado || 0

    // ── Custo recorrente mensal ──
    // Indiretos recorrentes: valor_total / 20
    let recIndireto = 0
    const detalheInd = []
    indiretos.forEach(c => {
      if (INDIRETOS_RECORRENTES.includes(c.categoria)) {
        const mensal = (c.valor_total_projeto || 0) / PRAZO_ORIGINAL
        recIndireto += mensal
        detalheInd.push({ nome: c.categoria, mensal })
      }
    })

    // Diretos recorrentes: grupos 17 (locações) e 18 (funcionários) — custo mensal = c / duração
    let recDireto = 0
    const detalheDir = {}
    dados.forEach(r => {
      if (r.g === 17 || r.g === 18) {
        const dur = Math.max((r.b - r.a + 1), 1)
        const mensal = (r.c || 0) / dur
        recDireto += mensal
        const key = r.g === 17 ? 'Locações (equip. + carro)' : 'Funcionários Diretos'
        detalheDir[key] = (detalheDir[key] || 0) + mensal
      }
    })

    const recorrenteMensal = recIndireto + recDireto

    // ── Prazo projetado: 3 cenários ──
    const cpi = kpis.cpi || 1
    const spiConfiavel = avancoReal >= 3  // pelo menos 3% físico executado
    let cen3 = null
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
    const prazoProjetado = cen3 ? cen3.realista.prazo : null
    const mesesAtraso = cen3 ? cen3.realista.atraso : null

    // ── Custo do atraso ──
    function custoAtraso(meses) {
      const base = meses * recorrenteMensal
      const taxaAdm = base * TAXA_ADM_PCT
      return { base, taxaAdm, total: base + taxaAdm }
    }

    // Cenários fixos para referência (1, 3, 6 meses)
    const cenarios = [1, 3, 6].map(m => ({ meses: m, ...custoAtraso(m) }))

    // Cenário projetado pelo SPI
    const projetado = mesesAtraso != null ? { meses: mesesAtraso, ...custoAtraso(mesesAtraso) } : null

    // ── EAC Total da obra ──
    const totalIndiretosOrcado = indiretos.reduce((s,c) => s + (c.valor_total_projeto || 0), 0)
    const eacDireto = kpis.eac || 0
    const eacTotal = projetado
      ? eacDireto + totalIndiretosOrcado + projetado.total
      : null
    const orcamentoTotal = kpis.orcamento_total || 0

    return {
      spi, spiConfiavel, avancoReal,
      recorrenteMensal, recIndireto, recDireto, detalheInd, detalheDir,
      prazoProjetado, mesesAtraso, projetado, cenarios, cen3,
      eacDireto, totalIndiretosOrcado, eacTotal, orcamentoTotal,
    }
  }, [kpis, dados, indiretos])

  if (loading) return null
  if (!calc) return null

  const C = calc

  return (
    <div className="card" style={{padding:0, overflow:'hidden', marginBottom:16}}>
      <div
        style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', cursor:'pointer', userSelect:'none', borderBottom: open ? '1px solid var(--border, #2A2A2A)' : 'none'}}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{fontSize:15, fontWeight:700, color:'var(--text1, #E8E8E8)', display:'flex', alignItems:'center', gap:10}}>
          <span>💸</span>
          <span>Impacto do Atraso — Custo Recorrente & Projeção</span>
          {C.mesesAtraso > 0.5 && (
            <span style={{fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:700, background:'#B03030', color:'#fff'}}>
              +{C.mesesAtraso.toFixed(1)} meses projetados
            </span>
          )}
        </div>
        <span style={{color:'#6d675e', fontSize:12}}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{padding:'20px 24px'}}>

          {/* Custo recorrente mensal */}
          <div style={{marginBottom:18}}>
            <div style={{fontSize:11, color:'var(--text2, #A8A8A8)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10, fontWeight:600}}>
              ⏱ Custo recorrente — cada mês de obra custa isto, independente do avanço
            </div>
            <div style={{display:'flex', alignItems:'baseline', gap:12, marginBottom:10}}>
              <span style={{fontSize:32, fontWeight:700, color:'#e6a338'}}>{fmtR(C.recorrenteMensal)}</span>
              <span style={{fontSize:12, color:'#a09a90'}}>/mês</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:10}}>
              {C.detalheInd.map((d, i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text2, #a09a90)', padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8}}>
                  <span>{d.nome}</span>
                  <span style={{color:'#ece9e4', fontWeight:600}}>{fmtR(d.mensal)}/m</span>
                </div>
              ))}
              {Object.entries(C.detalheDir).map(([nome, mensal], i) => (
                <div key={'d'+i} style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text2, #a09a90)', padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8}}>
                  <span>{nome}</span>
                  <span style={{color:'#ece9e4', fontWeight:600}}>{fmtR(mensal)}/m</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cenários de atraso */}
          <div style={{marginBottom:18}}>
            <div style={{fontSize:11, color:'var(--text2, #A8A8A8)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10, fontWeight:600}}>
              📉 Quanto custa atrasar? (recorrentes + Taxa ADM 12%)
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
              {C.cenarios.map((cen, i) => (
                <div key={i} style={{background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 18px', borderLeft:'3px solid #C8860A'}}>
                  <div style={{fontSize:10, color:'#6d675e', marginBottom:4}}>Atraso de {cen.meses} {cen.meses === 1 ? 'mês' : 'meses'}</div>
                  <div style={{fontSize:22, fontWeight:700, color:'#C8860A'}}>{fmtR(cen.total)}</div>
                  <div style={{fontSize:9, color:'#6d675e', marginTop:2}}>{fmtR(cen.base)} + {fmtR(cen.taxaAdm)} ADM</div>
                </div>
              ))}
            </div>
          </div>

          {/* Projeção pelo SPI */}
          <div>
            <div style={{fontSize:11, color:'var(--text2, #A8A8A8)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10, fontWeight:600}}>
              🔮 Projeção no ritmo atual (SPI {C.spi.toFixed(2)})
            </div>
            {!C.spiConfiavel ? (
              <div style={{background:'rgba(200,134,10,0.10)', border:'1px solid #C8860A44', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#ece9e4', lineHeight:1.6}}>
                ⚠️ Avanço físico ainda muito baixo ({C.avancoReal.toFixed(1)}%) para projetar prazo com confiança.
                A projeção pelo SPI só se torna estatisticamente válida com ~3% ou mais de obra executada.
                Use os cenários fixos acima como referência de impacto.
              </div>
            ) : C.cen3 && (
              <div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:12}}>
                  {[
                    { key:'otimista', label:'Otimista (SPI puro)', desc:'mantém eficiência atual', cor:'#4D9B6A', data: C.cen3.otimista },
                    { key:'realista', label:'Realista (média)', desc:'ponderado entre planejado e pior caso', cor:'#C8860A', data: C.cen3.realista },
                    { key:'pessimista', label:'Pessimista (SPI × CPI)', desc:'penaliza prazo e custo juntos', cor:'#B03030', data: C.cen3.pessimista },
                  ].map(cen => {
                    const custoAtr = { base: cen.data.atraso * C.recorrenteMensal, taxaAdm: cen.data.atraso * C.recorrenteMensal * 0.12 }
                    custoAtr.total = custoAtr.base + custoAtr.taxaAdm
                    const eacT = C.eacDireto + C.totalIndiretosOrcado + custoAtr.total
                    return (
                      <div key={cen.key} style={{background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'18px 20px', borderLeft:`3px solid ${cen.cor}`}}>
                        <div style={{fontSize:10, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:6}}>{cen.label}</div>
                        <div style={{fontSize:24, fontWeight:700, color: cen.cor, marginBottom:4}}>{cen.data.prazo.toFixed(1)} meses</div>
                        <div style={{fontSize:9, color:'#6d675e', marginBottom:10}}>{cen.data.atraso > 0.05 ? `+${cen.data.atraso.toFixed(1)}m atraso` : 'no prazo ou adiantado'} · {cen.desc}</div>
                        <div style={{borderTop:'1px solid #2a2a31', paddingTop:8}}>
                          <div style={{fontSize:9, color:'#6d675e'}}>Custo do atraso</div>
                          <div style={{fontSize:13, fontWeight:600, color: cen.cor}}>{fmtR(custoAtr.total)}</div>
                        </div>
                        <div style={{marginTop:6, position:'relative'}} className="eac-tooltip-wrap">
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
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{fontSize:10, color:'#6d675e', textAlign:'center', fontStyle:'italic'}}>
                  Orçamento original: {fmtR(C.orcamentoTotal)} · SPI atual: {C.spi.toFixed(2)} · CPI atual: {C.cpi?.toFixed?.(2) || (kpis.cpi || 1).toFixed(2)}
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
