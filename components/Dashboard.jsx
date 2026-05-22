// components/Dashboard.jsx
// 
// Dashboard com 1 KPI + 8 cards comparativo direto/indireto

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

// ── Componente: Gráfico Comparativo Físico por Atividade ──────
function ComparativoFisico({ mesLimite }) {
  const [atividades, setAtividades] = useState(null)

  useEffect(() => {
    fetch(`/api/avanco-fisico-comparativo?mes=${mesLimite}`)
      .then(r => r.json())
      .then(d => setAtividades(d.atividades))
      .catch(() => setAtividades([]))
  }, [mesLimite])

  if (!atividades) return null
  if (atividades.length === 0) return null

  return (
    <div className="card">
      <div className="card-title">📊 Avanço Físico por Atividade — Planejado vs Realizado</div>
      <div style={{ overflowX: 'auto' }}>
        {atividades.map((at) => (
          <div key={at.nome} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text1)', fontWeight: 600 }}>{at.nome}</span>
              <span style={{ color: 'var(--text2)', fontSize: 11 }}>
                Plan: {at.planejado.toFixed(1)}% · Real: {at.realizado.toFixed(1)}%
              </span>
            </div>
            <div style={{ position: 'relative', height: 10, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${Math.min(at.planejado, 100)}%`,
                background: '#5B9BD5',
                borderRadius: 5,
                opacity: 0.5
              }} />
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${Math.min(at.realizado, 100)}%`,
                background: at.realizado >= at.planejado ? '#4D9B6A' : '#9B59B6',
                borderRadius: 5
              }} />
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text2)' }}>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#5B9BD5', opacity: 0.5, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>
            Planejado
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#4D9B6A', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>
            Realizado (adiantado)
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 12, height: 12, background: '#9B59B6', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>
            Realizado (atrasado)
          </span>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ updates, selectedId, onSelectId, mesLimite = 18 }) {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [dadosOrcamento, setDadosOrcamento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        
        const res1 = await fetch(`/api/dashboard-integrado?mes=${mesLimite}`)
        if (!res1.ok) throw new Error('Erro ao carregar dados integrados')
        const data1 = await res1.json()
        setDados(data1)

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
        borderDash: [6, 4],
        pointRadius: 3,
        pointHoverRadius: 5,
        pointStyle: 'circle',
        pointBackgroundColor: 'transparent',
        yAxisID: 'y-financeiro',
        tension: 0.3
      },
      {
        label: '💵 Financeiro Realizado',
        data: finReal,
        borderColor: '#E91E8C',
        backgroundColor: 'rgba(233, 30, 140, 0.1)',
        borderWidth: 3,
        borderDash: [],
        pointRadius: 4,
        pointHoverRadius: 6,
        pointStyle: 'circle',
        pointBackgroundColor: '#E91E8C',
        yAxisID: 'y-financeiro',
        tension: 0.3
      },
      {
        label: '🔨 Físico Planejado',
        data: fisPlan,
        borderColor: '#5B9BD5',
        backgroundColor: 'rgba(91, 155, 213, 0.1)',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 3,
        pointHoverRadius: 5,
        pointStyle: 'circle',
        pointBackgroundColor: 'transparent',
        yAxisID: 'y-fisico',
        tension: 0.3
      },
      {
        label: '⚙️ Físico Realizado',
        data: fisReal,
        borderColor: '#9B59B6',
        backgroundColor: 'rgba(155, 89, 182, 0.1)',
        borderWidth: 3,
        borderDash: [],
        pointRadius: 4,
        pointHoverRadius: 6,
        pointStyle: 'circle',
        pointBackgroundColor: '#9B59B6',
        yAxisID: 'y-fisico',
        tension: 0.3
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: '#E8E8E8', font: { size: 11 }, usePointStyle: true, padding: 15 }
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
        title: { display: true, text: 'Financeiro (R$ mil)', color: '#A8A8A8', font: { size: 11 } },
        ticks: { color: '#A8A8A8', font: { size: 10 }, callback: (v) => `R$ ${v}k` },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      'y-fisico': {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 100,
        title: { display: true, text: 'Físico (%)', color: '#A8A8A8', font: { size: 11 } },
        ticks: { color: '#A8A8A8', font: { size: 10 }, callback: (v) => `${v}%` },
        grid: { drawOnChartArea: false }
      },
      x: {
        ticks: { color: '#A8A8A8', font: { size: 10 }, maxRotation: 45, minRotation: 45 },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      }
    }
  }

  const cpiStatus = kpis.cpi >= 1 ? 'ok' : kpis.cpi >= 0.9 ? 'warn' : 'bad'
  const spiStatus = kpis.spi >= 1 ? 'ok' : kpis.spi >= 0.9 ? 'warn' : 'bad'

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
      {/* KPI ORÇAMENTO TOTAL */}
      <div className="kpi-grid">
        <div 
          className="kpi kpi-clickable" 
          style={{ borderLeftColor: '#1A5276' }}
          onClick={() => router.push('/orcamento')}
        >
          <div className="kpi-label">Custo Total</div>
          <div className="kpi-value">{fmtMoeda(kpis.orcamento_total)}</div>
          <div className="kpi-sub">Planejado para 18 meses · 📊 Ver detalhes</div>
        </div>
      </div>

      {/* LINHA 1 */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <div className="kpi" style={{ borderLeftColor: '#C8860A', cursor: 'pointer' }} onClick={() => router.push(`/custos-diretos-planejados?mes=${mesLimite}`)}>
          <div className="kpi-label">Custo Direto Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoDiretoPlano)}</div>
          <div className="kpi-sub">Orçado para 18 meses</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: '#E91E8C', cursor: 'pointer' }} onClick={() => router.push('/custos-diretos-realizados-lista')}>
          <div className="kpi-label">Custo Direto Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoDiretoReal)}</div>
          <div className="kpi-sub">{fmtPerc((custoDiretoReal / custoDiretoPlano) * 100)} do planejado</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: saldoCustoDireto >= 0 ? '#4D9B6A' : '#B03030' }}>
          <div className="kpi-label">Saldo Custo Direto</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(saldoCustoDireto)}</div>
          <div className="kpi-sub">{saldoCustoDireto >= 0 ? '✓ Economia' : '⚠️ Acima'}</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: '#5B9BD5', cursor: 'pointer' }} onClick={() => router.push(`/avanco-fisico-planejado?mes=${mesLimite}`)}>
          <div className="kpi-label">Avanço Físico Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtPerc(avancoFisicoPlano)}</div>
          <div className="kpi-sub">Conforme cronograma</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: avancoFisicoReal >= avancoFisicoPlano ? '#4D9B6A' : '#B03030' }}>
          <div className="kpi-label">Desvio Físico</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: avancoFisicoReal >= avancoFisicoPlano ? '#4D9B6A' : '#B03030' }}>
            {avancoFisicoReal >= avancoFisicoPlano ? '+' : ''}{fmtPerc(avancoFisicoReal - avancoFisicoPlano)}
          </div>
          <div className="kpi-sub">{avancoFisicoReal >= avancoFisicoPlano ? 'Adiantado' : 'Atrasado'}</div>
        </div>
      </div>

      {/* LINHA 2 */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginTop: '-10px' }}>
        <div className="kpi" style={{ borderLeftColor: '#C8860A', cursor: 'pointer' }} onClick={() => router.push(`/custos-indiretos-planejados?mes=${mesLimite}`)}>
          <div className="kpi-label">Custo Indireto Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoIndiretoPlano)}</div>
          <div className="kpi-sub">Orçado para 18 meses</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: '#E91E8C', cursor: 'pointer' }} onClick={() => router.push('/custos-indiretos-realizados-lista')}>
          <div className="kpi-label">Custo Indireto Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoIndiretoReal)}</div>
          <div className="kpi-sub">{custoIndiretoPlano > 0 ? fmtPerc((custoIndiretoReal / custoIndiretoPlano) * 100) : '0%'} do planejado</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: saldoCustoIndireto >= 0 ? '#4D9B6A' : '#B03030' }}>
          <div className="kpi-label">Saldo Custo Indireto</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(saldoCustoIndireto)}</div>
          <div className="kpi-sub">{saldoCustoIndireto >= 0 ? '✓ Economia' : '⚠️ Acima'}</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: '#9B59B6', cursor: 'pointer' }} onClick={() => router.push('/avanco-fisico-realizado')}>
          <div className="kpi-label">Avanço Físico Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtPerc(avancoFisicoReal)}</div>
          <div className="kpi-sub">Realizado até agora</div>
        </div>
        <div style={{ visibility: 'hidden' }}></div>
      </div>

      {/* GRÁFICO CURVA S */}
      <div className="card">
        <div className="card-title">📊 Curva S — Acompanhamento Físico-Financeiro</div>
        <div style={{ height: '400px', position: 'relative' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* GRÁFICO COMPARATIVO POR ATIVIDADE */}
      <ComparativoFisico mesLimite={mesLimite} />

      {/* INDICADORES DE DESEMPENHO */}
      <div className="two-col">
        <div className="card">
          <div className="card-title">📈 Indicadores de Desempenho</div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>CPI (Cost Performance Index)</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>{kpis.cpi.toFixed(2)}</div>
            <div className={`badge badge-${cpiStatus}`}>{kpis.cpi >= 1 ? 'Dentro do orçamento' : 'Acima do orçamento'}</div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>SPI (Schedule Performance Index)</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>{kpis.spi.toFixed(2)}</div>
            <div className={`badge badge-${spiStatus}`}>{kpis.spi >= 1 ? 'No prazo' : 'Atrasado'}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Desvio Físico</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: kpis.desvio_fisico >= 0 ? '#4D9B6A' : '#B03030' }}>
              {kpis.desvio_fisico >= 0 ? '+' : ''}{fmtPerc(kpis.desvio_fisico)}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">💰 Projeção Financeira</div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Projeção de Custo Final</div>
            <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>{fmtMoeda(kpis.projecao_custo_final)}</div>
            <div className="kpi-sub">
              {kpis.projecao_custo_final > kpis.orcamento_total ? (
                <span style={{ color: '#B03030' }}>⚠️ {fmtMoeda(kpis.projecao_custo_final - kpis.orcamento_total)} acima do orçado</span>
              ) : (
                <span style={{ color: '#4D9B6A' }}>✓ Dentro do orçamento</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Desvio Financeiro</div>
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
