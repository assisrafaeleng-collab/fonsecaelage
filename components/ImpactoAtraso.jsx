// components/ImpactoAtraso.jsx
// Painel de impacto do atraso: prazo projetado + custos recorrentes estendidos + Taxa ADM
import React, { useState, useEffect, useMemo } from 'react'

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

    // ── Prazo projetado ──
    // Guarda de sanidade: SPI só é confiável com avanço mínimo; antes disso, mostrar cenários
    const spiConfiavel = avancoReal >= 3  // pelo menos 3% físico executado
    let prazoProjetado = null
    let mesesAtraso = null
    if (spi > 0.05) {
      prazoProjetado = Math.min(PRAZO_ORIGINAL / spi, 60)  // cap 60 meses
      mesesAtraso = Math.max(0, prazoProjetado - PRAZO_ORIGINAL)
    }

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
      prazoProjetado, mesesAtraso, projetado, cenarios,
      eacDireto, totalIndiretosOrcado, eacTotal, orcamentoTotal,
    }
  }, [kpis, dados, indiretos])

  if (loading) return null
  if (!calc) return null

  const C = calc

  return (
    <div style={{background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, marginBottom:12, overflow:'hidden'}}>
      <div
        style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', cursor:'pointer', userSelect:'none'}}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{fontSize:13, fontWeight:600, color:'#ece9e4', display:'flex', alignItems:'center', gap:8}}>
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
        <div style={{borderTop:'1px solid #2a2a31', padding:'16px 18px'}}>

          {/* Custo recorrente mensal */}
          <div style={{marginBottom:18}}>
            <div style={{fontSize:11, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:8}}>
              ⏱ Custo recorrente — cada mês de obra custa isto, independente do avanço
            </div>
            <div style={{display:'flex', alignItems:'baseline', gap:12, marginBottom:10}}>
              <span style={{fontSize:26, fontWeight:700, color:'#e6a338'}}>{fmtR(C.recorrenteMensal)}</span>
              <span style={{fontSize:12, color:'#a09a90'}}>/mês</span>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:8}}>
              {C.detalheInd.map((d, i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'#a09a90', padding:'4px 10px', background:'#1a1a20', borderRadius:6}}>
                  <span>{d.nome}</span>
                  <span style={{color:'#ece9e4', fontWeight:600}}>{fmtR(d.mensal)}/m</span>
                </div>
              ))}
              {Object.entries(C.detalheDir).map(([nome, mensal], i) => (
                <div key={'d'+i} style={{display:'flex', justifyContent:'space-between', fontSize:11, color:'#a09a90', padding:'4px 10px', background:'#1a1a20', borderRadius:6}}>
                  <span>{nome}</span>
                  <span style={{color:'#ece9e4', fontWeight:600}}>{fmtR(mensal)}/m</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cenários de atraso */}
          <div style={{marginBottom:18}}>
            <div style={{fontSize:11, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:8}}>
              📉 Quanto custa atrasar? (recorrentes + Taxa ADM 12%)
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:10}}>
              {C.cenarios.map((cen, i) => (
                <div key={i} style={{background:'#1a1a20', borderRadius:10, padding:'12px 14px', borderLeft:'3px solid #C8860A'}}>
                  <div style={{fontSize:10, color:'#6d675e', marginBottom:4}}>Atraso de {cen.meses} {cen.meses === 1 ? 'mês' : 'meses'}</div>
                  <div style={{fontSize:17, fontWeight:700, color:'#C8860A'}}>{fmtR(cen.total)}</div>
                  <div style={{fontSize:9, color:'#6d675e', marginTop:2}}>{fmtR(cen.base)} + {fmtR(cen.taxaAdm)} ADM</div>
                </div>
              ))}
            </div>
          </div>

          {/* Projeção pelo SPI */}
          <div>
            <div style={{fontSize:11, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:8}}>
              🔮 Projeção no ritmo atual (SPI {C.spi.toFixed(2)})
            </div>
            {!C.spiConfiavel ? (
              <div style={{background:'rgba(200,134,10,0.10)', border:'1px solid #C8860A44', borderRadius:8, padding:'12px 14px', fontSize:12, color:'#ece9e4', lineHeight:1.6}}>
                ⚠️ Avanço físico ainda muito baixo ({C.avancoReal.toFixed(1)}%) para projetar prazo com confiança.
                A projeção pelo SPI só se torna estatisticamente válida com ~3% ou mais de obra executada.
                Use os cenários fixos acima como referência de impacto.
              </div>
            ) : C.projetado && (
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
                <div style={{background:'#1a1a20', borderRadius:10, padding:'14px 16px', borderLeft:`3px solid ${C.eacTotal > C.orcamentoTotal ? '#B03030' : '#4D9B6A'}`}}>
                  <div style={{fontSize:10, color:'#6d675e', marginBottom:4}}>EAC Total da obra (com atraso)</div>
                  <div style={{fontSize:20, fontWeight:700, color: C.eacTotal > C.orcamentoTotal ? '#B03030' : '#4D9B6A'}}>{fmtR(C.eacTotal)}</div>
                  <div style={{fontSize:10, color:'#6d675e'}}>vs orçamento {fmtR(C.orcamentoTotal)}</div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
