// components/Dashboard.jsx
// fmtMoeda importada de lib/constants — sem duplicata local
import { FisicoPorAtividade, Heatmap } from './PaineisAnalise'
import DiarioOcorrencias from './DiarioOcorrencias'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Line } from 'react-chartjs-2'
import { fmtMoeda } from '../lib/constants'   // fonte única
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const fmtPerc = (val) => {
  if (val == null) return '-'
  return `${val.toFixed(1)}%`
}

function ComparativoFisico({ mesLimite }) {
  const [atividades, setAtividades] = useState(null)

  useEffect(() => {
    fetch(`/api/avanco-fisico-comparativo?mes=${mesLimite}`)
      .then(r => r.json())
      .then(d => setAtividades(d.atividades))
      .catch(() => setAtividades([]))
  }, [mesLimite])

  if (!atividades || atividades.length === 0) return null

  return (
    <div className="card">
      <div className="card-title">Avanço Físico por Atividade — Planejado vs Realizado</div>
      <div style={{ overflowX: 'auto' }}>
        {atividades.map((at) => (
          <div key={at.nome} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text1)', fontWeight: 600 }}>{at.nome}</span>
              <span style={{ fontSize: 11, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ color: 'var(--text2)' }}>Plan: {at.planejado.toFixed(1)}%</span>
                <span style={{ color: 'var(--text2)' }}>Real: {at.realizado.toFixed(1)}%</span>
                <span style={{ fontWeight: 700, color: (at.realizado - at.planejado) >= 0 ? '#3f9e6c' : '#d6453c' }}>
                  {(at.realizado - at.planejado) >= 0 ? 'Adiantado' : 'Atrasado'} {(at.realizado - at.planejado) >= 0 ? '+' : ''}{(at.realizado - at.planejado).toFixed(1)}%
                </span>
              </span>
            </div>
            {(() => {
              const r = Math.min(Math.max(at.realizado, 0), 100)
              const p = Math.min(Math.max(at.planejado, 0), 100)
              const atraso = Math.max(0, p - r)
              const restante = Math.max(0, 100 - Math.max(r, p))
              return (
                <div style={{ position: 'relative', height: 10, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ height: '100%', width: `${r}%`, background: '#3f9e6c' }} title={`Executado: ${r.toFixed(1)}%`} />
                  {atraso > 0 && (
                    <div style={{ height: '100%', width: `${atraso}%`, background: '#d6453c' }} title={`Atraso: ${atraso.toFixed(1)}%`} />
                  )}
                  <div style={{ height: '100%', width: `${restante}%`, background: '#6f86c9', opacity: 0.35 }} title={`A executar: ${restante.toFixed(1)}%`} />
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    </div>
  )
}


  // CSS para tooltips dos cards de projecao
  if (typeof window !== 'undefined' && !document.getElementById('proj-tooltip-style')) {
    const style = document.createElement('style')
    style.id = 'proj-tooltip-style'
    style.textContent = '.proj-tooltip-wrap { position: relative; } .proj-tooltip-box { display: none; } .proj-tooltip-wrap:hover .proj-tooltip-box { display: block !important; }'
    document.head.appendChild(style)
  }

export default function Dashboard({ updates, selectedId, onSelectId, mesLimite = 20, onNavRestrita }) {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [dadosOrcamento, setDadosOrcamento] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  function navRestrita(destino) {
    if (onNavRestrita) {
      onNavRestrita(destino)
    } else {
      router.push(destino)
    }
  }

  useEffect(() => {
    async function fetchDados() {
      try {
        setLoading(true)
        const [res1, res2] = await Promise.all([
          fetch(`/api/dashboard-integrado?mes=${mesLimite}`),
          fetch(`/api/orcamento-detalhado?mes=${mesLimite}`),
        ])
        if (!res1.ok) throw new Error('Erro ao carregar dados integrados')
        if (!res2.ok) throw new Error('Erro ao carregar orçamento')
        const [data1, data2] = await Promise.all([res1.json(), res2.json()])
        setDados(data1)
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

  if (loading) return <div className="loading">Carregando dados integrados...</div>
  if (erro) return <div className="empty-state"><h3>Erro ao carregar dados</h3><p>{erro}</p></div>
  if (!dados) return <div className="empty-state"><h3>Nenhum dado disponível</h3></div>

  const { kpis, meses_alinhados } = dados

  const labels = meses_alinhados.map(m => {
    if (!m.competencia) return `M${m.mes_numero}`
    const d = new Date(m.competencia + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  })

  const finPlan = meses_alinhados.map(m => m.financeiro_planejado ? m.financeiro_planejado / 1000 : null)
  const fisPlan = meses_alinhados.map(m => m.fisico_planejado)

  const ultimoMesFisReal = meses_alinhados.reduce((last, m, i) =>
    (m.fisico_realizado != null && m.fisico_realizado > 0) ? i : last, -1)
  const ultimoMesFinReal = meses_alinhados.reduce((last, m, i) =>
    (m.financeiro_realizado != null && m.financeiro_realizado > 0) ? i : last, -1)

  const fisReal = meses_alinhados.map((m, i) =>
    i <= ultimoMesFisReal ? m.fisico_realizado : null)
  const finReal = meses_alinhados.map((m, i) =>
    i <= ultimoMesFinReal ? (m.financeiro_realizado ? m.financeiro_realizado / 1000 : null) : null)

  const chartData = {
    labels,
    datasets: [
      { label: 'Financeiro Planejado', data: finPlan, borderColor: '#9a8a5f', backgroundColor: 'rgba(154, 138, 95, 0.1)', fill: false, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 3, pointHoverRadius: 5, pointStyle: 'circle', pointBackgroundColor: 'transparent', yAxisID: 'y-financeiro', tension: 0.3 },
      {
        label: 'Financeiro Realizado',
        data: finReal,
        borderColor: '#3f9e6c',
        backgroundColor: (context) => {
          const { chart } = context
          const { ctx, chartArea } = chart
          if (!chartArea) return 'rgba(63,158,108,0.12)'
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, 'rgba(63,158,108,0.18)')
          gradient.addColorStop(1, 'rgba(63,158,108,0)')
          return gradient
        },
        fill: true,
        borderWidth: 2.5,
        borderDash: [],
        pointRadius: 4,
        pointHoverRadius: 6,
        pointStyle: 'circle',
        pointBackgroundColor: '#3f9e6c',
        yAxisID: 'y-financeiro',
        tension: 0.35
      },
      { label: 'Físico Planejado', data: fisPlan, borderColor: '#6f86c9', backgroundColor: 'rgba(111, 134, 201, 0.1)', fill: false, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 3, pointHoverRadius: 5, pointStyle: 'circle', pointBackgroundColor: 'transparent', yAxisID: 'y-fisico', tension: 0.3 },
      { label: 'Físico Realizado', data: fisReal, borderColor: '#4a8fe0', backgroundColor: 'rgba(74, 143, 224, 0.1)', fill: false, borderWidth: 2.5, borderDash: [], pointRadius: 4, pointHoverRadius: 6, pointStyle: 'circle', pointBackgroundColor: '#4a8fe0', yAxisID: 'y-fisico', tension: 0.35 }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false, position: 'top', labels: { color: '#9a9aa6', font: { size: 11 }, usePointStyle: true, padding: 15 } },
      tooltip: {
        backgroundColor: 'rgba(20,20,24,0.96)', titleColor: '#9a9aa6', bodyColor: '#9a9aa6', borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, padding: 12, displayColors: true,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            if (value == null) return null
            if (context.dataset.yAxisID === 'y-financeiro') return `${label}: R$ ${value.toFixed(0)}k`
            return `${label}: ${value.toFixed(1)}%`
          }
        }
      }
    },
    scales: {
      'y-financeiro': { type: 'linear', position: 'left', title: { display: true, text: 'Financeiro (R$ mil)', color: '#9a9aa6', font: { size: 11 } }, ticks: { color: '#9a9aa6', font: { size: 10 }, callback: (v) => `R$ ${v}k` }, grid: { color: 'rgba(255,255,255,0.06)' } },
      'y-fisico': { type: 'linear', position: 'right', min: 0, max: 100, title: { display: true, text: 'Físico (%)', color: '#9a9aa6', font: { size: 11 } }, ticks: { color: '#9a9aa6', font: { size: 10 }, callback: (v) => `${v}%` }, grid: { drawOnChartArea: false } },
      x: { ticks: { color: '#9a9aa6', font: { size: 10 }, maxRotation: 45, minRotation: 45 }, grid: { color: 'rgba(255,255,255,0.06)' } }
    }
  }

  const custoDiretoPlano = dadosOrcamento ? dadosOrcamento.custos_diretos : 0
  const custoIndiretoPlano = dadosOrcamento ? dadosOrcamento.custos_indiretos : 0
  const avancoFisicoPlano = kpis.avanco_fisico_planejado || 0
  const avancoFisicoReal = kpis.avanco_fisico_realizado || 0
  const custoDiretoReal = kpis.custo_realizado - (kpis.custo_indireto_realizado || 0)
  const custoIndiretoReal = kpis.custo_indireto_realizado || 0
  const saldoCustoDireto = custoDiretoPlano - custoDiretoReal
  const saldoCustoIndireto = custoIndiretoPlano - custoIndiretoReal
  const projecaoCustoFinal = kpis.eac_total || kpis.eac || 0
  const desvioFinanceiroValor = Math.abs((kpis.acwp_producao || 0) - (dadosOrcamento ? dadosOrcamento.custos_diretos : 0))

  return (
    <div>
      <div className="hero">
        <div className="hero-block">
          <div className="hero-label">Custo Total da Obra · Planejado</div>
          <div className="hero-row">
            <div>
              <div className="hero-cap">DIRETO</div>
              <div className="hero-num">{fmtMoeda(kpis.custo_direto_total || 0)}</div>
            </div>
            <div className="hero-op">+</div>
            <div>
              <div className="hero-cap">INDIRETO</div>
              <div className="hero-num">{fmtMoeda(kpis.custo_indireto_total || 0)}</div>
            </div>
            <div className="hero-op">=</div>
            <div className="hero-total">
              <div className="hero-cap">TOTAL</div>
              <div className="hero-num">
                {fmtMoeda((kpis.custo_direto_total || 0) + (kpis.custo_indireto_total || 0))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push(`/custos-diretos-planejados?mes=${mesLimite}`)}>
          <div className="kpi-label">Custo Direto Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoDiretoPlano)}</div>
          <div className="kpi-sub">{mesLimite === 20 ? "Orçado para 20 meses" : `Acumulado até M${mesLimite}`}</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push('/custos-diretos-realizados-lista')}>
          <div className="kpi-label">Custo Direto Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoDiretoReal)}</div>
          <div className="kpi-sub">{fmtPerc((custoDiretoReal / custoDiretoPlano) * 100)} do planejado</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Saldo Custo Direto</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: saldoCustoDireto >= 0 ? '#3f9e6c' : '#d6453c' }}>{fmtMoeda(saldoCustoDireto)}</div>
          <div className="kpi-sub">{saldoCustoDireto >= 0 ? 'Economia' : 'Acima'}</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push(`/avanco-fisico-planejado?mes=${mesLimite}`)}>
          <div className="kpi-label">Avanço Físico Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtPerc(avancoFisicoPlano)}</div>
          <div className="kpi-sub">Base: projeto acumulado</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Desvio Físico do Projeto</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: avancoFisicoReal >= avancoFisicoPlano ? '#3f9e6c' : '#d6453c' }}>
            {avancoFisicoReal >= avancoFisicoPlano ? '+' : ''}{fmtPerc(avancoFisicoReal - avancoFisicoPlano)}
          </div>
          <div className="kpi-sub">{avancoFisicoReal >= avancoFisicoPlano ? 'Adiantado' : 'Atrasado'} · p.p. do projeto</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginTop: '-10px' }}>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push(`/custos-indiretos-planejados?mes=${mesLimite}`)}>
          <div className="kpi-label">Custo Indireto Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoIndiretoPlano)}</div>
          <div className="kpi-sub">{mesLimite === 20 ? "Orçado para 20 meses" : `Acumulado até M${mesLimite}`}</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push('/custos-indiretos-realizados-lista')}>
          <div className="kpi-label">Custo Indireto Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoIndiretoReal)}</div>
          <div className="kpi-sub">{custoIndiretoPlano > 0 ? fmtPerc((custoIndiretoReal / custoIndiretoPlano) * 100) : '0%'} do planejado</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Saldo Custo Indireto</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: saldoCustoIndireto >= 0 ? '#3f9e6c' : '#d6453c' }}>{fmtMoeda(saldoCustoIndireto)}</div>
          <div className="kpi-sub">{saldoCustoIndireto >= 0 ? 'Economia' : 'Acima'}</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => navRestrita('/avanco-fisico-realizado')}>
          <div className="kpi-label">Avanço Físico Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtPerc(avancoFisicoReal)}</div>
          <div className="kpi-sub">Realizado até agora</div>
        </div>
        <div style={{ visibility: 'hidden' }}></div>
      </div>

      <div className="card">
        <div className="card-title">Curva S — Acompanhamento Físico-Financeiro</div>
        <div style={{ display:'flex', gap:'20px', flexWrap:'wrap', margin:'10px 0 6px' }}>
          <span style={{ display:'flex', alignItems:'center', gap:'7px', font:"500 11px 'IBM Plex Sans'", color:'#9a9aa6' }}>
            <span style={{ width:'18px', height:0, borderTop:'2px solid #3f9e6c' }}></span>Financeiro realizado</span>
          <span style={{ display:'flex', alignItems:'center', gap:'7px', font:"500 11px 'IBM Plex Sans'", color:'#9a9aa6' }}>
            <span style={{ width:'18px', height:0, borderTop:'2px dashed #9a8a5f' }}></span>Financeiro planejado</span>
          <span style={{ display:'flex', alignItems:'center', gap:'7px', font:"500 11px 'IBM Plex Sans'", color:'#9a9aa6' }}>
            <span style={{ width:'18px', height:0, borderTop:'2px solid #4a8fe0' }}></span>Físico realizado</span>
          <span style={{ display:'flex', alignItems:'center', gap:'7px', font:"500 11px 'IBM Plex Sans'", color:'#9a9aa6' }}>
            <span style={{ width:'18px', height:0, borderTop:'2px dashed #6f86c9' }}></span>Físico planejado</span>
        </div>
        <div style={{ height: '400px', position: 'relative' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Mapa de Avanço por Pavimento</div>
        <Heatmap mes={mesLimite} />
      </div>

      <div className="card">
        <div className="card-title">Físico por Atividade — Desvio Relativo da Atividade</div>
        <div style={{ fontSize: '11px', color: '#a09a90', margin: '8px 0 12px', lineHeight: 1.5 }}>
          Esta métrica mede o desvio da própria meta de cada atividade. Ela não é somável ao desvio absoluto do projeto.
        </div>
        <FisicoPorAtividade mes={mesLimite} />
      </div>

      <DiarioOcorrencias />
    </div>
  )
}
