// pages/custos-diretos-realizados-lista.js
import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'

const PAVS = ['1º','2º','3º','4º','5º','6º/Plat','Edifício']
const fmtR = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
const fmtH = v => Math.round(v).toLocaleString('pt-BR') + ' Hh'
const fmtP = v => (v * 100).toFixed(1).replace('.', ',') + '%'

const COMP_MAP = {'2026-07':'M1','2026-08':'M2','2026-09':'M3','2026-10':'M4','2026-11':'M5','2026-12':'M6','2027-01':'M7','2027-02':'M8','2027-03':'M9','2027-04':'M10','2027-05':'M11','2027-06':'M12','2027-07':'M13','2027-08':'M14','2027-09':'M15','2027-10':'M16','2027-11':'M17','2027-12':'M18','2028-01':'M19','2028-02':'M20'}
function compLabel(comp) { return COMP_MAP[comp] || comp }

/* ---- Paleta unica do painel. Mudar aqui muda a tela inteira. ---- */
const C = {
  bg:    '#14161a',  // fundo da pagina
  surf:  '#1b1e24',  // cartoes
  surf2: '#22262d',  // campos, trilhos
  bd:    '#282c33',  // divisor
  bd2:   '#1e2127',  // divisor interno
  fg:    '#e8eaed',  // numero principal (realizado)
  fg2:   '#c5c9d0',  // texto corrido
  fg3:   '#8b919c',  // rotulo, valor de referencia (planejado)
  fg4:   '#5a616b',  // sem dado
  accent:'#7fa8d4',  // interacao (links, foco) - nunca dado
  ok:    '#7fb08a',  // economia
  warn:  '#d9a05b',  // atencao
  over:  '#c77b74',  // estouro
}

/* Zona morta: desvio pequeno nao ganha cor. So sai do cinza
   quem passou de 15% (atencao) ou 30% (estouro). */
const LIM_NEUTRO = 15
const LIM_ALERTA = 30
function corDesvio(p) {
  if (p <= -LIM_NEUTRO) return C.ok
  if (p >= LIM_ALERTA)  return C.over
  if (p >= LIM_NEUTRO)  return C.warn
  return C.fg3
}
/* Segundo canal de leitura: funciona impresso em preto e branco. */
const seta = p => p > 0 ? '\u25b2 ' : p < 0 ? '\u25bc ' : ''
const fmtDesvio = p => seta(p) + Math.abs(p).toFixed(1).replace('.', ',') + '%'

const S = {
  page: { minHeight:'100vh', background:C.bg, color:C.fg, fontFamily:'"Segoe UI",system-ui,sans-serif', fontVariantNumeric:'tabular-nums' },
  wrap: { maxWidth:1140, margin:'0 auto', padding:'0 20px 40px' },
  eyebrow: { color:C.fg3, fontSize:11, letterSpacing:1.4, textTransform:'uppercase', paddingTop:28, marginBottom:2 },
  h1: { fontSize:22, fontWeight:600, margin:'2px 0 2px' },
  sub: { color:C.fg2, fontSize:13, marginBottom:18 },
  nav: { display:'flex', gap:8, marginBottom:16 },
  navBtn: { background:'transparent', border:`1px solid ${C.bd}`, color:C.fg2, borderRadius:8, padding:'7px 14px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  kpiGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 },
  kpi: { background:C.surf, border:`1px solid ${C.bd}`, borderRadius:12, padding:'14px 16px' },
  kpiLbl: { color:C.fg3, fontSize:10, letterSpacing:1, textTransform:'uppercase', marginBottom:4 },
  kpiVal: { fontSize:22, fontWeight:700 },
  kpiSub: { color:C.fg2, fontSize:11, marginTop:3 },
  controls: { display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'flex-end' },
  lbl: { display:'block', color:C.fg3, fontSize:10, letterSpacing:.5, textTransform:'uppercase', marginBottom:4 },
  select: { background:C.surf2, border:`1px solid ${C.bd}`, color:C.fg, borderRadius:8, padding:'8px 11px', fontSize:13, fontFamily:'inherit' },
  input: { background:C.surf2, border:`1px solid ${C.bd}`, color:C.fg, borderRadius:8, padding:'8px 11px', fontSize:13, fontFamily:'inherit', minWidth:160 },
  seg: { display:'flex', background:C.surf2, border:`1px solid ${C.bd}`, borderRadius:8, overflow:'hidden' },
  card: { background:C.surf, border:`1px solid ${C.bd}`, borderRadius:12, marginBottom:8, overflow:'hidden' },
  chead: { display:'flex', alignItems:'center', gap:10, padding:'13px 16px', cursor:'pointer', userSelect:'none' },
  badge: { width:28, height:28, borderRadius:6, background:C.surf2, border:`1px solid ${C.bd}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:C.fg2, fontWeight:600, flexShrink:0 },
  body: { borderTop:`1px solid ${C.bd}` },
  subsec: { padding:'10px 16px 4px', color:C.fg2, fontSize:11, letterSpacing:.5, textTransform:'uppercase', fontWeight:600 },
  empty: { color:C.fg3, textAlign:'center', padding:32, fontSize:14 },
  thRow: { display:'grid', gridTemplateColumns:'50px 1fr 120px 120px 80px 80px', gap:6, padding:'6px 16px 4px', fontSize:9, color:C.fg3, textTransform:'uppercase', letterSpacing:'.5px', borderBottom:`1px solid ${C.bd}` },
  itemRow: { display:'grid', gridTemplateColumns:'50px 1fr 120px 120px 80px 80px', gap:6, padding:'5px 16px', fontSize:11, alignItems:'center' },
}

function Seg({ value, onChange, options }) {
  return (
    <div style={S.seg}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          background: value===o.v ? C.fg : 'transparent',
          color: value===o.v ? C.bg : C.fg3,
          border:0, padding:'8px 12px', fontSize:12, cursor:'pointer',
          fontFamily:'inherit', whiteSpace:'nowrap', fontWeight: value===o.v ? 600 : 400,
        }}>{o.l}</button>
      ))}
    </div>
  )
}

function MiniBar({ pct }) {
  const cor = pct > 115 ? C.over : pct > 105 ? C.warn : pct > 0 ? C.fg3 : C.fg4
  const w = Math.min(pct, 100)
  return (
    <div style={{ height:5, background:C.surf2, borderRadius:3, overflow:'hidden', width:'100%' }}>
      <div style={{ height:'100%', width:`${w}%`, background:cor, borderRadius:3 }} />
    </div>
  )
}

export default function CustosDiretosRealizados() {
  const router = useRouter()
  const [dados, setDados] = useState([])
  const [lanc, setLanc] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarLista, setMostrarLista] = useState(false)
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos')
  const [filtroGrupo, setFiltroGrupo] = useState('todos')
  const [filtroPavimento, setFiltroPavimento] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [axis, setAxis] = useState('grupo')
  const [metric, setMetric] = useState('custo')
  const [pavF, setPavF] = useState('__ALL__')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  const [openItem, setOpenItem] = useState({})
  const [mes, setMes] = useState(1)

  const NOMES_MESES = ['jul','ago','set','out','nov','dez','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez','jan','fev']
  const ANOS = [2026,2026,2026,2026,2026,2026,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2028,2028]

  useEffect(() => {
    async function load() {
      try {
        const [d, l] = await Promise.all([
          fetch('/api/orcamento-itens', { cache: 'no-store' }).then(r => r.json()),
          fetch('/api/custos-diretos-realizados-lista').then(r => r.json()),
        ])
        setDados(d || [])
        setLanc(l.lancamentos || [])
      } catch(e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const totHh = useMemo(() => dados.reduce((s,r) => s+r.h, 0) || 1, [dados])

  // Data limite do período (sem bug de fuso horário)
  const dataLimite = useMemo(() => {
    // Obra começa em julho/2026 = mês 7. mes=1 -> 2026-07, mes=2 -> 2026-08, etc.
    const mesReal = 7 + (mes - 1)
    const ano = 2026 + Math.floor((mesReal - 1) / 12)
    const mesFinal = ((mesReal - 1) % 12) + 1
    return `${ano}-${String(mesFinal).padStart(2,'0')}`
  }, [mes])

  // Lançamentos filtrados até o período
  const lancFiltrados = useMemo(() => lanc.filter(l => {
    const comp = l.competencia || ''
    return comp <= dataLimite
  }), [lanc, dataLimite])

  // Grupos únicos para filtro
  const gruposUnicos = useMemo(() => {
    const set = new Set()
    dados.forEach(r => set.add(JSON.stringify({g: r.g, n: r.n})))
    return Array.from(set).map(s => JSON.parse(s)).sort((a,b) => a.g - b.g)
  }, [dados])

  // Pavimentos únicos
  const pavimentosUnicos = useMemo(() => {
    const set = new Set()
    dados.forEach(r => r.p && set.add(r.p))
    return Array.from(set).sort()
  }, [dados])

  // Map EAP -> {grupo_num, grupo_nome, pavimento}
  const eapMap = useMemo(() => {
    const m = {}
    dados.forEach(r => {
      m[r.i] = { g: r.g, n: r.n, p: r.p }
    })
    return m
  }, [dados])

  // Lançamentos com filtros aplicados
  const lancamentosParaLista = useMemo(() => {
    return lanc.filter(l => {
      const eap = l.codigo_eap || ''
      const info = eapMap[eap] || {}
      // Período
      if (filtroPeriodo !== 'todos') {
        const compM = compLabel(l.competencia)
        if (compM !== filtroPeriodo) return false
      }
      // Grupo
      if (filtroGrupo !== 'todos') {
        if (String(info.g) !== filtroGrupo) return false
      }
      // Pavimento
      if (filtroPavimento !== 'todos') {
        if (info.p !== filtroPavimento) return false
      }
      // Busca
      if (filtroBusca.trim()) {
        const q = filtroBusca.toLowerCase()
        const desc = (l.descricao || l.historico || '').toLowerCase()
        if (!desc.includes(q) && !eap.includes(q)) return false
      }
      return true
    }).sort((a,b) => (b.data_emissao || '').localeCompare(a.data_emissao || ''))
  }, [lanc, eapMap, filtroPeriodo, filtroGrupo, filtroPavimento, filtroBusca])


  // Realizado por grupo + pavimento
  const realizadoMap = useMemo(() => {
    const map = {}
    lancFiltrados.forEach(l => {
      const eap = l.codigo_eap || ''
      const gNum = parseInt(eap.split('.')[0])
      const pav = l.pavimento || 'Edifício'
      const key = `${gNum}|${pav}`
      if (!map[key]) map[key] = { total: 0, itens: [] }
      map[key].total += parseFloat(l.valor || 0)
      map[key].itens.push(l)
    })
    return map
  }, [lancFiltrados])

  // Realizado por EAP + pavimento
  const realizadoEapMap = useMemo(() => {
    const map = {}
    lancFiltrados.forEach(l => {
      const eap = l.codigo_eap || ''
      const pav = l.pavimento || 'Edifício'
      const key = `${eap}|${pav}`
      if (!map[key]) map[key] = { total: 0, lancs: [] }
      map[key].total += parseFloat(l.valor || 0)
      map[key].lancs.push(l)
    })
    return map
  }, [lancFiltrados])

  const valPlan = (r) => {
    if (mes < r.a) return 0
    const numMeses = Math.max(r.b - r.a + 1, 1)
    const mesesAtivos = Math.min(mes, r.b) - r.a + 1
    if (metric==='custo') return r.c * mesesAtivos / numMeses
    if (metric==='hh') return r.h * mesesAtivos / numMeses
    return (r.h * mesesAtivos / numMeses) / totHh
  }
  const fmtVal = (v) => {
    if (metric==='custo') return fmtR(v)
    if (metric==='hh') return fmtH(v)
    return fmtP(v)
  }

  const ql = q.toLowerCase()

  // Filtro por período — mostrar apenas grupos ativos no período
  const visible = useMemo(() => dados.filter(r => {
    if (pavF !== '__ALL__' && r.p !== pavF) return false
    if (ql && !r.n.toLowerCase().includes(ql) && !r.d.toLowerCase().includes(ql)) return false
    const ativoPeriodo = r.a <= mes
    const temRealizado = (realizadoEapMap[`${r.i}|${r.p}`] ? realizadoEapMap[`${r.i}|${r.p}`].total : 0) > 0
    return ativoPeriodo || temRealizado
  }), [dados, pavF, ql, mes, realizadoEapMap])

  const groups = useMemo(() => {
    const map = {}
    visible.forEach(r => {
      const key = axis==='grupo' ? String(r.g) : r.p
      if (!map[key]) map[key] = { key, label: axis==='grupo' ? r.n : r.p, gNum: r.g, rows: [] }
      map[key].rows.push(r)
    })
    const arr = Object.values(map)
    if (axis==='grupo') arr.sort((a,b) => a.gNum-b.gNum)
    else arr.sort((a,b) => {
      const ia=PAVS.indexOf(a.key), ib=PAVS.indexOf(b.key)
      return (ia===-1?99:ia)-(ib===-1?99:ib)
    })
    return arr
  }, [visible, axis])

  const totalPlan = useMemo(() => visible.reduce((s,r) => s+valPlan(r), 0), [visible, metric, totHh])
  const totalReal = useMemo(() => lancFiltrados.reduce((s,l) => s+parseFloat(l.valor||0), 0), [lancFiltrados])
  const desvio = totalPlan > 0 ? ((totalReal-totalPlan)/totalPlan*100) : 0

  const toggle = key => setOpen(o => ({...o, [key]: !o[key]}))
  const toggleItem = key => setOpenItem(o => ({...o, [key]: !o[key]}))

  if (loading) return <div style={S.page}><div style={{padding:40,color:C.fg2}}>Carregando...</div></div>

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.eyebrow}>Custos diretos — planejado vs realizado</div>
        <div style={S.h1}>Flats Pampulha</div>
        <div style={S.sub}>20 meses · Jul/2026 a Fev/2028</div>

        <div style={S.nav}>
          <button style={S.navBtn} onClick={() => router.push('/')}>← Dashboard</button>
          <button style={S.navBtn} onClick={() => router.push('/custos-diretos-planejados')}>📋 Planejado</button>
        </div>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={{...S.kpi, borderLeft:`3px solid ${C.bd}`}}>
            <div style={S.kpiLbl}>Planejado até M{mes} — {NOMES_MESES[mes-1]}/{ANOS[mes-1]}</div>
            <div style={{...S.kpiVal, color:C.fg3}}>{fmtVal(totalPlan)}</div>
            <div style={S.kpiSub}>{groups.length} grupos · {visible.length} itens ativos</div>
          </div>
          <div style={{...S.kpi, borderLeft:`3px solid ${C.bd}`}}>
            <div style={S.kpiLbl}>Realizado até M{mes}</div>
            <div style={{...S.kpiVal, color:C.fg}}>{fmtR(totalReal)}</div>
            <div style={S.kpiSub}>{lancFiltrados.length} lançamentos</div>
          </div>
          <div style={{...S.kpi, borderLeft:`3px solid ${corDesvio(desvio)}`}}>
            <div style={S.kpiLbl}>Desvio financeiro</div>
            <div style={{...S.kpiVal, fontSize:20, color: corDesvio(desvio)}}>
              {fmtDesvio(desvio)}
            </div>
            <div style={S.kpiSub}>{desvio >= LIM_ALERTA ? 'Acima do planejado' : desvio >= LIM_NEUTRO ? 'Levemente acima' : desvio <= -LIM_NEUTRO ? 'Economia sobre o planejado' : 'Em linha com o planejado'}</div>
          </div>
        </div>

        {/* Controles */}
        <div style={S.controls}>
          <div>
            <label style={S.lbl}>Período</label>
            <select style={S.select} value={mes} onChange={e => setMes(parseInt(e.target.value))}>
              {Array.from({length:20},(_,i) => (
                <option key={i+1} value={i+1}>M{i+1} — {NOMES_MESES[i]}/{ANOS[i]}</option>
              ))}
            </select>
          </div>
          <div style={{flex:1, minWidth:150}}>
            <label style={S.lbl}>Buscar</label>
            <input style={{...S.input, width:'100%', boxSizing:'border-box'}} placeholder="🔍 grupo ou item..." value={q} onChange={e => setQ(e.target.value)} />
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
            <Seg value={axis} onChange={setAxis} options={[{v:'grupo',l:'Macrogrupo'},{v:'pav',l:'Pavimento'}]} />
          </div>
          <div>
            <label style={S.lbl}>Métrica</label>
            <Seg value={metric} onChange={setMetric} options={[{v:'custo',l:'R$'},{v:'hh',l:'Hh'},{v:'pct',l:'%'}]} />
          </div>
        </div>

        {groups.length === 0 && <div style={S.empty}>Nenhum grupo ativo neste período.</div>}

        {groups.map((g, gi) => {
          const gPlan = g.rows.reduce((s,r) => s+valPlan(r), 0)
          const gRealKey = `${g.gNum}|${pavF==='__ALL__' ? '' : pavF}`
          const gReal = metric==='custo' ? (() => {
            let total = 0
            Object.entries(realizadoMap).forEach(([key, val]) => {
              const [gn, pav] = key.split('|')
              if (parseInt(gn) === g.gNum) {
                if (pavF === '__ALL__' || pav === pavF) total += val.total
              }
            })
            return total
          })() : 0
          const gDesvio = gPlan > 0 ? ((gReal-gPlan)/gPlan*100) : 0
          const isOpen = !!open[g.key]
          const badge = axis==='grupo' ? g.gNum : gi+1

          // Subgroups
          const subMap = {}
          g.rows.forEach(r => {
            const sk = axis==='grupo' ? r.p : String(r.g)
            const sl = axis==='grupo' ? r.p : r.n
            if (!subMap[sk]) subMap[sk] = {key:sk, label:sl, gNum:r.g, rows:[]}
            subMap[sk].rows.push(r)
          })
          const subs = Object.values(subMap)
          if (axis==='grupo') subs.sort((a,b) => {const ia=PAVS.indexOf(a.key),ib=PAVS.indexOf(b.key);return(ia===-1?99:ia)-(ib===-1?99:ib)})
          else subs.sort((a,b) => a.gNum-b.gNum)

          return (
            <div key={g.key} style={S.card}>
              <div style={S.chead} onClick={() => toggle(g.key)}>
                <div style={S.badge}>{badge}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13, fontWeight:500}}>{g.label}</div>
                  <div style={{fontSize:10, color:C.fg3, marginTop:1}}>{g.rows.length} itens · M{Math.min(...g.rows.map(r=>r.a))}–M{Math.max(...g.rows.map(r=>r.b))}</div>
                </div>
                <div style={{textAlign:'right', minWidth:110}}>
                  <div style={{fontSize:12, color:C.fg3, fontWeight:600}}>{fmtVal(gPlan)}</div>
                  <div style={{fontSize:9, color:C.fg3}}>planejado</div>
                </div>
                <div style={{textAlign:'right', minWidth:110}}>
                  <div style={{fontSize:12, color:C.fg, fontWeight:600}}>{metric==='custo' ? fmtR(gReal) : '—'}</div>
                  <div style={{fontSize:9, color:C.fg3}}>realizado</div>
                </div>
                <div style={{textAlign:'right', minWidth:70}}>
                  <div style={{fontSize:12, fontWeight:700, color: corDesvio(gDesvio)}}>
                    {metric==='custo' ? fmtDesvio(gDesvio) : '—'}
                  </div>
                </div>
                <div style={{width:60}}>
                  <MiniBar pct={gPlan>0?(gReal/gPlan*100):0} />
                </div>
                <div style={{color:C.fg3, fontSize:12, flexShrink:0, marginLeft:4}}>{isOpen?'▲':'▼'}</div>
              </div>

              {isOpen && (
                <div style={S.body}>
                  {subs.map(sub => {
                    const subPlan = sub.rows.reduce((s,r) => s+valPlan(r), 0)
                    const subReal = metric==='custo' ? (() => {
                      let t=0
                      Object.entries(realizadoMap).forEach(([key,val]) => {
                        const [gn,pav]=key.split('|')
                        if (parseInt(gn)===sub.gNum && (axis==='grupo' ? pav===sub.key : parseInt(gn)===sub.gNum)) t+=val.total
                      })
                      return t
                    })() : 0

                    return (
                      <div key={sub.key}>
                        <div style={S.subsec}>📐 {sub.label}</div>
                        {/* Header colunas */}
                        <div style={S.thRow}>
                          <span>EAP</span>
                          <span>Descrição</span>
                          <span style={{textAlign:'right'}}>Planejado</span>
                          <span style={{textAlign:'right'}}>Realizado</span>
                          <span style={{textAlign:'right'}}>Desvio</span>
                          <span>Período</span>
                        </div>
                        {[...sub.rows].sort((a,b) => a.i.localeCompare(b.i,undefined,{numeric:true})).map((r,ri) => {
                          const rPav = axis==='grupo' ? sub.key : r.p
                          const rEapData = realizadoEapMap[`${r.i}|${rPav}`]
                          const rReal = rEapData ? rEapData.total : 0
                          const rLancs = rEapData ? rEapData.lancs : []
                          const rPlan = valPlan(r)
                          const rDesvio = rPlan > 0 ? ((rReal-rPlan)/rPlan*100) : 0
                          const itemKey = `${r.i}|${rPav}`
                          return (
                            <React.Fragment key={`${r.i}-${ri}`}>
                              <div style={{...S.itemRow, background: ri%2===0 ? 'rgba(255,255,255,0.01)' : 'transparent'}}>
                                <span style={{color:C.fg3, fontFamily:'monospace', fontSize:10}}>{r.i}</span>
                                <span style={{color:C.fg2, fontSize:11}}>{r.d}</span>
                                <span style={{textAlign:'right', color:C.fg3, fontWeight:500}}>{fmtVal(rPlan)}</span>
                                <span style={{textAlign:'right', color: rReal>0 ? C.fg : C.fg4, fontWeight: rReal>0 ? 600 : 400}}>
                                  {metric==='custo' ? (rReal>0 ? fmtR(rReal) : '—') : '—'}
                                </span>
                                <span style={{textAlign:'right', fontSize:11, color: rReal===0?C.fg4:corDesvio(rDesvio), fontWeight:600}}>
                                  {metric==='custo' && rReal>0 ? fmtDesvio(rDesvio) : '—'}
                                </span>
                                <span style={{display:'flex', alignItems:'center', gap:4}}>
                                  <span style={{color:C.fg3, fontSize:9}}>M{String(r.a).padStart(2,'0')}–M{String(r.b).padStart(2,'0')}</span>
                                  {rLancs.length > 0 && (
                                    <span
                                      style={{color:C.accent, fontSize:10, cursor:'pointer', marginLeft:4}}
                                      onClick={(e) => { e.stopPropagation(); toggleItem(itemKey); }}
                                    >
                                      {openItem[itemKey] ? '▲' : '▼'}
                                    </span>
                                  )}
                                </span>
                              </div>
                              {openItem[itemKey] && rLancs.length > 0 && (
                                <div style={{padding:'4px 16px 8px 66px', background:'rgba(255,255,255,0.02)', borderBottom:`1px solid ${C.bd2}`}}>
                                  <div style={{fontSize:10, color:C.fg3, display:'grid', gridTemplateColumns:'80px 1fr 100px 60px', gap:4, padding:'4px 0', borderBottom:`1px solid ${C.bd}`, fontWeight:600}}>
                                    <span>Data</span>
                                    <span>Descrição</span>
                                    <span style={{textAlign:'right'}}>Valor</span>
                                    <span style={{textAlign:'right'}}>Período</span>
                                  </div>
                                  {rLancs.map((lc, li) => (
                                    <div key={li} style={{fontSize:10, color:C.fg2, display:'grid', gridTemplateColumns:'80px 1fr 100px 60px', gap:4, padding:'3px 0', borderBottom:`1px solid ${C.bd2}`}}>
                                      <span>{lc.data_emissao ? lc.data_emissao.slice(0,10) : '—'}</span>
                                      <span>{lc.descricao || lc.codigo_eap}</span>
                                      <span style={{textAlign:'right', color:C.fg, fontWeight:500}}>{fmtR(parseFloat(lc.valor||0))}</span>
                                      <span style={{textAlign:'right', color:C.fg3}}>{compLabel(lc.competencia)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </React.Fragment>
                          )
                        })}
                        <div style={{display:'flex', justifyContent:'flex-end', gap:20, padding:'8px 16px', borderTop:`1px solid ${C.bd}`, fontSize:12}}>
                          <span style={{color:C.fg3}}>subtotal:</span>
                          <span style={{color:C.fg3, fontWeight:600}}>{fmtVal(subPlan)}</span>
                          {metric==='custo' && subReal>0 && <span style={{color:C.fg, fontWeight:600}}>{fmtR(subReal)} real</span>}
                        </div>
                      </div>
                    )
                  })}
                  <div style={{display:'flex', justifyContent:'space-between', padding:'10px 16px', borderTop:`2px solid ${C.bd}`, fontSize:12, fontWeight:700}}>
                    <span style={{color:C.fg2}}>Total {g.label}:</span>
                    <div style={{display:'flex', gap:20}}>
                      <span style={{color:C.fg3}}>Plan: {fmtVal(gPlan)}</span>
                      {metric==='custo' && <span style={{color:C.fg}}>Real: {fmtR(gReal)}</span>}
                      {metric==='custo' && gReal>0 && <span style={{color:corDesvio(gDesvio)}}>Desvio: {fmtDesvio(gDesvio)}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Footer */}
        <div style={{display:'grid', gridTemplateColumns:'1fr auto auto auto', gap:20, alignItems:'center', padding:'14px 18px', borderRadius:10, background:C.surf, border:`1px solid ${C.bd}`, marginTop:8}}>
          <span style={{fontSize:13, fontWeight:700}}>TOTAL GERAL</span>
          <span style={{fontSize:14, fontWeight:700, color:C.fg3}}>Plan: {fmtVal(totalPlan)}</span>
          {metric==='custo' && <span style={{fontSize:14, fontWeight:700, color:C.fg}}>Real: {fmtR(totalReal)}</span>}
          {metric==='custo' && <span style={{fontSize:14, fontWeight:700, color:corDesvio(desvio)}}>Desvio: {fmtDesvio(desvio)}</span>}
        </div>
      
        {/* Botão + Lista completa de lançamentos com filtros */}
        <div style={{marginTop:20}}>
          {!mostrarLista ? (
            <button onClick={() => setMostrarLista(true)} style={{
              width:'100%', padding:'14px 18px', background:C.surf, border:`1px solid ${C.bd}`,
              borderRadius:10, color:C.accent, fontSize:13, fontWeight:600, cursor:'pointer',
              fontFamily:'inherit'
            }}>
              📋 Ver todos os lançamentos ({lanc.length})
            </button>
          ) : (
            <div style={{background:C.surf, border:`1px solid ${C.bd}`, borderRadius:12, overflow:'hidden'}}>
              <div style={{padding:'14px 18px', borderBottom:`1px solid ${C.bd}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:12, fontWeight:600, color:C.fg2, textTransform:'uppercase', letterSpacing:.5}}>
                  Todos os lançamentos ({lancamentosParaLista.length}{lancamentosParaLista.length !== lanc.length ? ' de ' + lanc.length : ''})
                </span>
                <button onClick={() => setMostrarLista(false)} style={{background:'transparent', border:'none', color:C.fg3, fontSize:12, cursor:'pointer'}}>✕ Fechar</button>
              </div>
              {/* Filtros */}
              <div style={{padding:'12px 18px', borderBottom:`1px solid ${C.bd}`, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10}}>
                <div>
                  <div style={{fontSize:9, color:C.fg3, textTransform:'uppercase', letterSpacing:.5, marginBottom:4}}>Período</div>
                  <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} style={{width:'100%', background:C.bg, color:C.fg, border:`1px solid ${C.bd}`, borderRadius:6, padding:'6px 8px', fontSize:12, fontFamily:'inherit'}}>
                    <option value="todos">Todos</option>
                    {Object.values(COMP_MAP).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9, color:C.fg3, textTransform:'uppercase', letterSpacing:.5, marginBottom:4}}>Grupo</div>
                  <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} style={{width:'100%', background:C.bg, color:C.fg, border:`1px solid ${C.bd}`, borderRadius:6, padding:'6px 8px', fontSize:12, fontFamily:'inherit'}}>
                    <option value="todos">Todos</option>
                    {gruposUnicos.map(g => <option key={g.g} value={g.g}>{g.g} - {g.n}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9, color:C.fg3, textTransform:'uppercase', letterSpacing:.5, marginBottom:4}}>Pavimento</div>
                  <select value={filtroPavimento} onChange={e => setFiltroPavimento(e.target.value)} style={{width:'100%', background:C.bg, color:C.fg, border:`1px solid ${C.bd}`, borderRadius:6, padding:'6px 8px', fontSize:12, fontFamily:'inherit'}}>
                    <option value="todos">Todos</option>
                    {pavimentosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9, color:C.fg3, textTransform:'uppercase', letterSpacing:.5, marginBottom:4}}>Buscar</div>
                  <input type="text" value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} placeholder="descrição ou EAP..." style={{width:'100%', background:C.bg, color:C.fg, border:`1px solid ${C.bd}`, borderRadius:6, padding:'6px 8px', fontSize:12, fontFamily:'inherit', boxSizing:'border-box'}} />
                </div>
              </div>
              {/* Header da tabela */}
              <div style={{display:'grid', gridTemplateColumns:'100px 1fr 80px 100px 60px', gap:8, padding:'8px 18px', fontSize:9, color:C.fg3, textTransform:'uppercase', letterSpacing:.5, borderBottom:`1px solid ${C.bd}`}}>
                <span>Data</span><span>Descrição</span><span>EAP</span><span style={{textAlign:'right'}}>Valor</span><span style={{textAlign:'right'}}>M</span>
              </div>
              {/* Linhas */}
              <div style={{maxHeight:500, overflowY:'auto'}}>
                {lancamentosParaLista.length === 0 ? (
                  <div style={{padding:'30px', textAlign:'center', color:C.fg3, fontSize:12}}>Nenhum lançamento encontrado com os filtros aplicados.</div>
                ) : lancamentosParaLista.map((l, i) => (
                  <div key={i} style={{display:'grid', gridTemplateColumns:'100px 1fr 80px 100px 60px', gap:8, padding:'8px 18px', fontSize:12, alignItems:'center', background:i%2===0?'rgba(255,255,255,0.01)':'transparent', borderBottom:`1px solid ${C.bd2}`}}>
                    <span style={{color:C.fg3}}>{l.data_emissao?.slice(0,10)}</span>
                    <span style={{color:C.fg2}}>{l.descricao || l.historico}</span>
                    <span style={{color:C.fg3, fontFamily:'monospace', fontSize:10}}>{l.codigo_eap}</span>
                    <span style={{textAlign:'right', color:C.fg, fontWeight:600}}>{fmtR(l.valor)}</span>
                    <span style={{textAlign:'right', color:C.fg3, fontSize:11}}>{compLabel(l.competencia)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
</div>
    </div>
  )
}
