// pages/custos-diretos-realizados-lista.js
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'

const PAVS = ['1º','2º','3º','4º','5º','6º/Plat','Edifício']

const fmtR = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
const fmtH = v => Math.round(v).toLocaleString('pt-BR') + ' Hh'
const fmtP = v => (v * 100).toFixed(1).replace('.', ',') + '%'

const S = {
  page: { minHeight: '100vh', background: '#0f0f11', color: '#ece9e4', fontFamily: '"Segoe UI",system-ui,sans-serif', fontVariantNumeric: 'tabular-nums' },
  wrap: { maxWidth: 1100, margin: '0 auto', padding: '0 20px 40px' },
  eyebrow: { color: '#6d675e', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', paddingTop: 28, marginBottom: 2 },
  h1: { fontSize: 22, fontWeight: 600, margin: '2px 0 2px' },
  sub: { color: '#a09a90', fontSize: 13, marginBottom: 18 },
  nav: { display: 'flex', gap: 8, marginBottom: 20 },
  navBtn: { background: 'transparent', border: '1px solid #2a2a31', color: '#a09a90', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 },
  kpi: { background: '#17171b', border: '1px solid #2a2a31', borderRadius: 12, padding: '14px 16px' },
  kpiLbl: { color: '#6d675e', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  kpiVal: { fontSize: 22, fontWeight: 700 },
  kpiSub: { color: '#a09a90', fontSize: 11, marginTop: 3 },
  controls: { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' },
  lbl: { display: 'block', color: '#6d675e', fontSize: 10, letterSpacing: .5, textTransform: 'uppercase', marginBottom: 4 },
  input: { background: '#1e1e24', border: '1px solid #2a2a31', color: '#ece9e4', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit', minWidth: 160 },
  select: { background: '#1e1e24', border: '1px solid #2a2a31', color: '#ece9e4', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit' },
  seg: { display: 'flex', background: '#1e1e24', border: '1px solid #2a2a31', borderRadius: 8, overflow: 'hidden' },
  card: { background: '#17171b', border: '1px solid #2a2a31', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  chead: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', userSelect: 'none' },
  badge: { width: 30, height: 30, borderRadius: 7, background: '#1e1e24', border: '1px solid #2a2a31', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#a09a90', fontWeight: 600, flexShrink: 0 },
  body: { borderTop: '1px solid #2a2a31' },
  subsec: { padding: '10px 16px 4px', color: '#3fae86', fontSize: 11, letterSpacing: .5, textTransform: 'uppercase', fontWeight: 600 },
  empty: { color: '#6d675e', textAlign: 'center', padding: 32, fontSize: 14 },
}

function Seg({ value, onChange, options }) {
  return (
    <div style={S.seg}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          background: value === o.v ? '#e6a338' : 'transparent',
          color: value === o.v ? '#231803' : '#a09a90',
          border: 0, padding: '8px 12px', fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit', whiteSpace: 'nowrap', fontWeight: value === o.v ? 600 : 400,
        }}>{o.l}</button>
      ))}
    </div>
  )
}

function DesvioBar({ planejado, realizado }) {
  const pct = planejado > 0 ? Math.min((realizado / planejado) * 100, 150) : 0
  const cor = pct > 105 ? '#B03030' : pct > 0 ? '#4D9B6A' : '#555'
  return (
    <div style={{ position: 'relative', height: 6, background: '#1e1e24', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(pct, 100)}%`, background: cor, borderRadius: 3 }} />
      {pct > 100 && <div style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: `${Math.min(pct-100, 50)}%`, background: '#B03030', borderRadius: 3, opacity: 0.6 }} />}
    </div>
  )
}

export default function CustosDiretosRealizados() {
  const router = useRouter()
  const [dados, setDados] = useState([])        // planejado (dados.json)
  const [lanc, setLanc] = useState([])           // realizado (lancamentos)
  const [avancoReal, setAvancoReal] = useState([]) // avanco fisico realizado
  const [loading, setLoading] = useState(true)
  const [axis, setAxis] = useState('grupo')
  const [metric, setMetric] = useState('custo')
  const [pavF, setPavF] = useState('__ALL__')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  const [mesAtual, setMesAtual] = useState(20)

  const NOMES_MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const mesesOpcoes = Array.from({ length: 20 }, (_, i) => {
    const totalMonths = 6 + i
    const ano = 2026 + Math.floor(totalMonths / 12)
    const mes = totalMonths % 12
    return { valor: i + 1, label: `${NOMES_MESES[mes]}/${ano}` }
  })

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true)
        const [dadosRes, lancRes, avancoRes] = await Promise.all([
          fetch('/dados.json').then(r => r.json()),
          fetch('/api/custos-diretos-realizados-lista').then(r => r.json()),
          fetch(`/api/avanco-fisico-realizado`).then(r => r.json()).catch(() => ({ data: [] })),
        ])
        setDados(dadosRes || [])
        setLanc(lancRes.lancamentos || [])
        setAvancoReal(avancoRes.data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const totHh = useMemo(() => dados.reduce((s, r) => s + r.h, 0) || 1, [dados])

  // Calcular Hh realizado por grupo (via avanco fisico realizado)
  const hhRealizadoPorGrupo = useMemo(() => {
    const map = {}
    // Por ora, retorna 0 - será preenchido quando avanço físico for atualizado
    return map
  }, [avancoReal, dados])

  // Realizado por grupo (R$)
  const realizadoPorEap = useMemo(() => {
    const map = {}
    const dataLimite = new Date('2026-07-01')
    dataLimite.setMonth(dataLimite.getMonth() + mesAtual - 1)
    const limStr = dataLimite.toISOString().slice(0, 7)

    lanc.forEach(l => {
      const comp = l.data_emissao ? l.data_emissao.slice(0, 7) : ''
      if (comp > limStr) return
      const eap = l.codigo_eap || ''
      // Map EAP to group number
      const gNum = parseInt(eap.split('.')[0])
      if (!map[gNum]) map[gNum] = 0
      map[gNum] += parseFloat(l.valor || 0)
    })
    return map
  }, [lanc, mesAtual])

  // Filter planejado
  const ql = q.toLowerCase()
  const visible = useMemo(() => dados.filter(r => {
    if (pavF !== '__ALL__' && r.p !== pavF) return false
    if (ql && !r.n.toLowerCase().includes(ql) && !r.d.toLowerCase().includes(ql)) return false
    return true
  }), [dados, pavF, ql])

  const valPlan = (r) => {
    if (metric === 'custo') return r.c
    if (metric === 'hh') return r.h
    return r.h / totHh
  }

  const fmtVal = (v) => {
    if (metric === 'custo') return fmtR(v)
    if (metric === 'hh') return fmtH(v)
    return fmtP(v)
  }

  // Groups
  const groups = useMemo(() => {
    const map = {}
    visible.forEach(r => {
      const key = axis === 'grupo' ? String(r.g) : r.p
      if (!map[key]) map[key] = { key, label: axis === 'grupo' ? r.n : r.p, gNum: r.g, rows: [] }
      map[key].rows.push(r)
    })
    const arr = Object.values(map)
    if (axis === 'grupo') arr.sort((a, b) => a.gNum - b.gNum)
    else arr.sort((a, b) => {
      const ia = PAVS.indexOf(a.key), ib = PAVS.indexOf(b.key)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return arr
  }, [visible, axis])

  const totalPlan = useMemo(() => visible.reduce((s, r) => s + valPlan(r), 0), [visible, metric, totHh])
  const totalReal = useMemo(() => Object.values(realizadoPorEap).reduce((s, v) => s + v, 0), [realizadoPorEap])
  const maxGroup = useMemo(() => Math.max(...groups.map(g => g.rows.reduce((s, r) => s + valPlan(r), 0)), 1), [groups, metric, totHh])

  const toggle = (key) => setOpen(o => ({ ...o, [key]: !o[key] }))

  if (loading) return <div style={S.page}><div style={{ padding: 40, color: '#a09a90' }}>Carregando...</div></div>

  const desvioTotal = totalPlan > 0 ? ((totalReal - totalPlan) / totalPlan * 100) : 0

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.eyebrow}>Custos diretos realizados vs planejados</div>
        <div style={S.h1}>Flats Pampulha</div>
        <div style={S.sub}>20 meses · Jul/2026 a Fev/2028</div>

        <div style={S.nav}>
          <button style={S.navBtn} onClick={() => router.push('/')}>← Dashboard</button>
          <button style={S.navBtn} onClick={() => router.push('/custos-diretos-planejados')}>📋 Planejado</button>
        </div>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={{ ...S.kpi, borderLeft: '3px solid #5B9BD5' }}>
            <div style={S.kpiLbl}>Planejado até M{mesAtual}</div>
            <div style={{ ...S.kpiVal, color: '#5B9BD5' }}>{fmtVal(totalPlan)}</div>
            <div style={S.kpiSub}>{groups.length} grupos · {visible.length} itens</div>
          </div>
          <div style={{ ...S.kpi, borderLeft: '3px solid #E91E8C' }}>
            <div style={S.kpiLbl}>Realizado até M{mesAtual}</div>
            <div style={{ ...S.kpiVal, color: '#E91E8C' }}>{metric === 'custo' ? fmtR(totalReal) : '—'}</div>
            <div style={S.kpiSub}>{lanc.length} lançamentos</div>
          </div>
          <div style={{ ...S.kpi, borderLeft: `3px solid ${Math.abs(desvioTotal) < 5 ? '#4D9B6A' : desvioTotal > 0 ? '#B03030' : '#4D9B6A'}` }}>
            <div style={S.kpiLbl}>Desvio financeiro</div>
            <div style={{ ...S.kpiVal, color: desvioTotal > 5 ? '#B03030' : '#4D9B6A', fontSize: 20 }}>
              {desvioTotal >= 0 ? '+' : ''}{desvioTotal.toFixed(1)}%
            </div>
            <div style={S.kpiSub}>{desvioTotal > 0 ? '⚠️ Acima do planejado' : '✅ Dentro do orçamento'}</div>
          </div>
        </div>

        {/* Controles */}
        <div style={S.controls}>
          <div>
            <label style={S.lbl}>Período</label>
            <select style={S.select} value={mesAtual} onChange={e => setMesAtual(parseInt(e.target.value))}>
              {mesesOpcoes.map(m => (
                <option key={m.valor} value={m.valor}>{m.valor === 20 ? 'Todos (20 meses)' : `M${m.valor} — ${m.label}`}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={S.lbl}>Buscar</label>
            <input style={{ ...S.input, width: '100%', boxSizing: 'border-box' }} placeholder="🔍 grupo ou item..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div>
            <label style={S.lbl}>Pavimento</label>
            <select style={S.select} value={pavF} onChange={e => setPavF(e.target.value)}>
              <option value="__ALL__">Todos</option>
              {PAVS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Agrupar por</label>
            <Seg value={axis} onChange={setAxis} options={[{ v: 'grupo', l: 'Macrogrupo' }, { v: 'pav', l: 'Pavimento' }]} />
          </div>
          <div>
            <label style={S.lbl}>Métrica</label>
            <Seg value={metric} onChange={setMetric} options={[{ v: 'custo', l: 'R$' }, { v: 'hh', l: 'Hh' }, { v: 'pct', l: '%' }]} />
          </div>
        </div>

        {/* Cards */}
        {groups.length === 0 && <div style={S.empty}>Nenhum item encontrado.</div>}

        {/* Cabeçalho tabela */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 100px 80px', gap: 8, padding: '6px 16px', fontSize: 10, color: '#6d675e', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          <span>Grupo / Item</span>
          <span style={{ textAlign: 'right' }}>Planejado</span>
          <span style={{ textAlign: 'right' }}>Realizado</span>
          <span style={{ textAlign: 'right' }}>Desvio</span>
          <span>Progresso</span>
        </div>

        {groups.map((g, gi) => {
          const gPlan = g.rows.reduce((s, r) => s + valPlan(r), 0)
          const gReal = metric === 'custo' ? (realizadoPorEap[g.gNum] || 0) : 0
          const gDesvio = gPlan > 0 ? ((gReal - gPlan) / gPlan * 100) : 0
          const isOpen = !!open[g.key]
          const badge = axis === 'grupo' ? g.gNum : gi + 1

          // Subgroups
          const subMap = {}
          g.rows.forEach(r => {
            const sk = axis === 'grupo' ? r.p : String(r.g)
            const sl = axis === 'grupo' ? r.p : r.n
            if (!subMap[sk]) subMap[sk] = { key: sk, label: sl, gNum: r.g, rows: [] }
            subMap[sk].rows.push(r)
          })
          const subs = Object.values(subMap)
          if (axis === 'grupo') subs.sort((a, b) => { const ia = PAVS.indexOf(a.key), ib = PAVS.indexOf(b.key); return (ia===-1?99:ia)-(ib===-1?99:ib) })
          else subs.sort((a, b) => a.gNum - b.gNum)

          return (
            <div key={g.key} style={S.card}>
              <div style={S.chead} onClick={() => toggle(g.key)}>
                <div style={S.badge}>{badge}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: '#6d675e', marginTop: 1 }}>{g.rows.length} itens</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ fontSize: 12, color: '#5B9BD5' }}>{fmtVal(gPlan)}</div>
                  <div style={{ fontSize: 10, color: '#6d675e' }}>planejado</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 120 }}>
                  <div style={{ fontSize: 12, color: '#E91E8C' }}>{metric === 'custo' ? fmtR(gReal) : '—'}</div>
                  <div style={{ fontSize: 10, color: '#6d675e' }}>realizado</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: gDesvio > 5 ? '#B03030' : gDesvio > 0 ? '#C8860A' : '#4D9B6A' }}>
                    {metric === 'custo' ? `${gDesvio >= 0 ? '+' : ''}${gDesvio.toFixed(1)}%` : '—'}
                  </div>
                </div>
                <div style={{ width: 60 }}>
                  <DesvioBar planejado={gPlan} realizado={gReal} />
                </div>
                <div style={{ color: '#6d675e', fontSize: 12, flexShrink: 0, marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</div>
              </div>

              {isOpen && (
                <div style={S.body}>
                  {subs.map(sub => {
                    const subPlan = sub.rows.reduce((s, r) => s + valPlan(r), 0)
                    return (
                      <div key={sub.key}>
                        <div style={S.subsec}>📐 {sub.label}</div>
                        {[...sub.rows].sort((a, b) => a.i.localeCompare(b.i, undefined, { numeric: true })).map((r, ri) => (
                          <div key={`${r.i}-${ri}`} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 110px 10px 80px', gap: 8, padding: '5px 16px', fontSize: 11, alignItems: 'center', background: ri % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                            <span style={{ color: '#6d675e', fontFamily: 'monospace', fontSize: 10 }}>{r.i}</span>
                            <span style={{ color: '#a09a90' }}>{r.d}</span>
                            <span style={{ textAlign: 'right', color: '#5B9BD5' }}>{fmtVal(valPlan(r))}</span>
                            <span style={{ fontSize: 9, color: '#6d675e' }}>M{String(r.a).padStart(2,'0')}–M{String(r.b).padStart(2,'0')}</span>
                            <span style={{ textAlign: 'right', color: '#ece9e4', fontSize: 10 }}>—</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '8px 16px', borderTop: '1px solid #2a2a31', fontSize: 12, color: '#6d675e' }}>
                          <span>subtotal: <span style={{ color: '#5B9BD5', fontWeight: 600 }}>{fmtVal(subPlan)}</span></span>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: '2px solid #2a2a31', fontSize: 12, fontWeight: 700 }}>
                    <span style={{ color: '#a09a90' }}>Total {g.label}:</span>
                    <div style={{ display: 'flex', gap: 24 }}>
                      <span style={{ color: '#5B9BD5' }}>Plan: {fmtVal(gPlan)}</span>
                      {metric === 'custo' && <span style={{ color: '#E91E8C' }}>Real: {fmtR(gReal)}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Footer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 20, alignItems: 'center', padding: '14px 18px', borderRadius: 10, background: '#17171b', border: '1px solid #2a2a31', marginTop: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>TOTAL GERAL</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#5B9BD5' }}>Plan: {fmtVal(totalPlan)}</span>
          {metric === 'custo' && <span style={{ fontSize: 15, fontWeight: 700, color: '#E91E8C' }}>Real: {fmtR(totalReal)}</span>}
        </div>
      </div>
    </div>
  )
}
