import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const fmtPerc = (val) => `${val.toFixed(1)}%`

export default function AvancoFisicoPlanejado() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(18)

  const mesesOpcoes = Array.from({ length: 18 }, (_, i) => {
    const data = new Date(2025, 3 + i, 1)
    return {
      valor: i + 1,
      label: data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    }
  })

  useEffect(() => {
    if (!router.isReady) return
    const mesParam = parseInt(router.query.mes)
    const mes = mesParam && mesParam >= 1 && mesParam <= 18 ? mesParam : 18
    setMesAtual(mes)
  }, [router.isReady])

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const res = await fetch(`/api/avanco-fisico-planejado?mes=${mesAtual}`)
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
  }, [mesAtual])

  if (loading) return <div className="page"><div className="loading">Carregando avanço físico planejado...</div></div>
  if (!dados) return <div className="page"><div className="empty-state"><h3>Erro ao carregar dados</h3></div></div>

  const getStatusColor = (status) => {
    switch(status) {
      case 'Concluído': return '#4D9B6A'
      case 'Em andamento': return '#C8860A'
      default: return '#B03030'
    }
  }

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">AVANÇO FÍSICO PLANEJADO</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">
              {mesAtual === 18 ? '18 meses completos' : `Até M${mesAtual}`}
            </div>
          </div>
          <div className="sel-wrap">
            <div className="sel-lbl">Período</div>
            <select
              className="periodo"
              value={mesAtual}
              onChange={(e) => setMesAtual(parseInt(e.target.value))}
            >
              {mesesOpcoes.map(m => (
                <option key={m.valor} value={m.valor}>
                  {m.valor === 18 ? 'Todos os 18 meses' : m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>← Voltar ao Dashboard</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi" style={{ borderLeftColor: '#5B9BD5' }}>
          <div className="kpi-label">Avanço Físico Médio</div>
          <div className="kpi-value">{fmtPerc(dados.avancoMedio)}</div>
          <div className="kpi-sub">{dados.grupos.length} atividades</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📊 Avanço Físico Planejado por Atividade</div>
        <table>
          <thead>
            <tr>
              <th>Atividade</th>
              <th style={{ textAlign: 'right' }}>Avanço Planejado</th>
              <th style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {dados.grupos.map((grupo) => (
              <tr key={grupo.nome}>
                <td>{grupo.nome}</td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmtPerc(grupo.avanço)}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{
                    backgroundColor: getStatusColor(grupo.status),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    {grupo.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: '700' }}>
              <td>MÉDIA</td>
              <td style={{ textAlign: 'right' }}>{fmtPerc(dados.avancoMedio)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card">
        <div className="card-title">📈 Visualização do Avanço</div>
        {dados.grupos.map((grupo) => (
          <div key={grupo.nome} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <span>{grupo.nome}</span>
              <span style={{ fontWeight: '600' }}>{fmtPerc(grupo.avanço)}</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg2)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(grupo.avanço, 100)}%`,
                height: '100%',
                backgroundColor: getStatusColor(grupo.status),
                transition: 'width 0.3s'
              }}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}