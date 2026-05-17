// components/Dashboard.jsx
// 
// Dashboard principal com gráfico de 4 curvas (Curva S integrada)
// Versão atualizada com cronograma planejado + realizado

import { useEffect, useState } from 'react'
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

export default function Dashboard({ updates, selectedId, onSelectId }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const res = await fetch('/api/dashboard-integrado')
        if (!res.ok) throw new Error('Erro ao carregar dados')
        const data = await res.json()
        setDados(data)
      } catch (err) {
        console.error('Erro ao buscar dashboard:', err)
        setErro(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchDados()
  }, [selectedId])

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

  const { kpis, meses_alinhados } = dados

  // ========================================================================
  // PREPARAR DADOS PARA O GRÁFICO
  // ========================================================================
  const labels = meses_alinhados.map(m => {
    if (!m.competencia) return `M${m.mes_numero}`
    const d = new Date(m.competencia + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  })

  // Converter financeiro para milhares de reais (eixo Y esquerdo)
  const finPlan = meses_alinhados.map(m => m.financeiro_planejado ? m.financeiro_planejado / 1000 : null)
  const finReal = meses_alinhados.map(m => m.financeiro_realizado ? m.financeiro_realizado / 1000 : null)

  // Físico já está em % (eixo Y direito)
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

  // ========================================================================
  // STATUS DOS INDICADORES
  // ========================================================================
  const cpiStatus = kpis.cpi >= 1 ? 'ok' : kpis.cpi >= 0.9 ? 'warn' : 'bad'
  const spiStatus = kpis.spi >= 1 ? 'ok' : kpis.spi >= 0.9 ? 'warn' : 'bad'

  return (
    <div>
      {/* KPIs PRINCIPAIS */}
      <div className="kpi-grid">
        <div className="kpi" style={{ borderLeftColor: '#C8860A' }}>
          <div className="kpi-label">Orçamento Total</div>
          <div className="kpi-value">{fmtMoeda(kpis.orcamento_total)}</div>
          <div className="kpi-sub">Planejado para 18 meses</div>
        </div>

        <div className="kpi" style={{ borderLeftColor: '#4D9B6A' }}>
          <div className="kpi-label">Custo Realizado</div>
          <div className="kpi-value">{fmtMoeda(kpis.custo_realizado)}</div>
          <div className="kpi-sub">
            {fmtPerc((kpis.custo_realizado / kpis.orcamento_total) * 100)} do orçamento
          </div>
        </div>

        <div className="kpi" style={{ borderLeftColor: '#5B9BD5' }}>
          <div className="kpi-label">Avanço Físico</div>
          <div className="kpi-value">{fmtPerc(kpis.avanco_fisico_realizado)}</div>
          <div className="kpi-sub">
            Planejado: {fmtPerc(kpis.avanco_fisico_planejado)}
          </div>
        </div>

        <div className="kpi" style={{ borderLeftColor: kpis.saldo_orcamento > 0 ? '#4D9B6A' : '#B03030' }}>
          <div className="kpi-label">Saldo Orçamento</div>
          <div className="kpi-value">{fmtMoeda(kpis.saldo_orcamento)}</div>
          <div className="kpi-sub">
            {fmtPerc((kpis.saldo_orcamento / kpis.orcamento_total) * 100)} restante
          </div>
        </div>
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
