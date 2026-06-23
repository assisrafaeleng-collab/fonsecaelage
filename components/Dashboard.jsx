// components/Dashboard.jsx
// ✅ fmtMoeda importada de lib/constants — sem duplicata local

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Line } from 'react-chartjs-2'
import { fmtMoeda } from '../lib/constants'   // ✅ fonte única
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
      <div className="card-title">📊 Avanço Físico por Atividade — Planejado vs Realizado</div>
      <div style={{ overflowX: 'auto' }}>
        {atividades.map((at) => (
          <div key={at.nome} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text1)', fontWeight: 600 }}>{at.nome}</span>
              <span style={{ fontSize: 11, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ color: 'var(--text2)' }}>Plan: {at.planejado.toFixed(1)}%</span>
                <span style={{ color: 'var(--text2)' }}>Real: {at.realizado.toFixed(1)}%</span>
                <span style={{ fontWeight: 700, color: (at.realizado - at.planejado) >= 0 ? '#4D9B6A' : '#B03030' }}>
                  {(at.realizado - at.planejado) >= 0 ? '✅' : '⚠️'} {(at.realizado - at.planejado) >= 0 ? '+' : ''}{(at.realizado - at.planejado).toFixed(1)}%
                </span>
              </span>
            </div>
            <div style={{ position: 'relative', height: 10, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(at.planejado, 100)}%`, background: '#5B9BD5', borderRadius: 5, opacity: 0.5 }} />
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(at.realizado, 100)}%`, background: at.realizado >= at.planejado ? '#4D9B6A' : '#9B59B6', borderRadius: 5 }} />
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text2)' }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#5B9BD5', opacity: 0.5, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>Planejado</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#4D9B6A', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>Realizado (adiantado)</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#9B59B6', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>Realizado (atrasado)</span>
        </div>
      </div>
    </div>
  )
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
      { label: '💰 Financeiro Planejado', data: finPlan, borderColor: '#C8860A', backgroundColor: 'rgba(200, 134, 10, 0.1)', borderWidth: 2, borderDash: [6, 4], pointRadius: 3, pointHoverRadius: 5, pointStyle: 'circle', pointBackgroundColor: 'transparent', yAxisID: 'y-financeiro', tension: 0.3 },
      { label: '💵 Financeiro Realizado', data: finReal, borderColor: '#E91E8C', backgroundColor: 'rgba(233, 30, 140, 0.1)', borderWidth: 3, borderDash: [], pointRadius: 4, pointHoverRadius: 6, pointStyle: 'circle', pointBackgroundColor: '#E91E8C', yAxisID: 'y-financeiro', tension: 0.3 },
      { label: '🔨 Físico Planejado', data: fisPlan, borderColor: '#5B9BD5', backgroundColor: 'rgba(91, 155, 213, 0.1)', borderWidth: 2, borderDash: [6, 4], pointRadius: 3, pointHoverRadius: 5, pointStyle: 'circle', pointBackgroundColor: 'transparent', yAxisID: 'y-fisico', tension: 0.3 },
      { label: '⚙️ Físico Realizado', data: fisReal, borderColor: '#9B59B6', backgroundColor: 'rgba(155, 89, 182, 0.1)', borderWidth: 3, borderDash: [], pointRadius: 4, pointHoverRadius: 6, pointStyle: 'circle', pointBackgroundColor: '#9B59B6', yAxisID: 'y-fisico', tension: 0.3 }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#E8E8E8', font: { size: 11 }, usePointStyle: true, padding: 15 } },
      tooltip: {
        backgroundColor: 'rgba(26, 26, 26, 0.95)', titleColor: '#E8E8E8', bodyColor: '#E8E8E8', borderColor: '#2A2A2A', borderWidth: 1, padding: 12, displayColors: true,
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
      'y-financeiro': { type: 'linear', position: 'left', title: { display: true, text: 'Financeiro (R$ mil)', color: '#A8A8A8', font: { size: 11 } }, ticks: { color: '#A8A8A8', font: { size: 10 }, callback: (v) => `R$ ${v}k` }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
      'y-fisico': { type: 'linear', position: 'right', min: 0, max: 100, title: { display: true, text: 'Físico (%)', color: '#A8A8A8', font: { size: 11 } }, ticks: { color: '#A8A8A8', font: { size: 10 }, callback: (v) => `${v}%` }, grid: { drawOnChartArea: false } },
      x: { ticks: { color: '#A8A8A8', font: { size: 10 }, maxRotation: 45, minRotation: 45 }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
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
  const projecaoCustoFinal = avancoFisicoReal > 0 ? kpis.custo_realizado / (avancoFisicoReal / 100) : 0
  const desvioFinanceiroValor = Math.abs(kpis.custo_realizado - (dadosOrcamento ? dadosOrcamento.custos_diretos + dadosOrcamento.custos_indiretos : 0))

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi kpi-clickable" style={{ borderLeftColor: '#1A5276' }} onClick={() => router.push('/orcamento')}>
          <div className="kpi-label">Custo Total</div>
          <div className="kpi-value">{fmtMoeda(kpis.orcamento_total)}</div>
          <div className="kpi-sub">Planejado para 20 meses · 📊 Ver detalhes</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <div className="kpi" style={{ borderLeftColor: '#C8860A', cursor: 'pointer' }} onClick={() => router.push(`/custos-diretos-planejados?mes=${mesLimite}`)}>
          <div className="kpi-label">Custo Direto Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoDiretoPlano)}</div>
          <div className="kpi-sub">Orçado para 20 meses</div>
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

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginTop: '-10px' }}>
        <div className="kpi" style={{ borderLeftColor: '#C8860A', cursor: 'pointer' }} onClick={() => router.push(`/custos-indiretos-planejados?mes=${mesLimite}`)}>
          <div className="kpi-label">Custo Indireto Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtMoeda(custoIndiretoPlano)}</div>
          <div className="kpi-sub">Orçado para 20 meses</div>
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
        <div className="kpi" style={{ borderLeftColor: '#9B59B6', cursor: 'pointer' }} onClick={() => navRestrita('/avanco-fisico-realizado')}>
          <div className="kpi-label">Avanço Físico Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtPerc(avancoFisicoReal)}</div>
          <div className="kpi-sub">Realizado até agora</div>
        </div>
        <div style={{ visibility: 'hidden' }}></div>
      </div>

      {/* ================================================================
          BLOCO EVM — Earned Value Management
      ================================================================ */}
      <div className="card">
        <div className="card-title">📐 Análise EVM — Valor Agregado</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div className="kpi evm-card" style={{ borderLeftColor: '#5B9BD5' }}>
            <div className="kpi-label">BCWS — Planejado</div>
            <div className="kpi-value" style={{ fontSize: '18px' }}>{fmtMoeda(kpis.bcws)}</div>
            <div className="kpi-sub">Valor que deveria ter sido agregado</div>
            <div className="evm-tooltip"><b>Budgeted Cost of Work Scheduled</b><br/>Quanto valor deveria ter sido agregado até este momento conforme o cronograma planejado.</div>
          </div>
          <div className="kpi evm-card" style={{ borderLeftColor: '#9B59B6' }}>
            <div className="kpi-label">BCWP — Valor Agregado Real</div>
            <div className="kpi-value" style={{ fontSize: '18px' }}>{fmtMoeda(kpis.bcwp)}</div>
            <div className="kpi-sub">% físico realizado × orçamento total</div>
            <div className="evm-tooltip"><b>Budgeted Cost of Work Performed</b><br/>Valor real que foi agregado à obra com base no avanço físico executado.</div>
          </div>
          <div className="kpi evm-card" style={{ borderLeftColor: '#E91E8C' }}>
            <div className="kpi-label">ACWP — Custo Real</div>
            <div className="kpi-value" style={{ fontSize: '18px' }}>{fmtMoeda(kpis.acwp)}</div>
            <div className="kpi-sub">Quanto foi efetivamente gasto</div>
            <div className="evm-tooltip"><b>Actual Cost of Work Performed</b><br/>Quanto foi efetivamente gasto até agora.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div className="kpi evm-card" style={{ borderLeftColor: kpis.cpi >= 1 ? '#4D9B6A' : '#B03030' }}>
            <div className="kpi-label">CPI — Eficiência de Custo</div>
            <div className="kpi-value" style={{ fontSize: '22px', color: kpis.cpi >= 1 ? '#4D9B6A' : '#B03030' }}>{kpis.cpi?.toFixed(2)}</div>
            <div className="kpi-sub">{kpis.cpi >= 1 ? '✅ Abaixo do orçamento' : '⚠️ Acima do orçamento'}</div>
            <div className="evm-tooltip"><b>Cost Performance Index</b><br/>CPI = BCWP ÷ ACWP. Acima de 1,0: economia real.</div>
          </div>
          <div className="kpi evm-card" style={{ borderLeftColor: kpis.spi >= 1 ? '#4D9B6A' : '#B03030' }}>
            <div className="kpi-label">SPI — Eficiência de Prazo</div>
            <div className="kpi-value" style={{ fontSize: '22px', color: kpis.spi >= 1 ? '#4D9B6A' : '#B03030' }}>{kpis.spi?.toFixed(2)}</div>
            <div className="kpi-sub">{kpis.spi >= 1 ? '✅ Adiantado' : '⚠️ Atrasado'}</div>
            <div className="evm-tooltip"><b>Schedule Performance Index</b><br/>SPI = BCWP ÷ BCWS. Acima de 1,0: obra adiantada.</div>
          </div>
          <div className="kpi evm-card" style={{ borderLeftColor: kpis.cv >= 0 ? '#4D9B6A' : '#B03030' }}>
            <div className="kpi-label">CV — Variância de Custo</div>
            <div className="kpi-value" style={{ fontSize: '18px', color: kpis.cv >= 0 ? '#4D9B6A' : '#B03030' }}>{kpis.cv >= 0 ? '+' : ''}{fmtMoeda(kpis.cv)}</div>
            <div className="kpi-sub">BCWP − ACWP {kpis.cv >= 0 ? '(economia real)' : '(acima do produzido)'}</div>
            <div className="evm-tooltip"><b>Cost Variance</b><br/>CV = BCWP − ACWP. Positivo: economia real.</div>
          </div>
          <div className="kpi evm-card" style={{ borderLeftColor: kpis.sv >= 0 ? '#4D9B6A' : '#B03030' }}>
            <div className="kpi-label">SV — Variância de Prazo</div>
            <div className="kpi-value" style={{ fontSize: '18px', color: kpis.sv >= 0 ? '#4D9B6A' : '#B03030' }}>{kpis.sv >= 0 ? '+' : ''}{fmtMoeda(kpis.sv)}</div>
            <div className="kpi-sub">BCWP − BCWS {kpis.sv >= 0 ? '(adiantado em valor)' : '(atrasado em valor)'}</div>
            <div className="evm-tooltip"><b>Schedule Variance</b><br/>SV = BCWP − BCWS. Positivo: adiantado em valor agregado.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="kpi evm-card" style={{ borderLeftColor: kpis.eac <= kpis.orcamento_total ? '#4D9B6A' : '#B03030' }}>
            <div className="kpi-label">EAC — Projeção de Custo Final</div>
            <div className="kpi-value" style={{ fontSize: '18px', color: kpis.eac <= kpis.orcamento_total ? '#4D9B6A' : '#B03030' }}>{fmtMoeda(kpis.eac)}</div>
            <div className="kpi-sub">Orçamento ÷ CPI — custo projetado real</div>
            <div className="evm-tooltip"><b>Estimate at Completion</b><br/>EAC = Orçamento ÷ CPI. Projeção honesta do custo final.</div>
          </div>
          <div className="kpi evm-card" style={{ borderLeftColor: kpis.saldo_real >= 0 ? '#4D9B6A' : '#B03030' }}>
            <div className="kpi-label">Saldo Real Projetado</div>
            <div className="kpi-value" style={{ fontSize: '18px', color: kpis.saldo_real >= 0 ? '#4D9B6A' : '#B03030' }}>{kpis.saldo_real >= 0 ? '+' : ''}{fmtMoeda(kpis.saldo_real)}</div>
            <div className="kpi-sub">{kpis.saldo_real >= 0 ? '✅ Economia projetada real' : '⚠️ Estouro projetado'}</div>
            <div className="evm-tooltip"><b>Saldo Real Projetado</b><br/>Orçamento Total − EAC.</div>
          </div>
          <div className="kpi evm-card" style={{ borderLeftColor: '#C8860A' }}>
            <div className="kpi-label">Saldo Aparente</div>
            <div className="kpi-value" style={{ fontSize: '18px', color: '#C8860A' }}>{fmtMoeda(kpis.saldo_orcamento)}</div>
            <div className="kpi-sub">⚠️ Pode incluir serviços não executados</div>
            <div className="evm-tooltip"><b>Saldo Aparente</b><br/>Orçamento − Custo Realizado. Pode ser enganoso.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📊 Curva S — Acompanhamento Físico-Financeiro</div>
        <div style={{ height: '400px', position: 'relative' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <ComparativoFisico mesLimite={mesLimite} />

      <div className="card">
        <div className="card-title">💰 Projeção Financeira e Prazo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Projeção de Custo Final</div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>{fmtMoeda(projecaoCustoFinal)}</div>
            <div className="kpi-sub">
              {projecaoCustoFinal > kpis.orcamento_total
                ? <span style={{ color: '#B03030' }}>⚠️ {fmtMoeda(projecaoCustoFinal - kpis.orcamento_total)} acima</span>
                : <span style={{ color: '#4D9B6A' }}>✅ {fmtMoeda(kpis.orcamento_total - projecaoCustoFinal)} abaixo</span>
              }
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Desvio Financeiro Acumulado</div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px', color: kpis.desvio_financeiro <= 0 ? '#4D9B6A' : '#B03030' }}>
              {fmtMoeda(desvioFinanceiroValor)}
            </div>
            <div className="kpi-sub">{kpis.desvio_financeiro <= 0 ? 'Economia' : 'Acima do planejado'} ({fmtPerc(Math.abs(kpis.desvio_financeiro_perc))})</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Previsão de Conclusão</div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>
              {kpis.projecao_data_conclusao
                ? new Date(kpis.projecao_data_conclusao + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                : '-'}
            </div>
            <div className="kpi-sub">
              {kpis.desvio_prazo_dias > 0
                ? <span style={{ color: '#B03030' }}>⚠️ {kpis.desvio_prazo_dias} dias de atraso</span>
                : kpis.desvio_prazo_dias < 0
                  ? <span style={{ color: '#4D9B6A' }}>✅ {Math.abs(kpis.desvio_prazo_dias)} dias adiantado</span>
                  : <span style={{ color: '#4D9B6A' }}>✅ No prazo</span>
              }
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Velocidade Atual</div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>{fmtPerc(kpis.velocidade_atual)}/mês</div>
            <div className="kpi-sub">{kpis.meses_restantes} meses para conclusão</div>
          </div>
        </div>
      </div>
    </div>
  )
}
