// pages/avanco-fisico-planejado.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const fmtMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(val)
const fmtPerc = (val) => `${parseFloat(val || 0).toFixed(1)}%`

const ICONES = {
  'Serviços Preliminares e Gerais': '🏗️',
  'Movimento de Terra e Fundações': '⛏️',
  'Estrutura': '🏛️',
  'Alvenaria e Fechamentos': '🧱',
  'Reboco e Emboço': '🪣',
  'Instalações Hidrossanitárias': '💧',
  'Instalações Elétricas e Telecom': '⚡',
  'Instalações Especiais': '🔌',
  'Cobertura e Impermeabilização': '🏠',
  'Aplicação de Gesso': '🪤',
  'Pisos e Rodapés': '🟫',
  'Esquadrias': '🪟',
  'Pintura': '🖌️',
  'Louças, Metais e Bancadas': '🚿',
  'Urbanização e Paisagismo': '🌳',
  'Locações e Equipamentos': '🚧',
  'Serviços Finais': '✅',
}

const STATUS_COLOR = { 'Concluído': '#4D9B6A', 'Em andamento': '#C8860A', 'Não iniciado': '#555' }

function BarraDupla({ planejado, realizado }) {
  const diff = realizado - planejado
  const cor = diff >= 0 ? '#4D9B6A' : '#B03030'
  return (
    <div style={{ position: 'relative', height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden', minWidth: 80 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(planejado, 100)}%`, background: '#5B9BD5', opacity: 0.5, borderRadius: 4 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(realizado, 100)}%`, background: cor, borderRadius: 4 }} />
    </div>
  )
}

function AtividadeRow({ at }) {
  const diff = at.perc_realizado_pct - at.perc_planejado_pct
  const corDiff = diff >= 0 ? '#4D9B6A' : '#B03030'
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 80px 60px 130px 120px',
      gap: 8, alignItems: 'center',
      padding: '7px 12px', borderRadius: 4,
      borderLeft: '2px solid rgba(91,155,213,0.25)', marginBottom: 3,
      fontSize: 11
    }}>
      <span style={{ color: 'var(--text2)' }}>{at.nome}</span>
      <span style={{ textAlign: 'right', color: '#5B9BD5', fontWeight: 600 }}>{fmtPerc(at.perc_planejado_pct)}</span>
      <span style={{ textAlign: 'right', color: at.perc_realizado_pct > 0 ? '#9B59B6' : 'var(--text3)', fontWeight: 600 }}>
        {at.perc_realizado_pct > 0 ? fmtPerc(at.perc_realizado_pct) : '—'}
      </span>
      <span style={{ textAlign: 'right', color: corDiff, fontWeight: 700, fontSize: 10 }}>
        {at.perc_realizado_pct > 0 ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%` : '—'}
      </span>
      <BarraDupla planejado={at.perc_planejado_pct} realizado={at.perc_realizado_pct} />
      <span style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmtMoeda(at.valor_periodo)}</span>
    </div>
  )
}

function SubgrupoRow({ subgrupo }) {
  const [expandido, setExpandido] = useState(false)
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={() => setExpandido(!expandido)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
          background: expandido ? 'rgba(91,155,213,0.08)' : 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.15s'
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text2)', width: 14 }}>{expandido ? '▼' : '▶'}</span>
        <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, fontWeight: 500 }}>📐 {subgrupo.nome}</span>
        <div style={{ width: 120, marginRight: 8 }}>
          <BarraDupla planejado={subgrupo.perc_medio} realizado={0} />
        </div>
        <span style={{ fontSize: 11, color: '#5B9BD5', fontWeight: 600, minWidth: 50, textAlign: 'right' }}>{fmtPerc(subgrupo.perc_medio)}</span>
        <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 120, textAlign: 'right' }}>{fmtMoeda(subgrupo.valor_periodo)}</span>
      </div>

      {expandido && (
        <div style={{ marginLeft: 16, marginTop: 4 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 60px 130px 120px',
            gap: 8, padding: '4px 12px', fontSize: 9,
            color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em'
          }}>
            <span>Atividade</span>
            <span style={{ textAlign: 'right' }}>Plan.</span>
            <span style={{ textAlign: 'right' }}>Real.</span>
            <span style={{ textAlign: 'right' }}>Desvio</span>
            <span>Progresso</span>
            <span style={{ textAlign: 'right' }}>Valor período</span>
          </div>
          {subgrupo.atividades.map(at => <AtividadeRow key={at.nome} at={at} />)}
        </div>
      )}
    </div>
  )
}

function GrupoCard({ grupo, index }) {
  const [expandido, setExpandido] = useState(false)
  const icone = ICONES[grupo.nome] || '📦'
  const temSubgrupos = grupo.subgrupos && grupo.subgrupos.length > 0
  const totalItens = grupo.atividades.length + grupo.subgrupos.reduce((s, sg) => s + sg.atividades.length, 0)

  return (
    <div style={{ border: '.5px solid var(--border)', borderRadius: 10, marginBottom: 8, overflow: 'hidden', background: 'var(--bg)' }}>
      <div
        onClick={() => setExpandido(!expandido)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', cursor: 'pointer',
          background: expandido ? 'rgba(255,255,255,0.03)' : 'transparent',
          transition: 'background 0.15s'
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'var(--text2)', flexShrink: 0
        }}>{index + 1}</div>

        <span style={{ fontSize: 16 }}>{icone}</span>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{grupo.nome}</div>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
            {totalItens} atividades{temSubgrupos && ` · ${grupo.subgrupos.length} pavimentos`}
          </div>
        </div>

        {/* Barra de avanço */}
        <div style={{ width: 120 }}>
          <div style={{ fontSize: 9, color: 'var(--text2)', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
            <span>Plan: {fmtPerc(grupo.perc_medio)}</span>
          </div>
          <div style={{ position: 'relative', height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(grupo.perc_medio, 100)}%`, background: '#5B9BD5', borderRadius: 3 }} />
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 140 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{fmtMoeda(grupo.valor_periodo)}</div>
          <div style={{ fontSize: 10, color: 'var(--text2)' }}>do total {fmtMoeda(grupo.valor_total)}</div>
        </div>

        <span style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>{expandido ? '▲' : '▼'}</span>
      </div>

      {expandido && (
        <div style={{ padding: '0 18px 16px', borderTop: '.5px solid var(--border)' }}>
          <div style={{ marginTop: 12 }}>
            {/* Cabeçalho colunas */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px 60px 130px 120px',
              gap: 8, padding: '4px 12px', fontSize: 9,
              color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4
            }}>
              <span>Atividade</span>
              <span style={{ textAlign: 'right' }}>Plan.</span>
              <span style={{ textAlign: 'right' }}>Real.</span>
              <span style={{ textAlign: 'right' }}>Desvio</span>
              <span>Progresso</span>
              <span style={{ textAlign: 'right' }}>Valor período</span>
            </div>

            {temSubgrupos && grupo.subgrupos.map(sg => (
              <SubgrupoRow key={sg.nome} subgrupo={sg} />
            ))}

            {grupo.atividades.map(at => <AtividadeRow key={at.nome} at={at} />)}

            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: 12, paddingTop: 10, borderTop: '.5px solid var(--border)',
              fontSize: 12, fontWeight: 700, color: 'var(--text)'
            }}>
              <span>Subtotal {grupo.nome} — valor no período:</span>
              <span style={{ color: '#5B9BD5' }}>{fmtMoeda(grupo.valor_periodo)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AvancoFisicoPlanejado() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(20)
  const [busca, setBusca] = useState('')
  const [ordemGrupos, setOrdemGrupos] = useState('sequencia')

  const NOMES_MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const mesesOpcoes = Array.from({ length: 20 }, (_, i) => {
    const totalMonths = 6 + i
    const ano = 2026 + Math.floor(totalMonths / 12)
    const mes = totalMonths % 12
    return { valor: i + 1, label: `${NOMES_MESES[mes]}/${ano}` }
  })

  useEffect(() => {
    if (!router.isReady) return
    const mesParam = parseInt(router.query.mes)
    setMesAtual(mesParam && mesParam >= 1 && mesParam <= 20 ? mesParam : 20)
  }, [router.isReady])

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const res = await fetch(`/api/avanco-fisico-planejado?mes=${mesAtual}`)
        if (!res.ok) throw new Error('Erro ao carregar dados')
        setDados(await res.json())
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    fetchDados()
  }, [mesAtual])

  if (loading) return <div className="page"><div className="loading">Carregando avanço físico...</div></div>
  if (!dados) return <div className="page"><div className="empty-state"><h3>Erro ao carregar dados</h3></div></div>

  let gruposFiltrados = dados.grupos.filter(g =>
    !busca || g.nome.toLowerCase().includes(busca.toLowerCase())
  )
  if (ordemGrupos === 'perc_desc') gruposFiltrados = [...gruposFiltrados].sort((a, b) => b.perc_medio - a.perc_medio)
  if (ordemGrupos === 'valor_desc') gruposFiltrados = [...gruposFiltrados].sort((a, b) => b.valor_periodo - a.valor_periodo)

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">AVANÇO FÍSICO PLANEJADO</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">
              {mesAtual === 20 ? '20 meses completos' : `Até M${mesAtual} — ${mesesOpcoes[mesAtual-1]?.label}`}
            </div>
          </div>
          <div className="sel-wrap">
            <div className="sel-lbl">Filtrar até o período</div>
            <select className="periodo" value={mesAtual} onChange={e => setMesAtual(parseInt(e.target.value))}>
              {mesesOpcoes.map(m => (
                <option key={m.valor} value={m.valor}>
                  {m.valor === 20 ? 'Todos os 20 meses' : `M${m.valor} — ${m.label}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>← Voltar ao Dashboard</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="kpi" style={{ borderLeftColor: '#5B9BD5' }}>
          <div className="kpi-label">Avanço Físico Médio Planejado</div>
          <div className="kpi-value">{fmtPerc(dados.avancoMedio)}</div>
          <div className="kpi-sub">{dados.grupos.length} macrogrupos</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: '#C8860A' }}>
          <div className="kpi-label">Valor no Período</div>
          <div className="kpi-value">{fmtMoeda(dados.grupos.reduce((s, g) => s + g.valor_periodo, 0))}</div>
          <div className="kpi-sub">Proporcional ao avanço planejado</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: 'var(--border)' }}>
          <div className="kpi-label">Total de Atividades</div>
          <div className="kpi-value">{dados.totalAtividades}</div>
          <div className="kpi-sub">Com cronograma até M{mesAtual}</div>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--text2)', marginBottom: 10, flexWrap: 'wrap' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#5B9BD5', opacity: 0.5, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>Planejado</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#9B59B6', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>Realizado</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#4D9B6A', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>Adiantado</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#B03030', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>Atrasado</span>
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4 }}>Buscar grupo</div>
          <input
            type="text" placeholder="🔍 Filtrar..."
            value={busca} onChange={e => setBusca(e.target.value)}
            style={{ width: '100%', padding: '7px 12px', fontSize: 12, borderRadius: 6, border: '.5px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4 }}>Ordenar grupos</div>
          <select className="periodo" value={ordemGrupos} onChange={e => setOrdemGrupos(e.target.value)}>
            <option value="sequencia">Sequência construtiva</option>
            <option value="perc_desc">Maior avanço primeiro</option>
            <option value="valor_desc">Maior valor primeiro</option>
          </select>
        </div>
        {busca && <button className="btn-secondary" style={{ fontSize: 11 }} onClick={() => setBusca('')}>Limpar</button>}
      </div>

      {/* Grupos */}
      <div>
        {gruposFiltrados.map((grupo, index) => (
          <GrupoCard key={grupo.chave} grupo={grupo} index={index} />
        ))}
      </div>

      {/* Rodapé */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', borderRadius: 10, background: 'var(--bg2)',
        border: '.5px solid var(--border)', marginTop: 8
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>VALOR TOTAL NO PERÍODO</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#5B9BD5' }}>
          {fmtMoeda(gruposFiltrados.reduce((s, g) => s + g.valor_periodo, 0))}
        </span>
      </div>
    </div>
  )
}