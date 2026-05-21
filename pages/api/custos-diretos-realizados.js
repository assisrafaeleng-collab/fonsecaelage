// pages/custos-diretos-realizados.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const fmtMoeda = (val) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(val)
}

const fmtPerc = (val) => `${val.toFixed(2)}%`

export default function CustosDiretosRealizados() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(18)

  const mesesOpcoes = Array.from({ length: 18 }, (_, i) => i + 1)

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const res = await fetch(`/api/custos-diretos-realizados?mes=${mesAtual}`)
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

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Carregando custos diretos realizados...</div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Erro ao carregar dados</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">CUSTOS DIRETOS REALIZADOS</div>
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
              {mesesOpcoes.map(mes => (
                <option key={mes} value={mes}>
                  {mes === 18 ? 'Todos os 18 meses' : `Até M${mes}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>
            ← Voltar ao Dashboard
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi" style={{ borderLeftColor: '#4D9B6A' }}>
          <div className="kpi-label">Total Custos Diretos Realizados</div>
          <div className="kpi-value">{fmtMoeda(dados.total)}</div>
          <div className="kpi-sub">{dados.atividades.length} atividades</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">🔨 Custos Diretos Realizados por Atividade</div>

        <table>
          <thead>
            <tr>
              <th>Atividade</th>
              <th style={{ textAlign: 'right' }}>Valor Realizado</th>
              <th style={{ textAlign: 'right' }}>% do Total</th>
            </tr>
          </thead>
          <tbody>
            {dados.atividades.map((atividade) => (
              <tr key={atividade.nome}>
                <td>{atividade.nome}</td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>
                  {fmtMoeda(atividade.valor)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {fmtPerc(atividade.percentual)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: '700' }}>
              <td>TOTAL</td>
              <td style={{ textAlign: 'right' }}>{fmtMoeda(dados.total)}</td>
              <td style={{ textAlign: 'right' }}>100,00%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}