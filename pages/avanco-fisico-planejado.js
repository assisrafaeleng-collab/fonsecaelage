// pages/avanco-fisico-planejado.js
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'

const PAVS = ['1º','2º','3º','4º','5º','6º/Plat','Edifício']
const NOMES_MESES = ['jul','ago','set','out','nov','dez','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez','jan','fev']
const ANOS = [2026,2026,2026,2026,2026,2026,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2028,2028]

const fmtR = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
const fmtH = v => Math.round(v).toLocaleString('pt-BR') + ' Hh'
const fmtP = v => (v*100).toFixed(1).replace('.',',') + '%'

const S = {
  page: { minHeight:'100vh', background:'#0f0f11', color:'#ece9e4', fontFamily:'"Segoe UI",system-ui,sans-serif', fontVariantNumeric:'tabular-nums' },
  wrap: { maxWidth:1100, margin:'0 auto', padding:'0 20px 40px' },
  eyebrow: { color:'#6d675e', fontSize:11, letterSpacing:1.4, textTransform:'uppercase', paddingTop:28, marginBottom:2 },
  h1: { fontSize:22, fontWeight:600, margin:'2px 0 2px' },
  sub: { color:'#a09a90', fontSize:13, marginBottom:18 },
  nav: { display:'flex', gap:8, marginBottom:16 },
  navBtn: { background:'transparent', border:'1px solid #2a2a31', color:'#a09a90', borderRadius:8, padding:'7px 14px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  kpiGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 },
  kpi: { background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, padding:'14px 16px' },
  kpiLbl: { color:'#6d675e', fontSize:10, letterSpacing:1, textTransform:'uppercase', marginBottom:4 },
  kpiVal: { fontSize:22, fontWeight:700 },
  kpiSub: { color:'#a09a90', fontSize:11, marginTop:3 },
  controls: { display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'flex-end' },
  lbl: { display:'block', color:'#6d675e', fontSize:10, letterSpacing:.5, textTransform:'uppercase', marginBottom:4 },
  select: { background:'#1e1e24', border:'1px solid #2a2a31', color:'#ece9e4', borderRadius:8, padding:'8px 11px', fontSize:13, fontFamily:'inherit' },
  input: { background:'#1e1e24', border:'1px solid #2a2a31', color:'#ece9e4', borderRadius:8, padding:'8px 11px', fontSize:13, fontFamily:'inherit', minWidth:180 },
  seg: { display:'flex', background:'#1e1e24', border:'1px solid #2a2a31', borderRadius:8, overflow:'hidden' },
  card: { background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, marginBottom:8, overflow:'hidden' },
  chead: { display:'flex', alignItems:'center', gap:10, padding:'13px 16px', cursor:'pointer', userSelect:'none' },
  badge: { width:28, height:28, borderRadius:6, background:'#1e1e24', border:'1px solid #2a2a31', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#a09a90', fontWeight:600, flexShrink:0 },
  body: { borderTop:'1px solid #2a2a31' },
  subsec: { padding:'10px 16px 4px', color:'#3fae86', fontSize:11, letterSpacing:.5, textTransform:'uppercase', fontWeight:600 },
  empty: { color:'#6d675e', textAlign:'center', padding:32, fontSize:14 },
  timeline: { display:'flex', gap:2, alignItems:'center', height:8, borderRadius:4, overflow:'hidden', background:'#1e1e24', flex:1 },
}

function Seg({ value, onChange, options }) {
  return (
    <div style={S.seg}>
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{
          background: value===o.v ? '#e6a338' : 'transparent',
          color: value===o.v ? '#231803' : '#a09a90',
          border:0, padding:'8px 12px', fontSize:12, cursor:'pointer',
          fontFamily:'inherit', whiteSpace:'nowrap', fontWeight: value===o.v ? 600 : 400,
        }}>{o.l}</button>
      ))}
    </div>
  )
}

function TimelineBar({ a, b, mes, total=20 }) {
  const start = ((a-1)/total)*100
  const width = ((b-a+1)/total)*100
  const active = mes >= a && mes <= b
  const done = mes > b
  const color = done ? '#4D9B6A' : active ? '#e6a338' : '#2a2a31'
  return (
    <div style={{ position:'relative', height:6, background:'#1e1e24', borderRadius:3, flex:1, minWidth:80 }}>
      <div style={{ position:'absolute', left:`${start}%`, width:`${width}%`, height:'100%', background:color, borderRadius:3, opacity: active||done ? 1 : 0.4 }} />
      {mes >= 1 && mes <= 20 && (
        <div style={{ position:'absolute', left:`${((mes-1)/total)*100}%`, top:'-2px', width:2, height:10, background:'#e6a338', borderRadius:1 }} />
      )}
    </div>
  )
}

export default function AvancoFisicoPlanejado() {
  const router = useRouter()
  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(1)
  const [pavF, setPavF] = useState('__ALL__')
  const [statusF, setStatusF] = useState('todos')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  const [metric, setMetric] = useState('pct') // 'pct' | 'custo' | 'hh'

  useEffect(() => {
    fetch('/dados.json').then(r => r.json()).then(d => { setDados(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const totHh = useMemo(() => dados.reduce((s,r) => s+r.h, 0) || 1, [dados])
  const totC = useMemo(() => dados.reduce((s,r) => s+r.c, 0) || 1, [dados])

  const valItem = r => {
    if (metric==='custo') return r.c
    if (metric==='hh') return r.h
    return r.h / totHh
  }
  const fmtVal = v => {
    if (metric==='custo') return fmtR(v)
    if (metric==='hh') return fmtH(v)
    return fmtP(v)
  }

  const getStatus = (a, b) => {
    if (mes > b) return 'concluido'
    if (mes >= a) return 'andamento'
    return 'futuro'
  }

  const ql = q.toLowerCase()

  const visible = useMemo(() => dados.filter(r => {
    if (pavF !== '__ALL__' && r.p !== pavF) return false
    if (ql && !r.n.toLowerCase().includes(ql) && !r.d.toLowerCase().includes(ql)) return false
    const st = getStatus(r.a, r.b)
    if (statusF === 'andamento' && st !== 'andamento') return false
    if (statusF === 'concluido' && st !== 'concluido') return false
    if (statusF === 'futuro' && st !== 'futuro') return false
    // Mostrar apenas grupos com atividade iniciada ou adiantada
    return r.a <= mes && r.g !== 17 && r.g !== 18 // excluir locacoes e funcionarios
  }), [dados, pavF, ql, mes, statusF])

  // Agrupar por macrogrupo
  const groups = useMemo(() => {
    const map = {}
    visible.forEach(r => {
      const key = String(r.g)
      if (!map[key]) map[key] = { key, label:r.n, gNum:r.g, rows:[], aMin:r.a, bMax:r.b }
      map[key].rows.push(r)
      map[key].aMin = Math.min(map[key].aMin, r.a)
      map[key].bMax = Math.max(map[key].bMax, r.b)
    })
    return Object.values(map).sort((a,b) => a.gNum-b.gNum)
  }, [visible])

  // KPIs
  const totalPlanPeriodo = useMemo(() => {
    return dados.filter(r => r.a <= mes && (pavF==='__ALL__' || r.p===pavF)).reduce((s,r) => s+valItem(r), 0)
  }, [dados, mes, pavF, metric, totHh])

  const totalGeral = useMemo(() => {
    return dados.filter(r => pavF==='__ALL__' || r.p===pavF).reduce((s,r) => s+valItem(r), 0)
  }, [dados, pavF, metric, totHh])

  const gruposAtivos = useMemo(() => {
    const gs = new Set(visible.filter(r => getStatus(r.a,r.b)==='andamento').map(r=>r.g))
    return gs.size
  }, [visible, mes])

  const pctAvanco = totalGeral > 0 ? (totalPlanPeriodo/totalGeral*100) : 0

  const toggle = key => setOpen(o => ({...o, [key]: !o[key]}))

  if (loading) return <div style={S.page}><div style={{padding:40,color:'#a09a90'}}>Carregando...</div></div>

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.eyebrow}>Avanço físico planejado</div>
        <div style={S.h1}>Flats Pampulha</div>
        <div style={S.sub}>20 meses · Jul/2026 a Fev/2028{pavF!=='__ALL__' ? ` · ${pavF}` : ''}</div>

        <div style={S.nav}>
          <button style={S.navBtn} onClick={() => router.push('/')}>← Dashboard</button>
          <button style={S.navBtn} onClick={() => router.push('/avanco-fisico-realizado')}>📍 Realizado</button>
        </div>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={{...S.kpi, borderLeft:'3px solid #e6a338'}}>
            <div style={S.kpiLbl}>Avanço acumulado M{mes}</div>
            <div style={{...S.kpiVal, color:'#e6a338'}}>{pctAvanco.toFixed(1)}%</div>
            <div style={S.kpiSub}>{NOMES_MESES[mes-1]}/{ANOS[mes-1]}</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #5B9BD5'}}>
            <div style={S.kpiLbl}>{metric==='pct'?'% Físico':metric==='custo'?'Valor no período':'Hh no período'}</div>
            <div style={{...S.kpiVal, color:'#5B9BD5', fontSize:18}}>{fmtVal(totalPlanPeriodo)}</div>
            <div style={S.kpiSub}>acumulado até M{mes}</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #3fae86'}}>
            <div style={S.kpiLbl}>Grupos em andamento</div>
            <div style={{...S.kpiVal, color:'#3fae86'}}>{gruposAtivos}</div>
            <div style={S.kpiSub}>de {groups.length} grupos visíveis</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #a09a90'}}>
            <div style={S.kpiLbl}>Total {pavF!=='__ALL__'?pavF:'geral'}</div>
            <div style={{...S.kpiVal, fontSize:16, color:'#ece9e4'}}>{fmtVal(totalGeral)}</div>
            <div style={S.kpiSub}>{visible.length} itens</div>
          </div>
        </div>

        {/* Timeline global */}
        <div style={{background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, padding:'14px 18px', marginBottom:16}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:11, color:'#6d675e'}}>
            <span>Jul/2026 (M1)</span>
            <span style={{color:'#e6a338', fontWeight:600}}>▼ M{mes} — {NOMES_MESES[mes-1]}/{ANOS[mes-1]}</span>
            <span>Fev/2028 (M20)</span>
          </div>
          <div style={{position:'relative', height:8, background:'#1e1e24', borderRadius:4}}>
            <div style={{position:'absolute', left:0, height:'100%', width:`${(mes/20)*100}%`, background:'linear-gradient(90deg,#e6a338,#C8860A)', borderRadius:4}} />
            <div style={{position:'absolute', left:`${((mes-1)/20)*100}%`, top:'-3px', width:3, height:14, background:'#e6a338', borderRadius:2}} />
          </div>
          <div style={{display:'flex', justifyContent:'space-between', marginTop:6, fontSize:9, color:'#6d675e'}}>
            {Array.from({length:20},(_,i)=>(
              <span key={i} style={{color:i+1===mes?'#e6a338':'#6d675e', fontWeight:i+1===mes?700:400}}>M{i+1}</span>
            ))}
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
            <label style={S.lbl}>Status</label>
            <Seg value={statusF} onChange={setStatusF} options={[
              {v:'todos',l:'Todos'},
              {v:'andamento',l:'Em andamento'},
              {v:'concluido',l:'Concluído'},
              {v:'futuro',l:'Futuro'},
            ]} />
          </div>
          <div>
            <label style={S.lbl}>Métrica</label>
            <Seg value={metric} onChange={setMetric} options={[{v:'pct',l:'%'},{v:'custo',l:'R$'},{v:'hh',l:'Hh'}]} />
          </div>
        </div>

        {groups.length === 0 && <div style={S.empty}>Nenhum grupo ativo neste período.</div>}

        {groups.map((g, gi) => {
          const gVal = g.rows.reduce((s,r) => s+valItem(r), 0)
          const gSt = getStatus(g.aMin, g.bMax)
          const stColor = gSt==='concluido'?'#4D9B6A':gSt==='andamento'?'#e6a338':'#6d675e'
          const stLabel = gSt==='concluido'?'Concluído':gSt==='andamento'?'Em andamento':'Programado'
          const isOpen = !!open[g.key]

          // Subgroups por pavimento
          const subMap = {}
          g.rows.forEach(r => {
            if (!subMap[r.p]) subMap[r.p] = {key:r.p, rows:[]}
            subMap[r.p].rows.push(r)
          })
          const subs = Object.values(subMap).sort((a,b) => {
            const ia=PAVS.indexOf(a.key), ib=PAVS.indexOf(b.key)
            return (ia===-1?99:ia)-(ib===-1?99:ib)
          })

          return (
            <div key={g.key} style={{...S.card, borderLeft:`3px solid ${stColor}`}}>
              <div style={S.chead} onClick={() => toggle(g.key)}>
                <div style={S.badge}>{g.gNum}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13, fontWeight:500}}>{g.label}</div>
                  <div style={{fontSize:10, color:'#6d675e', marginTop:1, display:'flex', gap:8, alignItems:'center'}}>
                    <span style={{color:stColor}}>● {stLabel}</span>
                    <span>M{g.aMin}–M{g.bMax}</span>
                    <span>{g.rows.length} itens</span>
                  </div>
                </div>
                <div style={{flex:1, maxWidth:200, padding:'0 12px'}}>
                  <TimelineBar a={g.aMin} b={g.bMax} mes={mes} />
                </div>
                <div style={{textAlign:'right', minWidth:100}}>
                  <div style={{fontSize:13, fontWeight:600, color:'#5B9BD5'}}>{fmtVal(gVal)}</div>
                  <div style={{fontSize:9, color:'#6d675e'}}>planejado total</div>
                </div>
                <div style={{color:'#6d675e', fontSize:12, marginLeft:8}}>{isOpen?'▲':'▼'}</div>
              </div>

              {isOpen && (
                <div style={S.body}>
                  {subs.map(sub => {
                    const subVal = sub.rows.reduce((s,r) => s+valItem(r), 0)
                    return (
                      <div key={sub.key}>
                        <div style={S.subsec}>📐 {sub.key}</div>
                        {/* Header */}
                        <div style={{display:'grid', gridTemplateColumns:'50px 1fr 100px 80px 120px', gap:6, padding:'5px 16px', fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #1a1a20'}}>
                          <span>EAP</span><span>Descrição</span><span>Período</span><span>Timeline</span><span style={{textAlign:'right'}}>Valor</span>
                        </div>
                        {[...sub.rows].sort((a,b) => a.i.localeCompare(b.i,undefined,{numeric:true})).map((r,ri) => {
                          const st = getStatus(r.a, r.b)
                          const stC = st==='concluido'?'#4D9B6A':st==='andamento'?'#e6a338':'#6d675e'
                          return (
                            <div key={`${r.i}-${ri}`} style={{display:'grid', gridTemplateColumns:'50px 1fr 100px 80px 120px', gap:6, padding:'5px 16px', fontSize:11, alignItems:'center', background:ri%2===0?'rgba(255,255,255,0.01)':'transparent'}}>
                              <span style={{color:'#6d675e', fontFamily:'monospace', fontSize:10}}>{r.i}</span>
                              <span style={{color:'#a09a90'}}>{r.d}</span>
                              <span style={{color:stC, fontSize:10}}>M{String(r.a).padStart(2,'0')}–M{String(r.b).padStart(2,'0')}</span>
                              <div><TimelineBar a={r.a} b={r.b} mes={mes} /></div>
                              <span style={{textAlign:'right', color:'#5B9BD5', fontWeight:500}}>{fmtVal(valItem(r))}</span>
                            </div>
                          )
                        })}
                        <div style={{display:'flex', justifyContent:'flex-end', gap:8, padding:'8px 16px', borderTop:'1px solid #2a2a31', fontSize:12, color:'#6d675e'}}>
                          subtotal {sub.key}: <span style={{color:'#5B9BD5', fontWeight:600}}>{fmtVal(subVal)}</span>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{display:'flex', justifyContent:'space-between', padding:'10px 16px', borderTop:'2px solid #2a2a31', fontSize:12, fontWeight:700}}>
                    <span style={{color:'#a09a90'}}>Total {g.label}:</span>
                    <span style={{color:'#5B9BD5'}}>{fmtVal(gVal)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Footer */}
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', borderRadius:10, background:'#17171b', border:'1px solid #2a2a31', marginTop:8}}>
          <span style={{fontSize:13, fontWeight:700}}>TOTAL GERAL{pavF!=='__ALL__'?` — ${pavF}`:''}</span>
          <span style={{fontSize:16, fontWeight:700, color:'#5B9BD5'}}>{fmtVal(totalGeral)}</span>
        </div>
      </div>
    </div>
  )
}
