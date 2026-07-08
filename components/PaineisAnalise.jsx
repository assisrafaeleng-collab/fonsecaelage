// components/PaineisAnalise.jsx
// Painéis colapsáveis de análise: Alertas, Curva S unificada, Heatmap por pavimento
import React, { useState, useEffect, useMemo } from 'react'

const fmtR = v => 'R$ ' + Math.round(v || 0).toLocaleString('pt-BR')
const fmtP = v => (v || 0).toFixed(1).replace('.', ',') + '%'

const PAVS = ['1º', '2º', '3º', '4º', '5º', '6º/Plat', 'Edifício']
const GRUPOS_NOMES = {
  1:'Prelim', 2:'Fundaç', 3:'Estrut', 4:'Alven', 5:'Reboco', 6:'Hidro', 7:'Elétr',
  8:'InstEsp', 9:'Cobert', 10:'Gesso', 11:'Pisos', 12:'Esquad', 13:'Pintura',
  14:'Louças', 15:'Urban', 16:'Finais', 17:'LocEq', 18:'Func'
}

const S = {
  section: { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, marginBottom:12, overflow:'hidden' },
  sectionHead: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', cursor:'pointer', userSelect:'none' },
  sectionTitle: { fontSize:13, fontWeight:600, color:'#ece9e4', display:'flex', alignItems:'center', gap:8 },
  badge: { fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:700 },
  body: { borderTop:'1px solid var(--border)', padding:'16px 18px' },
}

function Secao({ titulo, icone, badge, badgeColor, children, defaultOpen=false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={S.section}>
      <div style={S.sectionHead} onClick={() => setOpen(o => !o)}>
        <div style={S.sectionTitle}>
          <span>{icone}</span>
          <span>{titulo}</span>
          {badge != null && (
            <span style={{...S.badge, background: badgeColor || '#2a2a31', color:'#fff'}}>{badge}</span>
          )}
        </div>
        <span style={{color:'#6d675e', fontSize:12}}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={S.body}>{children}</div>}
    </div>
  )
}

// ─── ALERTAS DE DESVIO ────────────────────────────────────────
function Alertas({ mes }) {
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [dadosRes, lancRes, indPlanRes, indRealRes] = await Promise.all([
          fetch('/dados.json').then(r => r.json()),
          fetch('/api/custos-diretos-realizados-lista').then(r => r.json()),
          fetch(`/api/custos-indiretos-planejados?mes=${mes}`).then(r => r.json()),
          fetch('/api/custos-indiretos-realizados-lista').then(r => r.json()),
        ])
        const dados = dadosRes || []
        const lancs = (lancRes.lancamentos || [])
        const found = []

        // 1. Grupos com desvio de custo > 10%
        const realPorGrupo = {}
        lancs.forEach(l => {
          const g = parseInt((l.codigo_eap || '').split('.')[0])
          if (!realPorGrupo[g]) realPorGrupo[g] = 0
          realPorGrupo[g] += parseFloat(l.valor || 0)
        })
        const planPorGrupo = {}
        const nomesGrupo = {}
        dados.forEach(r => {
          if (mes < r.a) return
          const numMeses = Math.max(r.b - r.a + 1, 1)
          const mesesAtivos = Math.min(mes, r.b) - r.a + 1
          const valor = r.c * mesesAtivos / numMeses
          if (!planPorGrupo[r.g]) planPorGrupo[r.g] = 0
          planPorGrupo[r.g] += valor
          nomesGrupo[r.g] = r.n
        })
        Object.entries(realPorGrupo).forEach(([g, real]) => {
          const plan = planPorGrupo[g] || 0
          if (plan > 0 && real > plan * 1.1) {
            const pct = ((real - plan) / plan * 100).toFixed(0)
            found.push({ tipo:'custo', nivel:'alto', msg: `Grupo ${g} (${nomesGrupo[g] || ''}): custo ${pct}% acima do planejado (${fmtR(real)} vs ${fmtR(plan)})` })
          }
        })

        // 2. Atividades que deveriam ter iniciado (a <= mes) mas grupo sem nenhum realizado
        const gruposComRealizado = new Set(Object.keys(realPorGrupo).map(Number))
        const gruposAtrasados = {}
        dados.forEach(r => {
          if (r.g === 17 || r.g === 18) return
          if (r.a <= mes && !gruposComRealizado.has(r.g)) {
            if (!gruposAtrasados[r.g]) gruposAtrasados[r.g] = { nome: r.n, count: 0 }
            gruposAtrasados[r.g].count++
          }
        })
        Object.entries(gruposAtrasados).forEach(([g, info]) => {
          found.push({ tipo:'prazo', nivel:'medio', msg: `Grupo ${g} (${info.nome}): ${info.count} atividades deveriam ter iniciado e não há custos lançados` })
        })

        // 3. Categorias indiretas próximas de estourar (>90% do orçamento)
        const indPlan = indPlanRes.categorias || []
        const indReal = indRealRes.realPorCategoria || {}
        indPlan.forEach(cat => {
          const real = indReal[cat.categoria] || 0
          const total = cat.valor_total_projeto || cat.valor_total || 0
          if (total > 0 && real > total * 0.9 && real < total * 1.001) {
            found.push({ tipo:'indireto', nivel:'medio', msg: `${cat.categoria}: ${(real/total*100).toFixed(0)}% do orçamento consumido (${fmtR(real)} de ${fmtR(total)})` })
          } else if (total > 0 && real > total) {
            found.push({ tipo:'indireto', nivel:'alto', msg: `${cat.categoria}: ESTOUROU o orçamento em ${fmtR(real - total)} (${fmtR(real)} de ${fmtR(total)})` })
          }
        })

        setAlertas(found)
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [mes])

  // Carregar resolvidos do localStorage
  const [resolvidos, setResolvidos] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(localStorage.getItem('alertas_resolvidos') || '{}')
    } catch { return {} }
  })

  function toggleResolvido(key) {
    setResolvidos(prev => {
      const novo = { ...prev, [key]: !prev[key] }
      if (!novo[key]) delete novo[key]
      try { localStorage.setItem('alertas_resolvidos', JSON.stringify(novo)) } catch {}
      return novo
    })
  }

  if (loading) return <div style={{color:'#6d675e', fontSize:12}}>Analisando...</div>
  if (alertas.length === 0) return <div style={{color:'#4D9B6A', fontSize:13}}>✅ Nenhum desvio relevante detectado até M{mes}.</div>

  return (
    <div>
      {alertas.map((a, i) => {
        // Chave estável para o alerta (baseada na msg)
        const key = a.msg.slice(0, 80)
        const resolvido = !!resolvidos[key]
        return (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:12, padding:'12px 14px', marginBottom:8, borderRadius:8,
            background: a.nivel==='alto' ? 'rgba(176,48,48,0.12)' : 'rgba(200,134,10,0.10)',
            border: `1px solid ${a.nivel==='alto' ? '#B0303055' : '#C8860A44'}`,
            opacity: resolvido ? 0.5 : 1,
            transition: 'opacity 0.2s'
          }}>
            <input
              type="checkbox"
              checked={resolvido}
              onChange={() => toggleResolvido(key)}
              style={{width:16, height:16, cursor:'pointer', accentColor: '#4D9B6A', flexShrink:0}}
              title={resolvido ? 'Desmarcar' : 'Marcar como resolvido'}
            />
            <span style={{flexShrink:0}}>{resolvido ? '✅' : (a.nivel==='alto' ? '🔴' : '🟡')}</span>
            <span style={{
              fontSize:12, color:'#ece9e4', lineHeight:1.5, flex:1,
              textDecoration: resolvido ? 'line-through' : 'none',
              color: resolvido ? '#6d675e' : '#ece9e4'
            }}>{a.msg}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── CURVA S UNIFICADA ────────────────────────────────────────
function CurvaS({ mes }) {
  const [curvas, setCurvas] = useState(null)

  useEffect(() => {
    fetch(`/api/dashboard-integrado?mes=20`)
      .then(r => r.json())
      .then(d => setCurvas(d.curvas || null))
      .catch(() => {})
  }, [])

  if (!curvas) return <div style={{color:'#6d675e', fontSize:12}}>Carregando curvas...</div>

  const W = 760, H = 280, PAD = 45
  const meses = 20

  // Normalize curves to arrays of 20 values (accumulated %)
  function normalize(arr, valueKey) {
    const out = Array(meses).fill(null)
    ;(arr || []).forEach(p => {
      const m = p.mes_numero || p.mes
      if (m >= 1 && m <= meses) out[m-1] = parseFloat(p[valueKey] ?? p.percentual_acumulado ?? p.valor_acumulado ?? p.acumulado ?? 0)
    })
    return out
  }

  // Try common keys
  function getSeries(arr) {
    if (!arr || !arr.length) return Array(meses).fill(null)
    const sample = arr[0]
    const key = ['percentual_acumulado','pct_acumulado','valor_acumulado','acumulado','percentual','valor_mensal'].find(k => sample[k] !== undefined)
    let vals = normalize(arr, key)
    // If values look like money (>1000), convert to % of max
    const max = Math.max(...vals.filter(v => v != null))
    if (max > 200) {
      vals = vals.map(v => v != null ? (v / max * 100) : null)
    }
    // Accumulate if not accumulated (non-monotonic check)
    return vals
  }

  const series = [
    { nome:'Físico Planejado', cor:'#5B9BD5', dados: getSeries(curvas.fisico_planejado), dash:'4,3' },
    { nome:'Físico Realizado', cor:'#5B9BD5', dados: getSeries(curvas.fisico_realizado), dash:null },
    { nome:'Financeiro Planejado', cor:'#E91E8C', dados: getSeries(curvas.financeiro_planejado), dash:'4,3' },
    { nome:'Financeiro Realizado', cor:'#E91E8C', dados: getSeries(curvas.financeiro_realizado), dash:null },
  ]

  const x = i => PAD + (i / (meses-1)) * (W - PAD*2)
  const y = v => H - PAD - (v / 100) * (H - PAD*2)

  function path(dados) {
    let d = ''
    dados.forEach((v, i) => {
      if (v == null) return
      d += (d === '' ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(Math.min(v,100)).toFixed(1)
    })
    return d
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height:'auto'}}>
        {/* Grid */}
        {[0,25,50,75,100].map(p => (
          <g key={p}>
            <line x1={PAD} y1={y(p)} x2={W-PAD} y2={y(p)} stroke="#2a2a31" strokeWidth="1" />
            <text x={PAD-8} y={y(p)+3} fill="#6d675e" fontSize="9" textAnchor="end">{p}%</text>
          </g>
        ))}
        {/* Month labels */}
        {Array.from({length:meses},(_,i) => (
          <text key={i} x={x(i)} y={H-PAD+14} fill="#6d675e" fontSize="8" textAnchor="middle">M{i+1}</text>
        ))}
        {/* Linha do hoje */}
        <line x1={x(mes-1)} y1={PAD-10} x2={x(mes-1)} y2={H-PAD} stroke="#e6a338" strokeWidth="1.5" strokeDasharray="5,4" />
        <text x={x(mes-1)} y={PAD-14} fill="#e6a338" fontSize="9" textAnchor="middle" fontWeight="bold">M{mes} (atual)</text>
        {/* Curves */}
        {series.map((s, i) => (
          <path key={i} d={path(s.dados)} fill="none" stroke={s.cor} strokeWidth="2"
            strokeDasharray={s.dash || 'none'} opacity={s.dash ? 0.65 : 1} />
        ))}
      </svg>
      <div style={{display:'flex', gap:16, flexWrap:'wrap', marginTop:8, justifyContent:'center'}}>
        {series.map((s,i) => (
          <div key={i} style={{display:'flex', alignItems:'center', gap:6}}>
            <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke={s.cor} strokeWidth="2" strokeDasharray={s.dash||'none'} opacity={s.dash?0.65:1}/></svg>
            <span style={{fontSize:10, color:'#a09a90'}}>{s.nome}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── HEATMAP POR PAVIMENTO ────────────────────────────────────
export function Heatmap({ mes }) {
  const [dados, setDados] = useState([])
  const [avanco, setAvanco] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [d, ...avancos] = await Promise.all([
          fetch('/dados.json').then(r => r.json()),
          ...Array.from({length: mes}, (_, i) => fetch(`/api/avanco-fisico-realizado?mes=${i+1}`).then(r => r.json()))
        ])
        setDados(d || [])
        // Merge all months - keep latest percentual per item
        const map = {}
        avancos.forEach(res => {
          (res.data || []).forEach(item => {
            const key = `${item.codigo_eap}|${item.pavimento}`
            map[key] = Math.max(map[key] || 0, parseFloat(item.percentual_realizado || 0))
          })
        })
        setAvanco(map)
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [mes])

  const grid = useMemo(() => {
    // grupos 1-16 (exclui 17/18)
    const grupos = [...new Set(dados.filter(r => r.g <= 16).map(r => r.g))].sort((a,b) => a-b)
    const cells = {}
    grupos.forEach(g => {
      PAVS.forEach(pav => {
        const items = dados.filter(r => r.g === g && r.p === pav)
        if (items.length === 0) return
        const totHh = items.reduce((s,r) => s + (r.h || 0), 0)
        let realHh = 0
        let planPct = 0
        let planCount = 0
        items.forEach(r => {
          const pct = avanco[`${r.i}|${pav}`] || 0
          realHh += (r.h || 0) * pct / 100
          // planned progress
          if (mes >= r.a) {
            const numMeses = Math.max(r.b - r.a + 1, 1)
            const ativos = Math.min(mes, r.b) - r.a + 1
            planPct += Math.min(100, ativos / numMeses * 100)
          }
          planCount++
        })
        const realPct = totHh > 0 ? (realHh / totHh * 100) : (items.length > 0 ? items.reduce((s,r) => s + (avanco[`${r.i}|${pav}`]||0), 0) / items.length : 0)
        const planAvg = planCount > 0 ? planPct / planCount : 0
        cells[`${g}|${pav}`] = { real: realPct, plan: planAvg, items: items.length }
      })
    })
    return { grupos, cells }
  }, [dados, avanco, mes])

  if (loading) return <div style={{color:'#6d675e', fontSize:12}}>Carregando mapa...</div>

  function cellColor(cell) {
    if (!cell) return 'transparent'
    const { real, plan } = cell
    if (plan === 0 && real === 0) return '#1a1a20'  // futuro
    if (real >= plan - 5) {
      // Em dia ou adiantado: verde com intensidade pelo avanço
      const alpha = 0.15 + (real/100) * 0.55
      return `rgba(77,155,106,${alpha})`
    }
    if (real >= plan * 0.6) return 'rgba(200,134,10,0.45)'  // levemente atrasado
    return 'rgba(176,48,48,0.5)'  // muito atrasado
  }

  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse', width:'100%', minWidth:600}}>
        <thead>
          <tr>
            <th style={{fontSize:9, color:'#6d675e', padding:'4px 8px', textAlign:'left'}}>PAV</th>
            {grid.grupos.map(g => (
              <th key={g} style={{fontSize:8, color:'#6d675e', padding:'4px 2px', textAlign:'center'}}>{g}<br/>{GRUPOS_NOMES[g]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...PAVS].reverse().map(pav => (
            <tr key={pav}>
              <td style={{fontSize:10, color:'#a09a90', padding:'2px 8px', fontWeight:600, whiteSpace:'nowrap'}}>{pav}</td>
              {grid.grupos.map(g => {
                const cell = grid.cells[`${g}|${pav}`]
                return (
                  <td key={g} style={{padding:2}}>
                    {cell ? (
                      <div title={`Grupo ${g} · ${pav}\nReal: ${cell.real.toFixed(0)}% · Plan: ${cell.plan.toFixed(0)}%\n${cell.items} itens`}
                        style={{
                          background: cellColor(cell), borderRadius:4, height:28,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:9, color:'#ece9e4', fontWeight:600, cursor:'default',
                        }}>
                        {cell.real > 0 || cell.plan > 0 ? `${cell.real.toFixed(0)}%` : ''}
                      </div>
                    ) : <div style={{height:28}} />}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{display:'flex', gap:14, marginTop:10, justifyContent:'center', flexWrap:'wrap'}}>
        <span style={{fontSize:9, color:'#a09a90'}}><span style={{display:'inline-block',width:10,height:10,background:'rgba(77,155,106,0.6)',borderRadius:2,marginRight:4}}/>Em dia</span>
        <span style={{fontSize:9, color:'#a09a90'}}><span style={{display:'inline-block',width:10,height:10,background:'rgba(200,134,10,0.45)',borderRadius:2,marginRight:4}}/>Atenção</span>
        <span style={{fontSize:9, color:'#a09a90'}}><span style={{display:'inline-block',width:10,height:10,background:'rgba(176,48,48,0.5)',borderRadius:2,marginRight:4}}/>Atrasado</span>
        <span style={{fontSize:9, color:'#a09a90'}}><span style={{display:'inline-block',width:10,height:10,background:'#1a1a20',border:'1px solid #2a2a31',borderRadius:2,marginRight:4}}/>Futuro</span>
      </div>
    </div>
  )
}

// ─── SEMÁFORO EVM ─────────────────────────────────────────────
function SemaforoEVM({ mes }) {
  const [kpis, setKpis] = useState(null)

  useEffect(() => {
    fetch(`/api/dashboard-integrado?mes=${mes}`)
      .then(r => r.json())
      .then(d => setKpis(d.kpis || null))
      .catch(() => {})
  }, [mes])

  if (!kpis) return <div style={{color:'#6d675e', fontSize:12}}>Carregando indicadores...</div>

  const cor = v => v >= 1 ? '#4D9B6A' : v >= 0.9 ? '#C8860A' : '#B03030'
  const emoji = v => v >= 1 ? '🟢' : v >= 0.9 ? '🟡' : '🔴'

  const indicadores = [
    { nome:'CPI — Eficiência de Custo', valor: kpis.cpi, desc: kpis.cpi >= 1 ? 'Gastando menos que o previsto' : 'Gastando mais que o previsto' },
    { nome:'SPI — Eficiência de Prazo', valor: kpis.spi, desc: kpis.spi >= 1 ? 'Adiantado no cronograma' : 'Atrasado no cronograma' },
  ]

  return (
    <div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14}}>
        {indicadores.map((ind, i) => (
          <div key={i} style={{background:'#1a1a20', borderRadius:10, padding:'14px 16px', borderLeft:`3px solid ${cor(ind.valor)}`}}>
            <div style={{fontSize:10, color:'#6d675e', textTransform:'uppercase', marginBottom:4}}>{ind.nome}</div>
            <div style={{fontSize:24, fontWeight:700, color:cor(ind.valor)}}>{emoji(ind.valor)} {(ind.valor || 0).toFixed(2)}</div>
            <div style={{fontSize:11, color:'#a09a90', marginTop:4}}>{ind.desc}</div>
          </div>
        ))}
      </div>
      <div style={{background:'#1a1a20', borderRadius:10, padding:'14px 16px'}}>
        <div style={{fontSize:10, color:'#6d675e', textTransform:'uppercase', marginBottom:8}}>Projeção no ritmo atual (EAC)</div>
        <div style={{display:'flex', gap:24, flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:18, fontWeight:700, color:'#ece9e4'}}>{fmtR(kpis.eac)}</div>
            <div style={{fontSize:10, color:'#6d675e'}}>custo final projetado</div>
          </div>
          <div>
            <div style={{fontSize:18, fontWeight:700, color: kpis.eac > kpis.orcamento_total ? '#B03030' : '#4D9B6A'}}>
              {kpis.eac > kpis.orcamento_total ? '+' : ''}{fmtR(kpis.eac - kpis.orcamento_total)}
            </div>
            <div style={{fontSize:10, color:'#6d675e'}}>vs orçamento ({fmtR(kpis.orcamento_total)})</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function PaineisAnalise({ mes }) {
  const [numAlertas, setNumAlertas] = useState(null)

  return (
    <div style={{marginTop:16}}>
      <Secao titulo="Alertas de Desvio" icone="⚠️" defaultOpen={false}>
        <Alertas mes={mes} />
      </Secao>
      
    
    </div>
  )
}
