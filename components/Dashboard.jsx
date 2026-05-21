// components/Dashboard.jsx
// 
// Dashboard com KPIs expansíveis - mostra detalhamento por grupo ao clicar
// COM CABEÇALHO COMPARATIVO DIRETO/INDIRETO ANTES DO GRÁFICO

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const fmtMoeda = (val) => {
  if (!val) return 'R$ 0'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0
  }).format(val)
}

const fmtPerc = (val) => {
  if (val == null) return '-'
  return `${val.toFixed(1)}%`
}

export default function Dashboard({ updates, selectedId, onSelectId, mesLimite = 18 }) {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [dadosOrcamento, setDadosOrcamento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [expanded, setExpanded] = useState(false) // ← Estado de expansão

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        
        // Buscar dados integrados (realizados)
        const res1 = await fetch(`/api/dashboard-integrado?mes=${mesLimite}`)
        if (!res1.ok) throw new Error('Erro ao carregar dados integrados')
        const data1 = await res1.json()
        setDados(data1)

        // Buscar dados de orçamento (planejados)
        const res2 = await fetch(`/api/orcamento-detalhado?mes=${mesLimite}`)
        if (!res2.ok) throw new Error('Erro ao carregar orçamento')
        const data2 = await res2.json()
        setDadosOrcamento(data2)

      } catch (err) {
        console.error('Erro ao buscar dashboard:', err)
        setErro(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchDados()
  }, [selectedId, mesLimite])

  if (loading) {
    return <div className="loading">Carregando dados integrados...</div>
  }

  if (erro) {
    return (
      <div className="empty-state">
        <h3>Erro ao carregar dados</h3>
        <p>{erro}</p>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="empty-state">
        <h3>Nenhum dado disponível</h3>
        <p>Execute os scripts SQL de importação do cronograma.</p>
      </div>
    )
  }

  const { kpis, meses_alinhados, custos_por_grupo } = dados

  // ========================================================================
  // PREPARAR DADOS PARA O GRÁFICO
  // ========================================================================
  const labels = meses_alinhados.map(m => {
    if (!m.competencia) return `M${m.mes_numero}`
    const d = new Date(m.competencia + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  })

  const finPlan = meses_alinhados.map(m => m.financeiro_planejado ? m.financeiro_planejado / 1000 : null)
  const finReal = meses_alinhados.map(m => m.financeiro_realizado ? m.financeiro_realizado / 1000 : null)
  const fisPlan = meses_alinhados.map(m => m.fisico_planejado)
  const fisReal = meses_alinhados.map(m => m.fisico_realizado)

  const chartData = {
    labels,
    datasets: [
      {
        label: '💰 Financeiro Planejado',
        data: finPlan,
        borderColor: '#C8860A',
        backgroundColor: 'rgba(200, 134, 10, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        yAxisID: 'y-financeiro',
        tension: 0.3
      },
      {
        label: '💵 Financeiro Realizado',
        data: finReal,
        borderColor: '#4D9B6A',
        backgroundColor: 'rgba(77, 155, 106, 0.1)',
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y-financeiro',
        tension: 0.3
      },
      {
        label: '🔨 Físico Planejado',
        data: fisPlan,
        borderColor: '#5B9BD5',
        backgroundColor: 'rgba(91, 155, 213, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 3,
        pointHoverRadius: 5,
        yAxisID: 'y-fisico',
        tension: 0.3
      },
      {
        label: '⚙️ Físico Realizado',
        data: fisReal,
        borderColor: '#2E5C8A',
        backgroundColor: 'rgba(46, 92, 138, 0.1)',
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y-fisico',
        tension: 0.3
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#E8E8E8',
          font: { size: 11 },
          usePointStyle: true,
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        titleColor: '#E8E8E8',
        bodyColor: '#E8E8E8',
        borderColor: '#2A2A2A',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            if (value == null) return null
            
            if (context.dataset.yAxisID === 'y-financeiro') {
              return `${label}: R$ ${value.toFixed(0)}k`
            } else {
              return `${label}: ${value.toFixed(1)}%`
            }
          }
        }
      }
    },
    scales: {
      'y-financeiro': {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Financeiro (R$ mil)',
          color: '#A8A8A8',
          font: { size: 11 }
        },
        ticks: {
          color: '#A8A8A8',
          font: { size: 10 },
          callback: function(value) {
            return `R$ ${value}k`
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        }
      },
      'y-fisico': {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 100,
        title: {
          display: true,
          text: 'Físico (%)',
          color: '#A8A8A8',
          font: { size: 11 }
        },
        ticks: {
          color: '#A8A8A8',
          font: { size: 10 },
          callback: function(value) {
            return `${value}%`
          }
        },
        grid: {
          drawOnChartArea: false
        }
      },
      x: {
        ticks: {
          color: '#A8A8A8',
          font: { size: 10 },
          maxRotation: 45,
          minRotation: 45
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        }
      }
    }
  }

  const cpiStatus = kpis.cpi >= 1 ? 'ok' : kpis.cpi >= 0.9 ? 'warn' : 'bad'
  const spiStatus = kpis.spi >= 1 ? 'ok' : kpis.spi >= 0.9 ? 'warn' : 'bad'

  // Ícones dos grupos
  const grupoIcons = {
    'Terreno': '🏗️',
    'Projetos e Consultorias': '📐',
    'Mão de Obra': '👷',
    'Materiais': '🔨',
    'Equipamentos': '⚙️',
    'Outros': '📦'
  }

  // ========================================================================
  // CALCULAR DADOS PLANEJADOS E REALIZADOS
  // ========================================================================
  const custoDiretoPlano = dadosOrcamento ? dadosOrcamento.custos_diretos : 0
  const custoIndiretoPlano = dadosOrcamento ? dadosOrcamento.custos_indiretos : 0
  const avancoFisicoPlano = kpis.avanco_fisico_planejado || 0
  const avancoFisicoReal = kpis.avanco_fisico_realizado || 0
  
  const custoDiretoReal = kpis.custo_realizado - (kpis.custo_indireto_realizado || 0)
  const custoIndiretoReal = kpis.custo_indireto_realizado || 0

  const saldoCustoDireto = custoDiretoPlano - custoDiretoReal
  const saldoCustoIndireto = custoIndiretoPlano - custoIndiretoReal

  return (
    <div>
      {/* KPIs PRINCIPAIS */}
      <div className="kpi-grid">
        <div 
          className="kpi kpi-clickable" 
          style={{ borderLeftColor: '#C8860A' }}
          onClick={() => router.push('/orcamento')}
          title="Clique para ver detalhamento"
        >
          <div className="kpi-label">Orçamento Total</div>
          <div className="kpi-value">{fmtMoeda(kpis.orcamento_total)}</div>
          <div className="kpi-sub">Planejado para 18 meses · 📊 Ver detalhes</div>
        </div>

        <div 
          className="kpi kpi-expandable" 
          style={{ borderLeftColor: '#4D9B6A' }}
          onClick={() => setExpanded(!expanded)}
          title={expanded ? "Clique para colapsar" : "Clique para expandir detalhamento"}
        >
          <div className="kpi-label">
            Custo Realizado 
            <span style={{ 
              marginLeft: '8px', 
              fontSize: '12px',
              transition: 'transform 0.3s'
            }}>
              {expanded ? '▼' : '▶'}
            </span>
          </div>
          <div className="kpi-value">{fmtMoeda(kpis.custo_realizado)}</div>
          <div className="kpi-sub">
            {fmtPerc((kpis.custo_realizado / kpis.orcamento_total) * 100)} do orçamento
            {expanded ? ' · ▼ Ver menos' : ' · ▶ Ver por grupo'}
          </div>
        </div>

        <div className="kpi" style={{ borderLeftColor: '#5B9BD5' }}>
          <div className="kpi-label">Avanço Físico</div>
          <div className="kpi-value">{fmtPerc(kpis.avanco_fisico_realizado)}</div>
          <div className="kpi-sub">
            Planejado: {fmtPerc(kpis.avanco_fisico_planejado)}
          </div>
        </div>

        <div 
          className="kpi kpi-clickable" 
          style={{ borderLeftColor: kpis.saldo_orcamento > 0 ? '#4D9B6A' : '#B03030' }}
          onClick={() => router.push('/orcamento')}
          title="Clique para ver detalhamento"
        >
          <div className="kpi-label">Saldo Orçamento</div>
          <div className="kpi-value">{fmtMoeda(kpis.saldo_orcamento)}</div>
          <div className="kpi-sub">
            {fmtPerc((kpis.saldo_orcamento / kpis.orcamento_total) * 100)} restante · 📊 Ver detalhes
          </div>
        </div>
      </div>

      {/* CUSTOS POR GRUPO - EXPANSÍVEL */}
      {expanded && custos_por_grupo && custos_por_grupo.length > 0 && (
        <div className="kpi-grid kpi-grid-expanded" style={{ 
          marginTop: '-10px',
          animation: 'slideDown 0.3s ease-out'
        }}>
          {custos_por_grupo.map(({ grupo, valor }) => (
            <div 
              key={grupo}
              className="kpi kpi-small kpi-clickable"
              style={{ borderLeftColor: '#6B9BD5' }}
              onClick={() => router.push(`/custos?grupo=${encodeURIComponent(grupo)}`)}
              title={`Clique para ver custos de ${grupo}`}
            >
              <div className="kpi-label" style={{ fontSize: '11px' }}>
                {grupoIcons[grupo] || '📦'} {grupo}
              </div>
              <div className="kpi-value" style={{ fontSize: '20px' }}>
                {fmtMoeda(valor)}
              </div>
              <div className="kpi-sub" style={{ fontSize: '10px' }}>
                {fmtPerc((valor / kpis.custo_realizado) * 100)} do total · 📊
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CABEÇALHO COMPARATIVO DIRETO/INDIRETO */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-title">📊 Comparativo Físico-Financeiro</div>
        
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px'
        }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg2)', borderBottom: '2px solid var(--border)' }}>
              <th colSpan="4" style={{ textAlign: 'center', padding: '12px', borderRight: '1px solid var(--border)', color: '#C8860A', fontWeight: '700' }}>
                💰 CUSTOS DIRETOS
              </th>
              <th colSpan="4" style={{ textAlign: 'center', padding: '12px', color: '#5B9BD5', fontWeight: '700' }}>
                💳 CUSTOS INDIRETOS
              </th>
            </tr>
            <tr style={{ backgroundColor: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px', textAlign: 'right', borderRight: '1px solid var(--border)' }}>Planejado</th>
              <th style={{ padding: '12px', textAlign: 'right', borderRight: '1px solid var(--border)' }}>Realizado</th>
              <th style={{ padding: '12px', textAlign: 'right', borderRight: '1px solid var(--border)' }}>Saldo</th>
              <th style={{ padding: '12px', textAlign: 'right', borderRight: '1px solid var(--border)' }}>Avanço Físico</th>
              <th style={{ padding: '12px', textAlign: 'right', borderRight: '1px solid var(--border)' }}>Planejado</th>
              <th style={{ padding: '12px', textAlign: 'right', borderRight: '1px solid var(--border)' }}>Realizado</th>
              <th style={{ padding: '12px', textAlign: 'right', borderRight: '1px solid var(--border)' }}>Saldo</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Realizado</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <td style={{ padding: '16px 12px', textAlign: 'right', borderRight: '1px solid var(--border)', fontWeight: '600', color: '#C8860A' }}>
                {fmtMoeda(custoDiretoPlano)}
              </td>
              <td style={{ padding: '16px 12px', textAlign: 'right', borderRight: '1px solid var(--border)', fontWeight: '600', color: '#4D9B6A' }}>
                {fmtMoeda(custoDiretoReal)}
              </td>
              <td style={{ 
                padding: '16px 12px', 
                textAlign: 'right', 
                borderRight: '1px solid var(--border)', 
                fontWeight: '600',
                color: saldoCustoDireto >= 0 ? '#4D9B6A' : '#B03030'
              }}>
                {fmtMoeda(saldoCustoDireto)}
              </td>
              <td style={{ padding: '16px 12px', textAlign: 'right', borderRight: '1px solid var(--border)', fontWeight: '600', color: '#5B9BD5' }}>
                {fmtPerc(avancoFisicoPlano)}
              </td>
              <td style={{ padding: '16px 12px', textAlign: 'right', borderRight: '1px solid var(--border)', fontWeight: '600', color: '#5B9BD5' }}>
                {fmtMoeda(custoIndiretoPlano)}
              </td>
              <td style={{ padding: '16px 12px', textAlign: 'right', borderRight: '1px solid var(--border)', fontWeight: '600', color: '#4D9B6A' }}>
                {fmtMoeda(custoIndiretoReal)}
              </td>
              <td style={{ 
                padding: '16px 12px', 
                textAlign: 'right', 
                borderRight: '1px solid var(--border)', 
                fontWeight: '600',
                color: saldoCustoIndireto >= 0 ? '#4D9B6A' : '#B03030'
              }}>
                {fmtMoeda(saldoCustoIndireto)}
              </td>
              <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: '600', color: '#2E5C8A' }}>
                {fmtPerc(avancoFisicoReal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* GRÁFICO CURVA S */}
      <div className="card">
        <div className="card-title">📊 Curva S — Acompanhamento Físico-Financeiro</div>
        <div style={{ height: '400px', position: 'relative' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* INDICADORES DE DESEMPENHO */}
      <div className="two-col">
        <div className="card">
          <div className="card-title">📈 Indicadores de Desempenho</div>
          
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>
              CPI (Cost Performance Index)
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
              {kpis.cpi.toFixed(2)}
            </div>
            <div className={`badge badge-${cpiStatus}`}>
              {kpis.cpi >= 1 ? 'Dentro do orçamento' : 'Acima do orçamento'}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>
              SPI (Schedule Performance Index)
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
              {kpis.spi.toFixed(2)}
            </div>
            <div className={`badge badge-${spiStatus}`}>
              {kpis.spi >= 1 ? 'No prazo' : 'Atrasado'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>
              Desvio Físico
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: kpis.desvio_fisico >= 0 ? '#4D9B6A' : '#B03030' }}>
              {kpis.desvio_fisico >= 0 ? '+' : ''}{fmtPerc(kpis.desvio_fisico)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">💰 Projeção Financeira</div>
          
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>
              Projeção de Custo Final
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
              {fmtMoeda(kpis.projecao_custo_final)}
            </div>
            <div className="kpi-sub">
              {kpis.projecao_custo_final > kpis.orcamento_total ? (
                <span style={{ color: '#B03030' }}>
                  ⚠️ {fmtMoeda(kpis.projecao_custo_final - kpis.orcamento_total)} acima do orçado
                </span>
              ) : (
                <span style={{ color: '#4D9B6A' }}>
                  ✓ Dentro do orçamento
                </span>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>
              Desvio Financeiro
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: kpis.desvio_financeiro <= 0 ? '#4D9B6A' : '#B03030' }}>
              {fmtMoeda(Math.abs(kpis.desvio_financeiro))}
            </div>
            <div className="kpi-sub">
              {kpis.desvio_financeiro <= 0 ? 'Economia' : 'Acima do planejado'} ({fmtPerc(Math.abs(kpis.desvio_financeiro_perc))})
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
