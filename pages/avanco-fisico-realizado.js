// pages/avanco-fisico-realizado.js
import { useState, useEffect, useMemo, Fragment } from 'react'
import { useRouter } from 'next/router'

const PAVS = ['1º','2º','3º','4º','5º','6º/Plat','Edifício']
const NOMES_MESES = ['jul','ago','set','out','nov','dez','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez','jan','fev']
const ANOS = [2026,2026,2026,2026,2026,2026,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2028,2028]

const fmtR = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR')
const fmtH = v => v.toFixed(1) + ' Hh'
const fmtP = v => (v*100).toFixed(1) + '%'

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
  controls: { display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'flex-end' },
  lbl: { display:'block', color:'#6d675e', fontSize:10, letterSpacing:.5, textTransform:'uppercase', marginBottom:4 },
  select: { background:'#1e1e24', border:'1px solid #2a2a31', color:'#ece9e4', borderRadius:8, padding:'8px 11px', fontSize:13, fontFamily:'inherit' },
  input: { background:'#1e1e24', border:'1px solid #2a2a31', color:'#ece9e4', borderRadius:8, padding:'8px 11px', fontSize:13, fontFamily:'inherit', minWidth:160 },
  seg: { display:'flex', background:'#1e1e24', border:'1px solid #2a2a31', borderRadius:8, overflow:'hidden' },
  card: { background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, marginBottom:8, overflow:'hidden' },
  chead: { display:'flex', alignItems:'center', gap:10, padding:'13px 16px', cursor:'pointer', userSelect:'none' },
  badge: { width:28, height:28, borderRadius:6, background:'#1e1e24', border:'1px solid #2a2a31', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#a09a90', fontWeight:600, flexShrink:0 },
  body: { borderTop:'1px solid #2a2a31' },
  saveBtn: { background:'#e6a338', color:'#231803', border:0, borderRadius:8, padding:'10px 24px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
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

function PctInput({ value, onChange, disabled }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:4}}>
      <input
        type="number" min="0" max="100" step="0.5"
        value={value || ''}
        onChange={e => onChange(Math.min(100, Math.max(0, parseFloat(e.target.value)||0)))}
        disabled={disabled}
        style={{
          width:60, background: disabled?'#1a1a20':'#1e1e24', border:'1px solid #2a2a31',
          color: disabled?'#444':'#ece9e4', borderRadius:6, padding:'4px 6px',
          fontSize:12, fontFamily:'inherit', textAlign:'right'
        }}
      />
      <span style={{color:'#6d675e', fontSize:11}}>%</span>
    </div>
  )
}

// Memória de cálculo: lista os incrementos de um item (data + %) com lixeira
function MemoriaCalculo({ codigo_eap, pavimento }) {
  const [linhas, setLinhas] = useState(null)
  const [acumulado, setAcumulado] = useState(0)
  const [erro, setErro] = useState(null)
  const [removendo, setRemovendo] = useState(null)

  const carregar = () => {
    const url = `/api/avanco-fisico-historico?codigo_eap=${encodeURIComponent(codigo_eap)}&pavimento=${encodeURIComponent(pavimento)}`
    fetch(url, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setLinhas(d.data || []); setAcumulado(d.acumulado || 0) })
      .catch(() => setErro('Erro ao carregar histórico'))
  }
  useEffect(() => { carregar() }, [codigo_eap, pavimento])

  const excluir = async (id) => {
    if (!confirm('Excluir este lançamento? O total do item será recalculado.')) return
    setRemovendo(id)
    try {
      const res = await fetch(`/api/avanco-fisico-historico?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('erro')
      carregar()
    } catch { alert('Erro ao excluir lançamento') } finally { setRemovendo(null) }
  }

  if (erro) return <div style={{padding:'8px 16px', fontSize:11, color:'#d6453c'}}>{erro}</div>
  if (linhas === null) return <div style={{padding:'8px 16px', fontSize:11, color:'#6d675e'}}>Carregando memória de cálculo...</div>
  if (linhas.length === 0) return <div style={{padding:'8px 16px', fontSize:11, color:'#6d675e'}}>Nenhum lançamento registrado para este item.</div>

  return (
    <div style={{background:'#141418', borderTop:'1px solid #2a2a31', padding:'10px 16px 12px'}}>
      <div style={{fontSize:10, color:'#e6a338', letterSpacing:.5, textTransform:'uppercase', fontWeight:600, marginBottom:6}}>
        Memória de cálculo — {linhas.length} lançamento{linhas.length>1?'s':''}
      </div>
      <div style={{display:'grid', gridTemplateColumns:'110px 90px 70px 40px', gap:8, fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:4}}>
        <span>Data</span><span>Semana</span><span>Avanço</span><span></span>
      </div>
      {linhas.map((l) => (
        <div key={l.id} style={{display:'grid', gridTemplateColumns:'110px 90px 70px 40px', gap:8, fontSize:11, alignItems:'center', padding:'4px 0', borderBottom:'1px solid #1a1a20'}}>
          <span style={{color:'#a09a90'}}>{new Date(l.data_lancamento).toLocaleDateString('pt-BR')}</span>
          <span style={{color:'#6d675e', fontSize:10}}>Semana {l.semana_numero}</span>
          <span style={{color:'#3fae86', fontWeight:600}}>+{parseFloat(l.percentual_realizado).toFixed(1)}%</span>
          <button
            onClick={() => excluir(l.id)}
            disabled={removendo===l.id}
            title="Excluir este lançamento"
            style={{background:'transparent', border:'1px solid #3a2a2a', color:'#d6453c', borderRadius:6, padding:'2px 7px', fontSize:12, cursor:'pointer', opacity:removendo===l.id?0.5:1}}
          >🗑</button>
        </div>
      ))}
      <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:8, fontSize:12}}>
        <span style={{color:'#6d675e'}}>Total acumulado:</span>
        <span style={{color:'#e6a338', fontWeight:700}}>{acumulado.toFixed(1)}%</span>
      </div>
    </div>
  )
}

export default function AvancoFisicoRealizado() {
  const router = useRouter()
  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [mes, setMes] = useState(1)
  const [axis, setAxis] = useState('grupo')
  const [pavF, setPavF] = useState('__ALL__')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  const [pcts, setPcts] = useState({}) // key: `${eap}|${pav}` -> ACUMULADO (soma do historico)
  const [incrementos, setIncrementos] = useState({}) // key -> incremento sendo digitado agora
  const [existentes, setExistentes] = useState({}) // lançamentos já salvos
  const [memAberta, setMemAberta] = useState(null) // key do item com memória de cálculo aberta

  useEffect(() => {
    fetch('/api/orcamento-itens', { cache: 'no-store' }).then(r => r.json()).then(d => { setDados(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  // Carrega os acumulados (soma do historico) de todos os itens
  const carregarResumo = () => {
    fetch('/api/avanco-fisico-resumo?obra_id=flats_pampulha', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setPcts(d.acumulados || {}))
      .catch(() => {})
  }

  // Buscar lançamentos existentes (datas) quando mês muda + acumulados
  useEffect(() => {
    if (!mes) return
    fetch(`/api/avanco-fisico-realizado?mes=${mes}&obra_id=flats_pampulha`)
      .then(r => r.json())
      .then(d => {
        const map = {}
        ;(d.data || d || []).forEach(item => {
          const key = `${item.codigo_eap}|${item.pavimento}`
          map[key] = item
        })
        setExistentes(map)
      })
      .catch(() => {})
    carregarResumo()
  }, [mes])

  const totHh = useMemo(() => dados.reduce((s,r) => s+r.h, 0) || 1, [dados])

  const ql = q.toLowerCase()

  // Filtrar itens ativos no período
  const visible = useMemo(() => dados.filter(r => {
    if (pavF !== '__ALL__' && r.p !== pavF) return false
    if (ql && !r.n.toLowerCase().includes(ql) && !r.d.toLowerCase().includes(ql)) return false
    return r.a <= mes && r.g !== 17 && r.g !== 18 // excluir locacoes e funcionarios ou programados até o mês
  }), [dados, pavF, ql, mes])

  // Agrupar
  const groups = useMemo(() => {
    const map = {}
    visible.forEach(r => {
      const key = axis==='grupo' ? String(r.g) : r.p
      if (!map[key]) map[key] = { key, label: axis==='grupo' ? r.n : r.p, gNum:r.g, rows:[] }
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

  // KPIs calculados
  const hhRealTotal = useMemo(() => {
    return visible.reduce((s,r) => {
      const pct = (pcts[`${r.i}|${r.p}`] || 0) / 100
      return s + r.h * pct
    }, 0)
  }, [visible, pcts])

  const hhPlanTotal = useMemo(() => visible.reduce((s,r) => s+r.h, 0), [visible])
  const pctMedio = hhPlanTotal > 0 ? (hhRealTotal/hhPlanTotal*100) : 0

  const custoRealTotal = useMemo(() => {
    return visible.reduce((s,r) => {
      const pct = (pcts[`${r.i}|${r.p}`] || 0) / 100
      return s + r.c * pct
    }, 0)
  }, [visible, pcts])

  const itensLancados = useMemo(() => {
    return visible.filter(r => (pcts[`${r.i}|${r.p}`] || 0) > 0).length
  }, [visible, pcts])

  const setPct = (eap, pav, val) => {
    const key = `${eap}|${pav}`
    const acum = pcts[key] || 0
    if (acum + val > 100) {
      alert(`Esse incremento passaria de 100%.\nAcumulado atual: ${acum.toFixed(1)}% + ${val}% = ${(acum+val).toFixed(1)}%.\nAjuste o valor.`)
      return
    }
    setIncrementos(p => ({...p, [key]: val}))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const competencia = `2026-${String(6+mes).padStart(2,'0')}-01`
      const lancamentos = visible
        .filter(r => (incrementos[`${r.i}|${r.p}`] || 0) > 0)
        .map(r => ({
          obra_id: 'flats_pampulha',
          competencia,
          mes_numero: mes,
          codigo_eap: r.i,
          atividade_nome: r.d,
          pavimento: r.p,
          grupo_num: r.g,
          incremento: incrementos[`${r.i}|${r.p}`] || 0,
          hh_planejado: r.h,
          custo_planejado: r.c,
        }))

      if (lancamentos.length === 0) {
        alert('Digite ao menos um incremento de avanço antes de salvar.')
        setSaving(false)
        return
      }

      const res = await fetch('/api/avanco-fisico-realizado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, lancamentos })
      })
      const out = await res.json()
      if (!res.ok) throw new Error(out.error || 'Erro ao salvar')

      if (out.rejeitados && out.rejeitados.length > 0) {
        alert('Alguns itens não foram salvos por passar de 100%:\n' +
          out.rejeitados.map(x => `${x.codigo_eap} (${x.motivo})`).join('\n'))
      }

      setIncrementos({})   // limpa os campos de incremento
      carregarResumo()     // atualiza os acumulados
      setSaved(true)
    } catch(e) {
      alert('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = key => setOpen(o => ({...o, [key]: !o[key]}))

  if (loading) return <div style={S.page}><div style={{padding:40,color:'#a09a90'}}>Carregando...</div></div>

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.eyebrow}>Avanço físico realizado — lançamento</div>
        <div style={S.h1}>Flats Pampulha</div>
        <div style={S.sub}>Lançar % concluído por item · Hh calculado automaticamente</div>

        <div style={S.nav}>
          <button style={S.navBtn} onClick={() => router.push('/')}>← Dashboard</button>
          <button style={S.navBtn} onClick={() => router.push('/avanco-fisico-planejado')}>📋 Planejado</button>
        </div>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={{...S.kpi, borderLeft:'3px solid #e6a338'}}>
            <div style={S.kpiLbl}>Avanço médio M{mes}</div>
            <div style={{...S.kpiVal, color:'#e6a338'}}>{pctMedio.toFixed(1)}%</div>
            <div style={S.kpiSub}>{NOMES_MESES[mes-1]}/{ANOS[mes-1]}</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #3fae86'}}>
            <div style={S.kpiLbl}>Hh realizado</div>
            <div style={{...S.kpiVal, color:'#3fae86', fontSize:16}}>{fmtH(hhRealTotal)}</div>
            <div style={S.kpiSub}>de {fmtH(hhPlanTotal)} planejados</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #5B9BD5'}}>
            <div style={S.kpiLbl}>Custo físico realizado</div>
            <div style={{...S.kpiVal, color:'#5B9BD5', fontSize:16}}>{fmtR(custoRealTotal)}</div>
            <div style={S.kpiSub}>proporcional ao avanço</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #a09a90'}}>
            <div style={S.kpiLbl}>Itens lançados</div>
            <div style={{...S.kpiVal, color:'#ece9e4'}}>{itensLancados}</div>
            <div style={S.kpiSub}>de {visible.length} itens ativos</div>
          </div>
        </div>

        {/* Controles */}
        <div style={S.controls}>
          <div>
            <label style={S.lbl}>Mês de competência</label>
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
          <div style={{display:'flex', flexDirection:'column', justifyContent:'flex-end'}}>
            <button
              style={{...S.saveBtn, opacity: saving?0.7:1, background: saved?'#4D9B6A':'#e6a338', color: saved?'#fff':'#231803'}}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '⏳ Salvando...' : saved ? '✅ Salvo!' : '💾 Salvar Avanço'}
            </button>
          </div>
        </div>

        {groups.length === 0 && <div style={{color:'#6d675e', textAlign:'center', padding:32}}>Nenhum item ativo neste período.</div>}

        {groups.map((g, gi) => {
          const gHhPlan = g.rows.reduce((s,r) => s+r.h, 0)
          const gHhReal = g.rows.reduce((s,r) => s + r.h*((pcts[`${r.i}|${r.p}`]||0)/100), 0)
          const gPct = gHhPlan > 0 ? (gHhReal/gHhPlan*100) : 0
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

          const barColor = gPct > 100 ? '#B03030' : gPct > 0 ? '#4D9B6A' : '#333'

          return (
            <div key={g.key} style={S.card}>
              <div style={S.chead} onClick={() => toggle(g.key)}>
                <div style={S.badge}>{badge}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13, fontWeight:500}}>{g.label}</div>
                  <div style={{fontSize:10, color:'#6d675e', marginTop:1}}>{g.rows.length} itens</div>
                </div>
                {/* Barra de progresso do grupo */}
                <div style={{flex:1, maxWidth:160}}>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'#6d675e', marginBottom:3}}>
                    <span>Hh: {fmtH(gHhReal)}</span>
                    <span style={{color:barColor, fontWeight:600}}>{gPct.toFixed(1)}%</span>
                  </div>
                  <div style={{height:6, background:'#1e1e24', borderRadius:3, overflow:'hidden'}}>
                    <div style={{height:'100%', width:`${Math.min(gPct,100)}%`, background:barColor, borderRadius:3}} />
                  </div>
                </div>
                <div style={{color:'#6d675e', fontSize:12, marginLeft:12}}>{isOpen?'▲':'▼'}</div>
              </div>

              {isOpen && (
                <div style={S.body}>
                  {subs.map(sub => {
                    const subHhPlan = sub.rows.reduce((s,r) => s+r.h, 0)
                    const subHhReal = sub.rows.reduce((s,r) => s+r.h*((pcts[`${r.i}|${r.p}`]||0)/100), 0)
                    return (
                      <div key={sub.key}>
                        <div style={{padding:'10px 16px 4px', color:'#3fae86', fontSize:11, letterSpacing:.5, textTransform:'uppercase', fontWeight:600}}>
                          📐 {sub.label} — {fmtH(subHhReal)} / {fmtH(subHhPlan)} Hh
                        </div>
                        {/* Header */}
                        <div style={{display:'grid', gridTemplateColumns:'50px 1fr 60px 80px 90px 80px', gap:6, padding:'5px 16px', fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #1a1a20'}}>
                          <span>EAP</span><span>Descrição</span><span>Período</span><span>Hh Plan</span><span>+ Avanço</span><span>Hh Real</span>
                        </div>
                        {[...sub.rows].sort((a,b) => a.i.localeCompare(b.i,undefined,{numeric:true})).map((r,ri) => {
                          const key = `${r.i}|${r.p}`
                          const pct = pcts[key] || 0            // acumulado (soma do historico)
                          const inc = incrementos[key] || 0     // incremento sendo digitado
                          const hhReal = r.h * (pct/100)
                          const ativo = r.a <= mes && r.b >= mes
                          const concluido = pct >= 100
                          const ex = existentes[key]
                          const dataLanc = ex && ex.created_at ? new Date(ex.created_at).toLocaleDateString("pt-BR") : null
                          const memKey = key
                          const memAbertaAqui = memAberta === memKey
                          return (
                            <Fragment key={`${r.i}-${ri}`}>
                            <div style={{display:'grid', gridTemplateColumns:'50px 1fr 60px 80px 90px 80px', gap:6, padding:'6px 16px', fontSize:11, alignItems:'center', background:ri%2===0?'rgba(255,255,255,0.01)':'transparent', borderBottom:'1px solid #0f0f11'}}>
                              <span style={{color:'#6d675e', fontFamily:'monospace', fontSize:10}}>{r.i}</span>
                              <span
                                onClick={() => setMemAberta(memAbertaAqui ? null : memKey)}
                                title="Clique para ver a memória de cálculo"
                                style={{color: ativo?'#ece9e4':'#a09a90', cursor:'pointer', display:'flex', alignItems:'center', gap:6}}
                              >
                                <span style={{color:'#6d675e', fontSize:9}}>{memAbertaAqui ? '▾' : '▸'}</span>
                                {r.d}
                              </span>
                              <span style={{color: ativo?'#e6a338':'#6d675e', fontSize:10}}>M{String(r.a).padStart(2,'0')}–M{String(r.b).padStart(2,'0')}</span>
                              <span style={{color:'#6d675e', textAlign:'right'}}>{fmtH(r.h)}</span>
                              <div>
                                <div style={{fontSize:10, color: concluido?'#3fae86':'#a09a90', marginBottom:3, fontWeight:600}}>
                                  Acum: {pct.toFixed(1)}%
                                </div>
                                {concluido ? (
                                  <div style={{fontSize:10, color:'#3fae86'}}>✅ concluído</div>
                                ) : (
                                  <PctInput value={inc} onChange={v => setPct(r.i, r.p, v)} disabled={!ativo} />
                                )}
                                {pct > 0 && pct < 100 && (
                                  <div style={{height:3, background:'#1e1e24', borderRadius:2, marginTop:3, overflow:'hidden'}}>
                                    <div style={{height:'100%', width:`${pct}%`, background:'#4D9B6A', borderRadius:2}} />
                                  </div>
                                )}
                              </div>
                              <span style={{color: hhReal>0?'#3fae86':'#444', textAlign:'right', fontWeight:hhReal>0?600:400}}>{hhReal>0?fmtH(hhReal):'—'}</span>
                            </div>
                            {memAbertaAqui && (
                              <MemoriaCalculo codigo_eap={r.i} pavimento={r.p} />
                            )}
                            </Fragment>
                          )
                        })}
                        <div style={{display:'flex', justifyContent:'flex-end', gap:20, padding:'8px 16px', borderTop:'1px solid #2a2a31', fontSize:11, color:'#6d675e'}}>
                          <span>Hh plan: {fmtH(subHhPlan)}</span>
                          <span style={{color:'#3fae86', fontWeight:600}}>Hh real: {fmtH(subHhReal)}</span>
                          <span style={{color:'#e6a338', fontWeight:600}}>{subHhPlan>0?(subHhReal/subHhPlan*100).toFixed(1):0}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Footer botão salvar */}
        {groups.length > 0 && (
          <div style={{display:'flex', justifyContent:'flex-end', marginTop:16}}>
            <button
              style={{...S.saveBtn, opacity:saving?0.7:1, background:saved?'#4D9B6A':'#e6a338', color:saved?'#fff':'#231803', padding:'12px 32px', fontSize:15}}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '⏳ Salvando...' : saved ? '✅ Avanço salvo!' : '💾 Salvar Avanço M'+mes}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
