// pages/custos-indiretos-realizados-lista.js
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const fmtR = v => 'R$ ' + parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const COMP_MAP = {'2026-07':'M1','2026-08':'M2','2026-09':'M3','2026-10':'M4','2026-11':'M5','2026-12':'M6','2027-01':'M7','2027-02':'M8','2027-03':'M9','2027-04':'M10','2027-05':'M11','2027-06':'M12','2027-07':'M13','2027-08':'M14','2027-09':'M15','2027-10':'M16','2027-11':'M17','2027-12':'M18','2028-01':'M19','2028-02':'M20'}
function compLabel(comp) { return COMP_MAP[comp] || comp }

const S = {
  page: { minHeight:'100vh', background:'#0f0f11', color:'#ece9e4', fontFamily:'"Segoe UI",system-ui,sans-serif' },
  wrap: { maxWidth:900, margin:'0 auto', padding:'0 20px 40px' },
  eyebrow: { color:'#6d675e', fontSize:11, letterSpacing:1.4, textTransform:'uppercase', paddingTop:28, marginBottom:2 },
  h1: { fontSize:22, fontWeight:600, margin:'2px 0 2px' },
  sub: { color:'#a09a90', fontSize:13, marginBottom:18 },
  nav: { display:'flex', gap:8, marginBottom:16 },
  navBtn: { background:'transparent', border:'1px solid #2a2a31', color:'#a09a90', borderRadius:8, padding:'7px 14px', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  kpiGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 },
  kpi: { background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, padding:'16px 18px' },
  kpiLbl: { color:'#6d675e', fontSize:10, letterSpacing:1, textTransform:'uppercase', marginBottom:6 },
  kpiVal: { fontSize:24, fontWeight:700 },
  kpiSub: { color:'#a09a90', fontSize:11, marginTop:4 },
  card: { background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, overflow:'hidden', marginBottom:16 },
  cardTitle: { padding:'14px 18px', borderBottom:'1px solid #2a2a31', fontSize:12, fontWeight:600, color:'#a09a90', textTransform:'uppercase', letterSpacing:.5 },
  rowHead: { display:'grid', gridTemplateColumns:'1fr 140px 140px 100px', gap:8, padding:'8px 18px', fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #2a2a31' },
  row: { display:'grid', gridTemplateColumns:'1fr 140px 140px 100px', gap:8, padding:'10px 18px', alignItems:'center', borderBottom:'1px solid #1a1a20' },
  bar: { height:4, background:'#1e1e24', borderRadius:2, overflow:'hidden', marginTop:4 },
}

export default function CustosIndiretosRealizados() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openItem, setOpenItem] = useState({})

  useEffect(() => {
    fetch('/api/custos-indiretos-realizados-lista')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggleItem = key => setOpenItem(o => ({...o, [key]: !o[key]}))

  if (loading) return <div style={S.page}><div style={{padding:40,color:'#a09a90'}}>Carregando...</div></div>
  if (!data) return <div style={S.page}><div style={{padding:40,color:'#B03030'}}>Erro ao carregar.</div></div>

  const { lancamentos=[], planejados=[], realPorCategoria={}, lancsPorCategoria={}, totalRealizado=0, totalPlanejado=0 } = data
  const saldo = totalPlanejado - totalRealizado
  const pctGasto = totalPlanejado > 0 ? (totalRealizado/totalPlanejado*100) : 0

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.eyebrow}>Custos indiretos realizados</div>
        <div style={S.h1}>Flats Pampulha</div>
        <div style={S.sub}>20 meses · Jul/2026 a Fev/2028</div>

        <div style={S.nav}>
          <button style={S.navBtn} onClick={() => router.push('/')}>← Dashboard</button>
          <button style={S.navBtn} onClick={() => router.push('/custos-indiretos-planejados')}>📋 Planejado</button>
        </div>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={{...S.kpi, borderLeft:'3px solid #5B9BD5'}}>
            <div style={S.kpiLbl}>Total planejado</div>
            <div style={{...S.kpiVal, color:'#5B9BD5'}}>{fmtR(totalPlanejado)}</div>
            <div style={S.kpiSub}>{planejados.length} categorias</div>
          </div>
          <div style={{...S.kpi, borderLeft:'3px solid #E91E8C'}}>
            <div style={S.kpiLbl}>Total realizado</div>
            <div style={{...S.kpiVal, color:'#E91E8C'}}>{fmtR(totalRealizado)}</div>
            <div style={S.kpiSub}>{lancamentos.length} lançamentos · {pctGasto.toFixed(1)}% do planejado</div>
          </div>
          <div style={{...S.kpi, borderLeft:`3px solid ${saldo >= 0 ? '#4D9B6A' : '#B03030'}`}}>
            <div style={S.kpiLbl}>Saldo disponível</div>
            <div style={{...S.kpiVal, color: saldo >= 0 ? '#4D9B6A' : '#B03030'}}>{fmtR(saldo)}</div>
            <div style={S.kpiSub}>{saldo >= 0 ? '✅ Dentro do orçamento' : '⚠️ Estourou o orçamento'}</div>
          </div>
        </div>

        {/* Barra geral */}
        <div style={{background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, padding:'16px 18px', marginBottom:16}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
            <span style={{fontSize:12, color:'#a09a90'}}>Progresso geral dos custos indiretos</span>
            <span style={{fontSize:14, fontWeight:700, color:'#E91E8C'}}>{pctGasto.toFixed(1)}%</span>
          </div>
          <div style={{...S.bar, height:10}}>
            <div style={{height:'100%', width:`${Math.min(pctGasto,100)}%`, background: pctGasto>100?'#B03030':'#E91E8C', borderRadius:2}} />
          </div>
        </div>

        {/* Tabela por categoria */}
        <div style={S.card}>
          <div style={S.cardTitle}>Detalhes por categoria</div>
          <div style={S.rowHead}>
            <span>Categoria</span>
            <span style={{textAlign:'right'}}>Planejado</span>
            <span style={{textAlign:'right'}}>Realizado</span>
            <span style={{textAlign:'right'}}>%</span>
          </div>
          {[...planejados].sort((a,b) => b.valor_total - a.valor_total).map((p, i) => {
            const realVal = realPorCategoria[p.categoria] || 0
            const pct = p.valor_total > 0 ? (realVal/p.valor_total*100) : 0
            const catLancs = lancsPorCategoria[p.categoria] || []
            const itemKey = p.categoria
            return (
              <React.Fragment key={i}>
                <div style={{...S.row, background: i%2===0 ? 'rgba(255,255,255,0.01)' : 'transparent'}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13}}>{p.categoria}</div>
                      {realVal > 0 && (
                        <div style={S.bar}>
                          <div style={{height:'100%', width:`${Math.min(pct,100)}%`, background:'#E91E8C', borderRadius:2}} />
                        </div>
                      )}
                    </div>
                    {catLancs.length > 0 && (
                      <span
                        style={{color:'#e6a338', fontSize:10, cursor:'pointer'}}
                        onClick={(e) => { e.stopPropagation(); toggleItem(itemKey); }}
                      >
                        {openItem[itemKey] ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                  <div style={{textAlign:'right', color:'#5B9BD5', fontSize:13}}>{fmtR(p.valor_total)}</div>
                  <div style={{textAlign:'right', color: realVal>0?'#E91E8C':'#444', fontSize:13, fontWeight:realVal>0?600:400}}>
                    {realVal > 0 ? fmtR(realVal) : '—'}
                  </div>
                  <div style={{textAlign:'right', fontSize:12, color: pct>100?'#B03030':pct>0?'#4D9B6A':'#444', fontWeight:600}}>
                    {realVal > 0 ? pct.toFixed(1)+'%' : '—'}
                  </div>
                </div>
                {openItem[itemKey] && catLancs.length > 0 && (
                  <div style={{padding:'4px 18px 8px 40px', background:'rgba(255,255,255,0.02)', borderBottom:'1px solid #1a1a20'}}>
                    <div style={{display:'grid', gridTemplateColumns:'100px 1fr 80px 60px', gap:8, padding:'4px 0', borderBottom:'1px solid #2a2a31', fontSize:10, color:'#6d675e', fontWeight:600}}>
                      <span>Data</span>
                      <span>Descrição</span>
                      <span style={{textAlign:'right'}}>Valor</span>
                      <span style={{textAlign:'right'}}>Período</span>
                    </div>
                    {catLancs.map((lc, li) => (
                      <div key={li} style={{display:'grid', gridTemplateColumns:'100px 1fr 80px 60px', gap:8, padding:'3px 0', borderBottom:'1px solid #1a1a20', fontSize:10, color:'#a09a90'}}>
                        <span>{lc.data_emissao ? lc.data_emissao.slice(0,10) : '—'}</span>
                        <span>{lc.descricao || lc.historico || lc.codigo_eap}</span>
                        <span style={{textAlign:'right', color:'#E91E8C', fontWeight:500}}>{fmtR(lc.valor)}</span>
                        <span style={{textAlign:'right', color:'#5B9BD5'}}>{compLabel(lc.competencia)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            )
          })}
          <div style={{...S.row, borderTop:'2px solid #2a2a31', fontWeight:700}}>
            <span style={{color:'#ece9e4'}}>TOTAL</span>
            <span style={{textAlign:'right', color:'#5B9BD5'}}>{fmtR(totalPlanejado)}</span>
            <span style={{textAlign:'right', color:'#E91E8C'}}>{fmtR(totalRealizado)}</span>
            <span style={{textAlign:'right', color:'#4D9B6A'}}>{pctGasto.toFixed(1)}%</span>
          </div>
        </div>

        {/* Lançamentos completo */}
        <div style={S.card}>
          <div style={S.cardTitle}>Todos os lançamentos indiretos ({lancamentos.length})</div>
          <div style={{display:'grid', gridTemplateColumns:'100px 1fr 100px 100px 60px', gap:8, padding:'8px 18px', fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #2a2a31'}}>
            <span>Data</span><span>Descrição</span><span>EAP</span><span style={{textAlign:'right'}}>Valor</span><span style={{textAlign:'right'}}>Período</span>
          </div>
          {lancamentos.map((l, i) => (
            <div key={i} style={{display:'grid', gridTemplateColumns:'100px 1fr 100px 100px 60px', gap:8, padding:'8px 18px', fontSize:12, alignItems:'center', background:i%2===0?'rgba(255,255,255,0.01)':'transparent', borderBottom:'1px solid #1a1a20'}}>
              <span style={{color:'#6d675e'}}>{l.data_emissao?.slice(0,10)}</span>
              <span style={{color:'#a09a90'}}>{l.descricao || l.historico}</span>
              <span style={{color:'#6d675e', fontFamily:'monospace', fontSize:10}}>{l.codigo_eap}</span>
              <span style={{textAlign:'right', color:'#E91E8C', fontWeight:600}}>{fmtR(l.valor)}</span>
              <span style={{textAlign:'right', color:'#5B9BD5', fontSize:11}}>{compLabel(l.competencia)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
