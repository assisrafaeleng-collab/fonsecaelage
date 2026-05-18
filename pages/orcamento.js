// pages/orcamento.js
//
// Página de Orçamento Planejado Detalhado com FILTRO DE PERÍODO

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function OrcamentoPage() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(18) // Padrão: todos os 18 meses

  // Gerar opções de meses (1-18)
  const mesesOpcoes = Array.from({ length: 18 }, (_, i) => i + 1)

  useEffect(() => {
    async function fetchOrcamento() {
      try {
        setLoading(true)
        // Buscar dados filtrados pelo mês
        const res = await fetch(`/api/orcamento-detalhado?mes=${mesAtual}`)
        if (!res.ok) throw new Error('Erro ao carregar orçamento')
        const data = await res.json()
        setDados(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchOrcamento()
  }, [mesAtual]) // Recarrega quando muda o mês

  const fmtMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(val)
  }

  const fmtPerc = (val) => `${val.toFixed(2)}%`

  if (loading) {
    return (
      <div className="page">
        <div className="header">
          <div className="header-top">
            <div>
              <div className="obra-eye">ORÇAMENTO PLANEJADO</div>
              <div className="obra-nome">Flats Pampulha</div>
            </div>
          </div>
        </div>
        <div className="loading">Carregando orçamento...</div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Erro ao carregar orçamento</h3>
        </div>
      </div>
    )
  }

  const { grupos, total, custos_indiretos, periodo_label } = dados

  return (
    <div className="page">
      {/* HEADER */}
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">ORÇAMENTO PLANEJADO — 18 MESES</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">{periodo_label}</div>
          </div>
          
          {/* SELETOR DE PERÍODO */}
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

      {/* RESUMO */}
      <div className="kpi-grid">
        <div className="kpi" style={{ borderLeftColor: '#C8860A' }}>
          <div className="kpi-label">Orçamento {mesAtual === 18 ? 'Total' : `até M${mesAtual}`}</div>
          <div className="kpi-value">{fmtMoeda(total)}</div>
          <div className="kpi-sub">Diretos + Indiretos</div>
        </div>

        <div className="kpi" style={{ borderLeftColor: '#4D9B6A' }}>
          <div className="kpi-label">Custos Diretos</div>
          <div className="kpi-value">{fmtMoeda(total - custos_indiretos)}</div>
          <div className="kpi-sub">{fmtPerc(((total - custos_indiretos) / total) * 100)} do total</div>
        </div>

        <div className="kpi" style={{ borderLeftColor: '#5B9BD5' }}>
          <div className="kpi-label">Custos Indiretos</div>
          <div className="kpi-value">{fmtMoeda(custos_indiretos)}</div>
          <div className="kpi-sub">{fmtPerc((custos_indiretos / total) * 100)} do total</div>
        </div>
      </div>

      {/* TABELA DE GRUPOS */}
      <div className="card">
        <div className="card-title">
          📊 Orçamento por Grupo de Custo {mesAtual === 18 ? '' : `(até M${mesAtual})`}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Grupo</th>
              <th style={{ textAlign: 'right' }}>Valor Acumulado</th>
              <th style={{ textAlign: 'right' }}>% do Orçamento</th>
              <th style={{ textAlign: 'right' }}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => (
              <tr key={grupo.nome}>
                <td>
                  <span style={{ marginRight: '8px' }}>{grupo.icone}</span>
                  {grupo.nome}
                </td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>
                  {fmtMoeda(grupo.valor)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {fmtPerc((grupo.valor / total) * 100)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className={`badge ${grupo.tipo === 'Direto' ? 'badge-ok' : 'badge-blue'}`}>
                    {grupo.tipo}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: '700' }}>
              <td>TOTAL</td>
              <td style={{ textAlign: 'right' }}>{fmtMoeda(total)}</td>
              <td style={{ textAlign: 'right' }}>100,00%</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* OBSERVAÇÕES */}
      <div className="card">
        <div className="card-title">📝 Observações</div>
        <div className="notas-box">
          <strong>Período selecionado:</strong> {periodo_label}
          <br /><br />
          <strong>Custos Diretos:</strong> Relacionados diretamente à execução da obra (materiais, mão de obra, equipamentos).
          <br /><br />
          <strong>Custos Indiretos:</strong> Necessários para o projeto mas não relacionados à construção física (terreno, projetos, taxas, jurídico).
        </div>
      </div>
    </div>
  )
}
