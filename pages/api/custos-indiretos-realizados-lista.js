// pages/custos-indiretos-realizados-lista.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const fmtMoeda = (val) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(val)
}

const fmtData = (data) => {
  if (!data) return '-'
  return new Date(data).toLocaleDateString('pt-BR')
}

export default function CustosIndiretosRealizadosLista() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const res = await fetch(`/api/custos-indiretos-realizados-lista`)
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

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Carregando custos indiretos realizados...</div>
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
            <div className="obra-eye">CUSTOS INDIRETOS REALIZADOS</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">{dados.quantidade} lançamentos</div>
          </div>
        </div>

        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>
            ← Voltar ao Dashboard
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi" style={{ borderLeftColor: '#5B9BD5' }}>
          <div className="kpi-label">Total Custos Indiretos Realizados</div>
          <div className="kpi-value">{fmtMoeda(dados.total)}</div>
          <div className="kpi-sub">{dados.quantidade} itens lançados</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">💳 Detalhes dos Custos Indiretos Realizados</div>

        {dados.lancamentos.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
            Nenhum custo indireto realizado ainda
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Fornecedor</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {dados.lancamentos.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td>{fmtData(item.data_emissao)}</td>
                    <td>{item.fornecedor || '-'}</td>
                    <td>{item.classificacao || '-'}</td>
                    <td>{item.grupo_custo || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>
                      {fmtMoeda(item.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: '700' }}>
                  <td colSpan="4">TOTAL</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoeda(dados.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
