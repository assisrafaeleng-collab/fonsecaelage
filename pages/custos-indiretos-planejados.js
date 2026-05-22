// pages/custos-indiretos-planejados.js
//
// Página detalhada de custos indiretos planejados

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

export default function CustosIndiretosPlanejados() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(18)

  useEffect(() => {
    if (router.query.mes) {
      setMesAtual(parseInt(router.query.mes))
    }
  }, [router.query.mes])

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const res = await fetch(`/api/custos-indiretos-planejados?mes=${mesAtual}`)
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
        <div className="loading">Carregando custos indiretos planejados...</div>
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
      {/* HEADER */}
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">CUSTOS INDIRETOS PLANEJADOS</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">18 meses de execução</div>
          </div>
        </div>

        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>
            ← Voltar ao Dashboard
          </button>
        </div>
      </div>

      {/* RESUMO */}
      <div className="kpi-grid">
        <div className="kpi" style={{ borderLeftColor: '#5B9BD5' }}>
          <div className="kpi-label">Total Custos Indiretos</div>
          <div className="kpi-value">{fmtMoeda(dados.total)}</div>
          <div className="kpi-sub">{dados.categorias.length} categorias</div>
        </div>
      </div>

      {/* TABELA */}
      <div className="card">
        <div className="card-title">💳 Custos Indiretos Planejados por Categoria</div>

        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th style={{ textAlign: 'right' }}>Valor Planejado</th>
              <th style={{ textAlign: 'right' }}>% do Total</th>
            </tr>
          </thead>
          <tbody>
            {dados.categorias.map((categoria) => (
              <tr key={categoria.nome}>
                <td>{categoria.nome}</td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>
                  {fmtMoeda(categoria.valor)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {fmtPerc(categoria.percentual)}
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

      {/* DETALHES */}
      <div className="card">
        <div className="card-title">📝 Descrição das Categorias</div>
        
        <div style={{ lineHeight: '1.8', color: 'var(--text1)' }}>
          <p><strong>Terreno:</strong> Aquisição de terreno, ITBI, certidões, cartório e registros de imóvel.</p>
          <p><strong>Projetos e Consultoria:</strong> Sondagem, laudo cautelar e projeto estrutural.</p>
          <p><strong>Serviços Jurídicos:</strong> Honorários advocatícios e assessoria legal.</p>
          <p><strong>Taxas e Licenças:</strong> ART de execução, alvará de movimentação de terra e licenças municipais.</p>
          <p><strong>Locações:</strong> Andaimes, locação de equipamentos e veículos.</p>
          <p><strong>Canteiro de Obras:</strong> Materiais do canteiro, padrão elétrico e instalações gerais.</p>
        </div>
      </div>
    </div>
  )
}
