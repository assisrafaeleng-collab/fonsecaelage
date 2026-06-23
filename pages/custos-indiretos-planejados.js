// pages/custos-indiretos-planejados.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const fmtMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val)
const fmtPerc = (val) => `${val.toFixed(2)}%`

export default function CustosIndiretosPlanejados() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filtros e ordenação
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState('valor_desc') // valor_desc, valor_asc, nome_asc, nome_desc

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const res = await fetch(`/api/custos-indiretos-planejados`)
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

  if (loading) return <div className="page"><div className="loading">Carregando custos indiretos planejados...</div></div>
  if (!dados) return <div className="page"><div className="empty-state"><h3>Erro ao carregar dados</h3></div></div>

  // Aplicar filtro de busca
  let categoriasFiltradas = (dados.categorias || []).filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  )

  // Aplicar ordenação
  categoriasFiltradas = [...categoriasFiltradas].sort((a, b) => {
    switch (ordenacao) {
      case 'valor_desc': return b.valor - a.valor
      case 'valor_asc':  return a.valor - b.valor
      case 'nome_asc':   return a.nome.localeCompare(b.nome, 'pt-BR')
      case 'nome_desc':  return b.nome.localeCompare(a.nome, 'pt-BR')
      default: return 0
    }
  })

  const totalFiltrado = categoriasFiltradas.reduce((sum, c) => sum + c.valor, 0)

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">CUSTOS INDIRETOS PLANEJADOS</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">20 meses de execução · Jul/2026 a Fev/2028</div>
          </div>
        </div>
        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>← Voltar ao Dashboard</button>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        <div className="kpi" style={{ borderLeftColor: '#5B9BD5' }}>
          <div className="kpi-label">Total Custos Indiretos</div>
          <div className="kpi-value">{fmtMoeda(dados.total)}</div>
          <div className="kpi-sub">{dados.categorias.length} categorias</div>
        </div>
        {busca && (
          <div className="kpi" style={{ borderLeftColor: '#C8860A' }}>
            <div className="kpi-label">Total Filtrado</div>
            <div className="kpi-value">{fmtMoeda(totalFiltrado)}</div>
            <div className="kpi-sub">{categoriasFiltradas.length} categorias encontradas</div>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div className="card-title">🔍 Filtros e Ordenação</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Buscar categoria</div>
            <input
              type="text"
              placeholder="Digite para filtrar..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '.5px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Ordenar por</div>
            <select
              value={ordenacao}
              onChange={e => setOrdenacao(e.target.value)}
              className="periodo"
            >
              <option value="valor_desc">Maior valor primeiro</option>
              <option value="valor_asc">Menor valor primeiro</option>
              <option value="nome_asc">Nome A → Z</option>
              <option value="nome_desc">Nome Z → A</option>
            </select>
          </div>
          {busca && (
            <button className="btn-secondary" onClick={() => setBusca('')}>
              Limpar filtro
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="card-title">💳 Custos Indiretos Planejados por Categoria</div>
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => setOrdenacao(ordenacao === 'valor_desc' ? 'valor_asc' : 'valor_desc')}>
                Valor Planejado {ordenacao === 'valor_desc' ? '↓' : ordenacao === 'valor_asc' ? '↑' : ''}
              </th>
              <th style={{ textAlign: 'right' }}>% do Total</th>
              <th style={{ width: 120 }}>Participação</th>
            </tr>
          </thead>
          <tbody>
            {categoriasFiltradas.map((categoria) => (
              <tr key={categoria.nome}>
                <td>{categoria.nome}</td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmtMoeda(categoria.valor)}</td>
                <td style={{ textAlign: 'right' }}>{fmtPerc(categoria.percentual)}</td>
                <td>
                  <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(categoria.percentual, 100)}%`, background: '#5B9BD5', borderRadius: 3 }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: '700' }}>
              <td>{busca ? `${categoriasFiltradas.length} categorias` : 'TOTAL'}</td>
              <td style={{ textAlign: 'right' }}>{fmtMoeda(busca ? totalFiltrado : dados.total)}</td>
              <td style={{ textAlign: 'right' }}>{busca ? fmtPerc((totalFiltrado / dados.total) * 100) : '100,00%'}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {categoriasFiltradas.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text2)' }}>
            Nenhuma categoria encontrada para "{busca}"
          </div>
        )}
      </div>
    </div>
  )
}