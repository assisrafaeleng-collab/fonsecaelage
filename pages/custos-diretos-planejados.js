// pages/custos-diretos-planejados.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const fmtMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val)
const fmtPerc = (val) => `${val.toFixed(2)}%`

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

function ordenarItens(itens, ordem) {
  return [...itens].sort((a, b) => {
    if (ordem === 'valor_desc') return b.valor - a.valor
    if (ordem === 'valor_asc') return a.valor - b.valor
    return a.cod_eap?.localeCompare(b.cod_eap, undefined, { numeric: true }) || 0
  })
}

function SubgrupoRow({ subgrupo, ordemItens }) {
  const [expandido, setExpandido] = useState(false)
  const itensOrdenados = ordenarItens(subgrupo.itens, ordemItens)

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={() => setExpandido(!expandido)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
          background: expandido ? 'rgba(91,155,213,0.08)' : 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          transition: 'background 0.15s'
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text2)', width: 14 }}>{expandido ? '▼' : '▶'}</span>
        <span style={{ fontSize: 12, color: 'var(--text)', flex: 1, fontWeight: 500 }}>📐 {subgrupo.nome}</span>
        <span style={{ fontSize: 12, color: '#5B9BD5', fontWeight: 600, minWidth: 140, textAlign: 'right' }}>{fmtMoeda(subgrupo.total)}</span>
        <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 60, textAlign: 'right' }}>{fmtPerc(subgrupo.percentual)}</span>
      </div>

      {expandido && (
        <div style={{ marginLeft: 24, marginTop: 2 }}>
          {itensOrdenados.map(item => (
            <div key={item.cod_eap} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 12px', borderRadius: 4,
              borderLeft: '2px solid rgba(91,155,213,0.3)', marginBottom: 2
            }}>
              <span style={{ fontSize: 10, color: 'var(--text3)', minWidth: 50, fontFamily: 'monospace' }}>{item.cod_eap}</span>
              <span style={{ fontSize: 11, color: 'var(--text2)', flex: 1 }}>{item.descricao}</span>
              <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, minWidth: 140, textAlign: 'right' }}>{fmtMoeda(item.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GrupoCard({ grupo, totalGeral, index, ordemItens }) {
  const [expandido, setExpandido] = useState(false)
  const icone = ICONES[grupo.nome] || '📦'
  const temSubgrupos = grupo.subgrupos && grupo.subgrupos.length > 0
  const totalItens = grupo.itens.length + grupo.subgrupos.reduce((sum, sg) => sum + sg.itens.length, 0)
  const itensOrdenados = ordenarItens(grupo.itens, ordemItens)

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
            {totalItens} {totalItens === 1 ? 'item' : 'itens'}
            {temSubgrupos && ` · ${grupo.subgrupos.length} pavimentos`}
          </div>
        </div>

        <div style={{ width: 80, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${Math.min(grupo.percentual, 100)}%`, background: '#C8860A', borderRadius: 2 }} />
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 160 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{fmtMoeda(grupo.total)}</div>
          <div style={{ fontSize: 10, color: 'var(--text2)' }}>{fmtPerc(grupo.percentual)} do total</div>
        </div>

        <span style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>{expandido ? '▲' : '▼'}</span>
      </div>

      {expandido && (
        <div style={{ padding: '0 18px 16px', borderTop: '.5px solid var(--border)' }}>
          <div style={{ marginTop: 12 }}>
            {temSubgrupos && grupo.subgrupos.map(sg => (
              <SubgrupoRow key={sg.nome} subgrupo={sg} ordemItens={ordemItens} />
            ))}

            {itensOrdenados.length > 0 && (
              <div style={{ marginTop: temSubgrupos ? 8 : 0 }}>
                {temSubgrupos && (
                  <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Itens gerais
                  </div>
                )}
                {itensOrdenados.map(item => (
                  <div key={item.cod_eap} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 12px', borderRadius: 4,
                    borderLeft: '2px solid rgba(200,134,10,0.3)', marginBottom: 2
                  }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)', minWidth: 50, fontFamily: 'monospace' }}>{item.cod_eap}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', flex: 1 }}>{item.descricao}</span>
                    <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, minWidth: 140, textAlign: 'right' }}>{fmtMoeda(item.valor)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 20,
              marginTop: 12, paddingTop: 10, borderTop: '.5px solid var(--border)',
              fontSize: 12, fontWeight: 700, color: 'var(--text)'
            }}>
              <span>Subtotal {grupo.nome}:</span>
              <span style={{ color: '#C8860A' }}>{fmtMoeda(grupo.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustosDiretosPlanejados() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [ordemGrupos, setOrdemGrupos] = useState('sequencia') // sequencia | valor_desc | valor_asc
  const [ordemItens, setOrdemItens] = useState('codigo')     // codigo | valor_desc | valor_asc

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const res = await fetch('/api/custos-diretos-planejados')
        if (!res.ok) throw new Error('Erro ao carregar dados')
        const data = await res.json()
        setDados(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchDados()
  }, [])

  if (loading) return <div className="page"><div className="loading">Carregando custos diretos planejados...</div></div>
  if (!dados) return <div className="page"><div className="empty-state"><h3>Erro ao carregar dados</h3></div></div>

  // Filtrar por busca
  let gruposFiltrados = dados.grupos.filter(g =>
    !busca || g.nome.toLowerCase().includes(busca.toLowerCase())
  )

  // Ordenar grupos
  if (ordemGrupos === 'valor_desc') gruposFiltrados = [...gruposFiltrados].sort((a, b) => b.total - a.total)
  if (ordemGrupos === 'valor_asc') gruposFiltrados = [...gruposFiltrados].sort((a, b) => a.total - b.total)
  // sequencia = ordem original da API

  const totalFiltrado = gruposFiltrados.reduce((s, g) => s + g.total, 0)

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">CUSTOS DIRETOS PLANEJADOS</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">20 meses de execução · Jul/2026 a Fev/2028</div>
          </div>
        </div>
        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>← Voltar ao Dashboard</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi" style={{ borderLeftColor: '#C8860A' }}>
          <div className="kpi-label">Total Custos Diretos</div>
          <div className="kpi-value">{fmtMoeda(dados.total)}</div>
          <div className="kpi-sub">
            {dados.grupos.length} macrogrupos · {dados.grupos.reduce((s, g) => s + g.itens.length + g.subgrupos.reduce((ss, sg) => ss + sg.itens.length, 0), 0)} itens
          </div>
        </div>
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4 }}>Buscar macrogrupo</div>
          <input
            type="text"
            placeholder="🔍 Filtrar..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ width: '100%', padding: '7px 12px', fontSize: 12, borderRadius: 6, border: '.5px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)' }}
          />
        </div>

        <div>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4 }}>Ordem dos grupos</div>
          <select className="periodo" value={ordemGrupos} onChange={e => setOrdemGrupos(e.target.value)}>
            <option value="sequencia">Sequência construtiva</option>
            <option value="valor_desc">Maior valor primeiro</option>
            <option value="valor_asc">Menor valor primeiro</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 4 }}>Ordem dos itens</div>
          <select className="periodo" value={ordemItens} onChange={e => setOrdemItens(e.target.value)}>
            <option value="codigo">Por código EAP</option>
            <option value="valor_desc">Maior valor primeiro</option>
            <option value="valor_asc">Menor valor primeiro</option>
          </select>
        </div>

        {busca && (
          <button className="btn-secondary" style={{ fontSize: 11 }} onClick={() => setBusca('')}>Limpar</button>
        )}
      </div>

      {/* Lista de grupos */}
      <div>
        {gruposFiltrados.map((grupo, index) => (
          <GrupoCard key={grupo.chave} grupo={grupo} totalGeral={dados.total} index={index} ordemItens={ordemItens} />
        ))}
      </div>

      {/* Rodapé */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', borderRadius: 10, background: 'var(--bg2)',
        border: '.5px solid var(--border)', marginTop: 8
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          {busca ? `${gruposFiltrados.length} grupos filtrados` : 'TOTAL GERAL'}
        </span>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#C8860A' }}>
          {fmtMoeda(busca ? totalFiltrado : dados.total)}
        </span>
      </div>
    </div>
  )
}