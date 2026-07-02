// pages/custos-indiretos-planejados.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const fmtMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val || 0)
const fmtPerc = (val) => `${(val || 0).toFixed(2).replace('.', ',')}%`

const NOMES = ['jul','ago','set','out','nov','dez','jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez','jan','fev']
const ANOS = [2026,2026,2026,2026,2026,2026,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2027,2028,2028]

export default function CustosIndiretosPlanejados() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState('valor_desc')
  const [mes, setMes] = useState(20)

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const res = await fetch(`/api/custos-indiretos-planejados?mes=${mes}`)
        const data = await res.json()
        setDados(data)
      } catch (error) {
        console.error('Erro:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDados()
  }, [mes])

  if (loading) return <div className="page"><div className="loading">Carregando custos indiretos planejados...</div></div>
  if (!dados) return <div className="page"><div className="empty-state"><h3>Erro ao carregar dados</h3></div></div>

  const cats = (dados.categorias || []).map(x => ({
    ...x,
    nome: x.nome || x.categoria || '',
    valor: x.valor !== undefined ? x.valor : (x.valor_total || 0)
  }))

  let categoriasFiltradas = cats.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  )

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
  const totalGeral = dados.total || dados.totalGeral || totalFiltrado

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">CUSTOS INDIRETOS PLANEJADOS</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">{mes === 20 ? '20 meses de execução · Jul/2026 a Fev/2028' : `M${mes} — ${NOMES[mes-1]}/${ANOS[mes-1]}`}</div>
          </div>
        </div>
        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>← Voltar ao Dashboard</button>
        </div>
      </div>

      <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: '1fr', marginBottom: 16 }}>
        <div className="kpi" style={{ borderLeftColor: '#C8860A' }}>
          <div className="kpi-label">TOTAL CUSTOS INDIRETOS{mes !== 20 ? ` · ATÉ M${mes}` : ''}</div>
          <div className="kpi-value">{fmtMoeda(totalGeral)}</div>
          <div className="kpi-sub">{categoriasFiltradas.length} categorias{mes !== 20 ? ` · ${NOMES[mes-1]}/${ANOS[mes-1]}` : ''}</div>
        </div>
      </div>

      <div style={{ background: '#17171b', border: '1px solid #2a2a31', borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ color: '#6d675e', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>🔧 Filtros e ordenação</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', color: '#6d675e', fontSize: 10, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Período</label>
            <select value={mes} onChange={e => setMes(parseInt(e.target.value))} className="select-periodo">
              <option value={20}>Todos (20 meses)</option>
              {Array.from({length:20},(_,i) => (
                <option key={i+1} value={i+1}>M{i+1} — {NOMES[i]}/{ANOS[i]}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: '#6d675e', fontSize: 10, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Buscar categoria</label>
            <input
              type="text"
              placeholder="Digite para filtrar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="search-input"
            />
          </div>
          <div>
            <label style={{ display: 'block', color: '#6d675e', fontSize: 10, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 4 }}>Ordenar por</label>
            <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} className="select-periodo">
              <option value="valor_desc">Maior valor primeiro</option>
              <option value="valor_asc">Menor valor primeiro</option>
              <option value="nome_asc">Nome A-Z</option>
              <option value="nome_desc">Nome Z-A</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ background: '#17171b', border: '1px solid #2a2a31', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a2a31', fontSize: 12, fontWeight: 600, color: '#a09a90', textTransform: 'uppercase', letterSpacing: .5 }}>
          Custos indiretos planejados por categoria{mes !== 20 ? ` (até M${mes})` : ''}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px 120px', gap: 8, padding: '10px 18px', fontSize: 10, color: '#6d675e', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid #2a2a31' }}>
          <span>Categoria</span>
          <span style={{ textAlign: 'right' }}>Valor planejado</span>
          <span style={{ textAlign: 'right' }}>% do total</span>
          <span>Participação</span>
        </div>

        {categoriasFiltradas.map((categoria, i) => {
          const pct = totalGeral > 0 ? (categoria.valor / totalGeral) * 100 : 0
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px 120px', gap: 8, padding: '12px 18px', alignItems: 'center', borderBottom: '1px solid #1a1a20', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
              <span style={{ fontSize: 13, color: '#ece9e4' }}>{categoria.nome}</span>
              <span style={{ textAlign: 'right', fontSize: 13, color: '#e6a338', fontWeight: 600 }}>{fmtMoeda(categoria.valor)}</span>
              <span style={{ textAlign: 'right', fontSize: 12, color: '#a09a90' }}>{fmtPerc(pct)}</span>
              <div style={{ height: 4, background: '#1e1e24', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(pct * 2, 100)}%`, background: '#5B9BD5', borderRadius: 2 }} />
              </div>
            </div>
          )
        })}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px 120px', gap: 8, padding: '12px 18px', borderTop: '2px solid #2a2a31', fontWeight: 700 }}>
          <span style={{ color: '#ece9e4' }}>{busca ? `${categoriasFiltradas.length} categorias` : 'TOTAL'}</span>
          <span style={{ textAlign: 'right', color: '#e6a338' }}>{fmtMoeda(busca ? totalFiltrado : totalGeral)}</span>
          <span style={{ textAlign: 'right', color: '#a09a90' }}>{busca ? fmtPerc(totalGeral > 0 ? (totalFiltrado / totalGeral) * 100 : 0) : '100,00%'}</span>
          <span></span>
        </div>
      </div>

      {categoriasFiltradas.length === 0 && (
        <div style={{ color: '#6d675e', textAlign: 'center', padding: 32, fontSize: 14 }}>
          Nenhuma categoria encontrada.
        </div>
      )}
    </div>
  )
}
