// pages/extrato-mensal.js
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'

const PAVS = ['1º','2º','3º','4º','5º','6º/Plat','Edifício']
const NOMES_MESES = ['jul','ago','set','out','nov','dez','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez','jan','fev']
const ANOS = [2026,2026,2026,2026,2026,2026,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2028,2028]

const fmtR = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
const fmtH = v => v.toFixed(1) + ' Hh'
const fmtRd = v => 'R$ ' + parseFloat(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})

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
  kpiVal: { fontSize:20, fontWeight:700 },
  kpiSub: { color:'#a09a90', fontSize:11, marginTop:3 },
  controls: { display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'flex-end' },
  lbl: { display:'block', color:'#6d675e', fontSize:10, letterSpacing:.5, textTransform:'uppercase', marginBottom:4 },
  select: { background:'#1e1e24', border:'1px solid #2a2a31', color:'#ece9e4', borderRadius:8, padding:'8px 11px', fontSize:13, fontFamily:'inherit' },
  input: { background:'#1e1e24', border:'1px solid #2a2a31', color:'#ece9e4', borderRadius:8, padding:'8px 11px', fontSize:13, fontFamily:'inherit', minWidth:180 },
  seg: { display:'flex', background:'#1e1e24', border:'1px solid #2a2a31', borderRadius:8, overflow:'hidden' },
  card: { background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, marginBottom:8, overflow:'hidden' },
  chead: { display:'flex', alignItems:'center', gap:10, padding:'13px 16px', cursor:'pointer', userSelect:'none' },
  badge: { width:28, height:28, borderRadius:6, background:'#1e1e24', border:'1px solid #2a2a31', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#a09a90', fontWeight:600, flexShrink:0 },
  body: { borderTop:'1px solid #2a2a31' },
  thRow: { display:'grid', gridTemplateColumns:'50px 1fr 80px 100px 100px', gap:6, padding:'6px 16px', fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #1a1a20' },
  itemRow: { display:'grid', gridTemplateColumns:'50px 1fr 80px 100px 100px', gap:6, padding:'6px 16px', fontSize:11, alignItems:'center' },
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

export default function ExtratoMensal() {
  const router = useRouter()
  const [dados, setDados] = useState([])
  const [indiretos, setIndiretos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(1)
  const [pavF, setPavF] = useState('__ALL__')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  const [view, setView] = useState('direto') // 'direto' | 'indireto'

  useEffect(() => {
    fetch('/api/orcamento-itens', { cache: 'no-store' }).then(r => r.json()).then(d => setDados(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/extrato-mensal?mes=${mes}`)
      .then(r => r.json())
      .then(d => { setIndiretos(d.indiretosDoMes || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [mes])

  // Itens diretos ativos no mês
  const ql = q.toLowerCase()
  const itensMes = useMemo(() => dados.filter(r => {
    if (r.a > mes || r.b < mes) return false
    if (pavF !== '__ALL__' && r.p !== pavF) return false
    if (ql && !r.n.toLowerCase().includes(ql) && !r.d.toLowerCase().includes(ql)) return false
    return true
  }), [dados, mes, pavF, ql])

  // Valor e Hh do item no mês (proporcional)
  const valMes = r => {
    const numMeses = Math.max(r.b - r.a + 1, 1)
    return { custo: r.c / numMeses, hh: r.h / numMeses }
  }

  // Agrupar por macrogrupo
  const groups = useMemo(() => {
    const map = {}
    itensMes.forEach(r => {
      const key = String(r.g)
      if (!map[key]) map[key] = { key, label:r.n, gNum:r.g, rows:[] }
      map[key].rows.push(r)
    })
    return Object.values(map).sort((a,b) => a.gNum-b.gNum)
  }, [itensMes])

  const totalDiretoMes = useMemo(() => itensMes.reduce((s,r) => s + valMes(r).custo, 0), [itensMes])
  const totalHhMes = useMemo(() => itensMes.reduce((s,r) => s + valMes(r).hh, 0), [itensMes])
  const totalIndiretoMes = useMemo(() => indiretos.reduce((s,i) => s + i.valor, 0), [indiretos])
  const totalMes = totalDiretoMes + totalIndiretoMes

  const toggle = key => setOpen(o => ({...o, [key]: !o[key]}))

  if (loading) return <div style={S.page}><div style={{padding:40,color:'#a09a90'}}>Carregando...</div></div>

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.eyebrow}>Extrato mensal planejado</div>
        <div style={S.h1}>Flats Pampulha — M{mes} · {NOMES_MESES[mes-1]}/{ANOS[mes-1]}</div>
        <div style={S.sub}>O que está previsto para este mês</div>

        <div style={S.nav}>
          <button style={S.navBtn} onClick={() => router.push('/')}>← Dashboard</button>
          <button style={S.navBtn} onClick={() => router.push('/custos-diretos-planejados')}>📋 Custos Diretos</button>
          <button style={S.navBtn} onClick={() => router.push('/custos-indiretos-planejados')}>📋 Custos Indiretos</button>
        </div>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={{...S.kpi, borderLeft:'3px solid #e6a338'}}>
            <div style={S.kpiLbl}>Total do mês</div>
            <div style={{...S.kpiVal, color:'#e6a338', fontSize:18}}>{fmtRd(totalMes)}</div>
            <div style={S.kpiSub}>direto + indireto</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #5B9BD5'}}>
            <div style={S.kpiLbl}>Custo direto M{mes}</div>
            <div style={{...S.kpiVal, color:'#5B9BD5', fontSize:18}}>{fmtRd(totalDiretoMes)}</div>
            <div style={S.kpiSub}>{groups.length} grupos · {itensMes.length} itens</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #E91E8C'}}>
            <div style={S.kpiLbl}>Custo indireto M{mes}</div>
            <div style={{...S.kpiVal, color:'#E91E8C', fontSize:18}}>{fmtRd(totalIndiretoMes)}</div>
            <div style={S.kpiSub}>{indiretos.length} categorias</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #3fae86'}}>
            <div style={S.kpiLbl}>Hh planejado M{mes}</div>
            <div style={{...S.kpiVal, color:'#3fae86', fontSize:18}}>{fmtH(totalHhMes)}</div>
            <div style={S.kpiSub}>homem-hora previsto</div>
          </div>
        </div>

        {/* Controles */}
        <div style={S.controls}>
          <div>
            <label style={S.lbl}>Mês</label>
            <select style={S.select} value={mes} onChange={e => { setMes(parseInt(e.target.value)); setOpen({}) }}>
              {Array.from({length:20},(_,i) => (
                <option key={i+1} value={i+1}>M{i+1} — {NOMES_MESES[i]}/{ANOS[i]}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.lbl}>Visualizar</label>
            <Seg value={view} onChange={setView} options={[{v:'direto',l:'Custos Diretos'},{v:'indireto',l:'Custos Indiretos'},{v:'ambos',l:'Ambos'}]} />
          </div>
          {view !== 'indireto' && (
            <>
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
            </>
          )}
        </div>

        {/* Custos Diretos */}
        {(view === 'direto' || view === 'ambos') && (
          <>
            <div style={{fontSize:12, fontWeight:700, color:'#5B9BD5', marginBottom:8, padding:'0 4px'}}>
              CUSTOS DIRETOS — {groups.length} grupos · {itensMes.length} itens · {fmtRd(totalDiretoMes)}
            </div>
            {groups.length === 0 && <div style={{color:'#6d675e', padding:20, textAlign:'center'}}>Nenhum item ativo neste mês.</div>}
            {groups.map((g, gi) => {
              const gCusto = g.rows.reduce((s,r) => s + valMes(r).custo, 0)
              const gHh = g.rows.reduce((s,r) => s + valMes(r).hh, 0)
              const isOpen = !!open[g.key]

              // Sub por pavimento
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
                <div key={g.key} style={S.card}>
                  <div style={S.chead} onClick={() => toggle(g.key)}>
                    <div style={S.badge}>{g.gNum}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:500}}>{g.label}</div>
                      <div style={{fontSize:10, color:'#6d675e', marginTop:1}}>{g.rows.length} itens · {fmtH(gHh)}</div>
                    </div>
                    <div style={{textAlign:'right', minWidth:120}}>
                      <div style={{fontSize:13, fontWeight:600, color:'#5B9BD5'}}>{fmtRd(gCusto)}</div>
                      <div style={{fontSize:9, color:'#6d675e'}}>{totalDiretoMes>0?(gCusto/totalDiretoMes*100).toFixed(1):0}% do direto</div>
                    </div>
                    <div style={{color:'#6d675e', fontSize:12, marginLeft:8}}>{isOpen?'▲':'▼'}</div>
                  </div>
                  {isOpen && (
                    <div style={S.body}>
                      {subs.map(sub => {
                        const subCusto = sub.rows.reduce((s,r) => s+valMes(r).custo, 0)
                        const subHh = sub.rows.reduce((s,r) => s+valMes(r).hh, 0)
                        return (
                          <div key={sub.key}>
                            <div style={{padding:'8px 16px 4px', color:'#3fae86', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:.5}}>
                              📐 {sub.key} — {fmtH(subHh)}
                            </div>
                            <div style={S.thRow}>
                              <span>EAP</span><span>Descrição</span><span>Pavimento</span><span style={{textAlign:'right'}}>Hh/mês</span><span style={{textAlign:'right'}}>R$/mês</span>
                            </div>
                            {[...sub.rows].sort((a,b) => a.i.localeCompare(b.i,undefined,{numeric:true})).map((r,ri) => {
                              const vm = valMes(r)
                              return (
                                <div key={`${r.i}-${ri}`} style={{...S.itemRow, background:ri%2===0?'rgba(255,255,255,0.01)':'transparent'}}>
                                  <span style={{color:'#6d675e', fontFamily:'monospace', fontSize:10}}>{r.i}</span>
                                  <span style={{color:'#a09a90'}}>{r.d}</span>
                                  <span style={{color:'#6d675e', fontSize:10}}>{r.p}</span>
                                  <span style={{textAlign:'right', color:'#3fae86'}}>{vm.hh>0?fmtH(vm.hh):'—'}</span>
                                  <span style={{textAlign:'right', color:'#5B9BD5', fontWeight:500}}>{fmtRd(vm.custo)}</span>
                                </div>
                              )
                            })}
                            <div style={{display:'flex', justifyContent:'flex-end', gap:16, padding:'8px 16px', borderTop:'1px solid #2a2a31', fontSize:11}}>
                              <span style={{color:'#3fae86'}}>Hh: {fmtH(subHh)}</span>
                              <span style={{color:'#5B9BD5', fontWeight:600}}>R$: {fmtRd(subCusto)}</span>
                            </div>
                          </div>
                        )
                      })}
                      <div style={{display:'flex', justifyContent:'space-between', padding:'10px 16px', borderTop:'2px solid #2a2a31', fontSize:12, fontWeight:700}}>
                        <span style={{color:'#a09a90'}}>Total {g.label}:</span>
                        <div style={{display:'flex', gap:16}}>
                          <span style={{color:'#3fae86'}}>{fmtH(gHh)}</span>
                          <span style={{color:'#5B9BD5'}}>{fmtRd(gCusto)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <div style={{display:'flex', justifyContent:'space-between', padding:'12px 18px', borderRadius:10, background:'#17171b', border:'1px solid #2a2a31', marginBottom:16}}>
              <span style={{fontWeight:700}}>TOTAL DIRETO M{mes}</span>
              <div style={{display:'flex', gap:20}}>
                <span style={{color:'#3fae86', fontWeight:700}}>{fmtH(totalHhMes)}</span>
                <span style={{color:'#5B9BD5', fontWeight:700, fontSize:15}}>{fmtRd(totalDiretoMes)}</span>
              </div>
            </div>
          </>
        )}

        {/* Custos Indiretos */}
        {(view === 'indireto' || view === 'ambos') && (
          <>
            <div style={{fontSize:12, fontWeight:700, color:'#E91E8C', marginBottom:8, padding:'0 4px'}}>
              CUSTOS INDIRETOS — {indiretos.length} categorias · {fmtRd(totalIndiretoMes)}
            </div>
            {indiretos.length === 0 && <div style={{color:'#6d675e', padding:20, textAlign:'center'}}>Nenhum custo indireto neste mês.</div>}
            <div style={{...S.card, overflow:'hidden'}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 140px 80px', gap:8, padding:'8px 16px', fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #2a2a31'}}>
                <span>Categoria</span><span style={{textAlign:'right'}}>Valor no mês</span><span style={{textAlign:'right'}}>%</span>
              </div>
              {indiretos.sort((a,b) => b.valor-a.valor).map((item, i) => (
                <div key={i} style={{display:'grid', gridTemplateColumns:'1fr 140px 80px', gap:8, padding:'10px 16px', fontSize:12, alignItems:'center', background:i%2===0?'rgba(255,255,255,0.01)':'transparent', borderBottom:'1px solid #1a1a20'}}>
                  <span style={{color:'#ece9e4'}}>{item.categoria}</span>
                  <span style={{textAlign:'right', color:'#E91E8C', fontWeight:600}}>{fmtRd(item.valor)}</span>
                  <span style={{textAlign:'right', color:'#6d675e'}}>{totalIndiretoMes>0?(item.valor/totalIndiretoMes*100).toFixed(1):0}%</span>
                </div>
              ))}
              <div style={{display:'flex', justifyContent:'space-between', padding:'10px 16px', borderTop:'2px solid #2a2a31', fontWeight:700, fontSize:13}}>
                <span>TOTAL INDIRETO M{mes}</span>
                <span style={{color:'#E91E8C'}}>{fmtRd(totalIndiretoMes)}</span>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{display:'flex', justifyContent:'space-between', padding:'14px 18px', borderRadius:10, background:'#17171b', border:'2px solid #e6a338', marginTop:8}}>
          <span style={{fontSize:14, fontWeight:700, color:'#e6a338'}}>TOTAL GERAL M{mes} — {NOMES_MESES[mes-1].toUpperCase()}/{ANOS[mes-1]}</span>
          <span style={{fontSize:18, fontWeight:700, color:'#e6a338'}}>{fmtRd(totalMes)}</span>
        </div>
      </div>
    </div>
  )
}
