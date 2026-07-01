// pages/custos-diretos-planejados.js
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'

const PAVS = ['1º','2º','3º','4º','5º','6º/Plat','Edifício']

const fmtR = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
const fmtH = v => Math.round(v).toLocaleString('pt-BR') + ' Hh'
const fmtP = v => (v * 100).toFixed(2).replace('.', ',') + '%'

const S = {
  page: { minHeight: '100vh', background: '#0f0f11', color: '#ece9e4', fontFamily: '"Segoe UI",system-ui,sans-serif', fontVariantNumeric: 'tabular-nums' },
  wrap: { maxWidth: 1080, margin: '0 auto', padding: '0 20px 40px' },
  eyebrow: { color: '#6d675e', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', paddingTop: 28, marginBottom: 2 },
  h1: { fontSize: 22, fontWeight: 600, margin: '2px 0 2px' },
  sub: { color: '#a09a90', fontSize: 13, marginBottom: 18 },
  nav: { display: 'flex', gap: 8, marginBottom: 20 },
  navBtn: { background: 'transparent', border: '1px solid #2a2a31', color: '#a09a90', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
  total: { borderLeft: '3px solid #e6a338', background: '#17171b', border: '1px solid #2a2a31', borderLeftWidth: 3, borderLeftColor: '#e6a338', borderRadius: 12, padding: '16px 20px', marginBottom: 16 },
  totLbl: { color: '#6d675e', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  totBig: { fontSize: 28, fontWeight: 600, marginTop: 2, color: '#e6a338' },
  totFoot: { color: '#a09a90', fontSize: 12, marginTop: 3 },
  controls: { display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' },
  lbl: { display: 'block', color: '#6d675e', fontSize: 10, letterSpacing: .5, textTransform: 'uppercase', marginBottom: 4 },
  input: { background: '#1e1e24', border: '1px solid #2a2a31', color: '#ece9e4', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit', minWidth: 180 },
  select: { background: '#1e1e24', border: '1px solid #2a2a31', color: '#ece9e4', borderRadius: 8, padding: '8px 11px', fontSize: 13, fontFamily: 'inherit' },
  seg: { display: 'flex', background: '#1e1e24', border: '1px solid #2a2a31', borderRadius: 8, overflow: 'hidden' },
  card: { background: '#17171b', border: '1px solid #2a2a31', borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  chead: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', userSelect: 'none' },
  badge: { width: 30, height: 30, borderRadius: 7, background: '#1e1e24', border: '1px solid #2a2a31', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#a09a90', fontWeight: 600, flexShrink: 0 },
  cname: { fontSize: 14, fontWeight: 500, flex: 1 },
  cmeta: { color: '#6d675e', fontSize: 11, marginTop: 1 },
  barWrap: { width: 80, flexShrink: 0 },
  bar: { height: 5, background: '#1e1e24', borderRadius: 3, overflow: 'hidden' },
  cval: { textAlign: 'right', flexShrink: 0, minWidth: 120 },
  cvnum: { fontSize: 14, fontWeight: 600 },
  cvpct: { fontSize: 11, color: '#6d675e', marginTop: 1 },
  body: { borderTop: '1px solid #2a2a31' },
  subsec: { padding: '10px 16px 4px', color: '#3fae86', fontSize: 11, letterSpacing: .5, textTransform: 'uppercase', fontWeight: 600 },
  item: { display: 'flex', gap: 10, padding: '5px 16px', fontSize: 12, alignItems: 'baseline' },
  itemEap: { color: '#6d675e', minWidth: 48, fontFamily: 'monospace', fontSize: 11 },
  itemDesc: { flex: 1, color: '#a09a90' },
  itemMes: { color: '#6d675e', fontSize: 10, flexShrink: 0 },
  itemVal: { minWidth: 100, textAlign: 'right', color: '#ece9e4', flexShrink: 0 },
  subtot: { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 16px', borderTop: '1px solid #2a2a31', marginTop: 4, fontSize: 12, color: '#6d675e' },
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
          transition: 'background .15s'
        }}>{o.l}</button>
      ))}
    </div>
  )
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export default function CustosDiretosPlanejados() {
  const router = useRouter()
  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(true)
  const [axis, setAxis] = useState('grupo')       // 'grupo' | 'pav'
  const [metric, setMetric] = useState('custo')   // 'custo' | 'hh' | 'pct'
  const [pavF, setPavF] = useState('__ALL__')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})

  useEffect(() => {
    fetch('/dados.json')
      .then(r => r.json())
      .then(d => { setDados(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const totHh = useMemo(() => dados.reduce((s, r) => s + r.h, 0) || 1, [dados])

  const val = (r) => {
    if (metric === 'custo') return r.c
    if (metric === 'hh') return r.h
    return r.h / totHh
  }

  const fmt = (v) => {
    if (metric === 'custo') return fmtR(v)
    if (metric === 'hh') return fmtH(v)
    return fmtP(v)
  }

  const ql = q.toLowerCase()

  const visible = useMemo(() => dados.filter(r => {
    if (pavF !== '__ALL__' && r.p !== pavF) return false
    if (ql && !r.n.toLowerCase().includes(ql) && !r.d.toLowerCase().includes(ql)) return false
    return true
  }), [dados, pavF, ql])

  // Group level 1
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

  const totalVisible = useMemo(() => visible.reduce((s, r) => s + val(r), 0), [visible, metric, totHh])
  const maxGroup = useMemo(() => Math.max(...groups.map(g => g.rows.reduce((s, r) => s + val(r), 0)), 1), [groups, metric, totHh])

  const toggle = (key) => setOpen(o => ({ ...o, [key]: !o[key] }))

  useEffect(() => { setOpen({}) }, [q])

  if (loading) return <div style={S.page}><div style={{ padding: 40, color: '#a09a90' }}>Carregando...</div></div>

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.eyebrow}>Custos diretos + avanço físico planejado</div>
        <div style={S.h1}>Flats Pampulha</div>
        <div style={[.sub}>20 meses · Jul/2026 a Fev/2028</div>

        {/* Nav */}
        <div style={S.nav}>
          <button style={S.navBtn} onClick={() => router.push('/')}>← Dashboard</button>
        </div>

        {/* Card de total */}
        <div style={S.total}>
          <div style={S.totLbl}>
            {metric === 'custo' ? 'Total custo direto' : metric === 'hh' ? 'Total homem-hora' : '% físico total'}
            {pavF !== '__ALL__' ? ` · ${pavF}` : ''}
          </div>
          <div style={S.totBig}>{fmt(totalVisible)}</div>
          <div style={S.totFoot}>
            {groups.length} {axis === 'grupo' ? 'macrogrupos' : 'pavimentos'} · {visible.length} itens
            {q ? ` · filtro: "${q}"` : ''}
          </div>
        </div>

        {/* Controles */}
        <div style={S.controls}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={S.lbl}>Buscar</label>
            <input
              style={{ ...S.input, width: '100%', boxSizing: 'border-box' }}
              placeholder="macrogrupo ou item..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
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

        {groups.map((g, gi) => {
          const gVal = g.rows.reduce((s, r) => s + val(r), 0)
          const gPct = totalVisible > 0 ? gVal / totalVisible : 0
          const barW = maxGroup > 0 ? (gVal / maxGroup) * 100 : 0
          const isOpen = !!open[g.key]

          // Subgroups (level 2)
          const subMap = {}
          g.rows.forEach(r => {
            const sk = axis === 'grupo' ? r.p : String(r.g)
            const sl = axis === 'grupo' ? r.p : r.n
            if (!subMap[sk]) subMap[sk] = { key: sk, label: sl, gNum: r.g, rows: [] }
            subMap[sk].rows.push(r)
          })
          const subs = Object.values(subMap)
          if (axis === 'grupo') {
            subs.sort((a, b) => {
              const ia = PAVS.indexOf(a.key), ib = PAVS.indexOf(b.key)
              return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
            })
          } else {
            subs.sort((a, b) => a.gNum - b.gNum)
          }

          // Badge
          const pavCount = new Set(g.rows.map(r => r.p)).size
          const badge = axis === 'grupo' ? g.gNum : gi + 1

          return (
            <div key={g.key} style={S.card}>
              {/* Header */}
              <div style={S.chead} onClick={() => toggle(g.key)}>
                <div style={S.badge}>{badge}</div>
                <div style={{ flex: 1 }}>
                  <div style={S.cname}>{g.label}</div>
                  <div style={S.cmeta}>
                    {g.rows.length} {g.rows.length === 1 ? 'item' : 'itens'}
                    {axis === 'grupo' ? ` · ${pavCount} ${pavCount === 1 ? 'pavimento' : 'pavimentos'}` : ''}
                  </div>
                </div>
                <div style={S.barWrap}>
                  <div style={S.bar}>
                    <div style={{ height: '100%', width: `${barW}%`, background: '#e6a338', borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                </div>
                <div style={S.cval}>
                  <div style={S.cvnum}>{fmt(gVal)}</div>
                  <div style={S.cvpct}>{fmtP(gPct)} do total</div>
                </div>
                <div style={{ color: '#6d675e', fontSize: 12, flexShrink: 0 }}>{isOpen ? '▲' : '▼'}|/div>
              </div>

              {/* Body */}
              {isOpen && (
                <div style={S.body}>
                  {subs.map(sub => {
                    const subVal = sub.rows.reduce((s, r) => s + val(r), 0)
                    const sortedItems = [...sub.rows].sort((a, b) => naturalSort(a.i, b.i))
                    return (
                      <div key={sub.key}>
                        <div style={S.subsec}>
                          {axis === 'grupo' ? `📐 ${sub.label}` : `${sub.gNum}. ${sub.label}`}
                        </div>
                        {sortedItems.map((r, ri) => (
                          <div key={`${r.i}-${ri}`} style={{ ...S.item, background: ri % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                            <span style={S.itemEap}>{r.i}</span>
                            <span style={S.itemDesc}>{r.d}</span>
                            <span style={S.itemMes}>M{String(r.a).padStart(2,'0')}–M{String(r.b).padStart(2,'0')}</span>
                            <span style={S.itemVal}>{fmt(val(r))}</span>
                          </div>
                        ))}
                        <div style={S.subtot}>
                          <span>subtotal {sub.label}:</span>
                          <span style={{ color: '#3fae86', fontWeight: 600 }}>{fmt(subVal)}</span>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ ...S.subtot, borderTop: '2px solid #2a2a31', marginTop: 0, padding: '10px 16px' }}>
                    <span style={{ color: '#a09a90' }}>total {g.label}:</span>
                    <span style={{ color: '#e6a338', fontWeight: 700, fontSize: 13 }}>{fmt(gVal)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Footer total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: 10, background: '#17171b', border: '1px solid #2a2a31', marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ece9e4' }}>TOTAL GERAL</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#e6a338' }}>{fmt(totalVisible)}</span>
        </div>
      </div>
    </div>
  )
}
