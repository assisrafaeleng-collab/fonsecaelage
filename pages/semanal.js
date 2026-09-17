// pages/semanal.js
// Acompanhamento semanal — mesma linguagem visual do Dashboard mensal:
// classes de styles/globals.css, paleta e formatadores de components/Dashboard.jsx.
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Line } from 'react-chartjs-2'
import { fmtMoeda } from '../lib/constants'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

/* Mesma paleta do Dashboard mensal. Planejado é referência (azul lavado),
   realizado é o número medido (claro + pílula), cor semântica só em saldo. */
const PLAN = '#6e8ba8'
const REAL = '#f2f4f7'
const PILL = { background: 'rgba(255,255,255,0.07)', padding: '3px 8px', borderRadius: 6 }
const VERDE = '#7fb08a'
const VERMELHO = '#c77b74'

const FIN_PLAN = '#5f8a6d'
const FIN_REAL = '#7fb08a'
const FIS_PLAN = '#5e7d99'
const FIS_REAL = '#7fa8d4'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const fmtPerc = (v) => (v == null ? '-' : `${v.toFixed(1)}%`)
const fmtIdx = (v) => (v == null ? '-' : v.toFixed(3).replace('.', ','))
const iso = (s) => (s ? String(s).slice(0, 10) : '')
const dm = (s) => (s ? `${iso(s).slice(8, 10)}/${iso(s).slice(5, 7)}` : '')
const dmy = (s) => (s ? `${iso(s).slice(8, 10)}/${iso(s).slice(5, 7)}/${iso(s).slice(0, 4)}` : '')

const menos6 = (s) => {
  const [y, m, d] = iso(s).split('-').map(Number)
  if (!y) return ''
  return new Date(Date.UTC(y, m - 1, d) - 6 * 86400000).toISOString().slice(0, 10)
}

const rotuloMes = (s) => {
  const [y, m] = iso(s).split('-').map(Number)
  return `${MESES[m - 1]}. de ${y}`
}

export default function Semanal() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [semana, setSemana] = useState(null)
  const [base, setBase] = useState('custo')
  const [series, setSeries] = useState({ finPlan: true, finReal: true, fisPlan: true, fisReal: true })

  useEffect(() => {
    fetch('/api/dashboard-semanal')
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.message || 'Falha ao carregar')
        return j
      })
      .then((j) => {
        setDados(j)
        setSemana(j.semana_atual)
      })
      .catch((e) => setErro(e.message))
  }, [])

  const p = useMemo(
    () => (dados && semana != null ? dados.curva.find((c) => c.semana === semana) : null),
    [dados, semana]
  )

  const grupos = useMemo(() => {
    if (!dados) return []
    const g = []
    dados.curva.forEach((c) => {
      const ini = menos6(c.data_fim)
      const rot = rotuloMes(ini)
      if (!g.length || g[g.length - 1].rotulo !== rot) g.push({ rotulo: rot, semanas: [] })
      g[g.length - 1].semanas.push({ ...c, data_inicio: ini })
    })
    return g
  }, [dados])

  const chart = useMemo(() => {
    if (!dados) return null
    const total = dados.totais.custo_direto
    const bcwpDe = (c) => {
      const a = base === 'hh' ? c.bcwp_a_hh : c.bcwp_a_custo
      return a == null ? null : a + (c.bcwp_b || 0) + (c.bcwp_c || 0)
    }

    const labels = dados.curva.map((c) => `S${String(c.semana).padStart(2, '0')}`)
    const datasets = []

    if (series.finPlan)
      datasets.push({
        label: 'Financeiro Planejado',
        data: dados.curva.map((c) => (c.financeiro_planejado ? c.financeiro_planejado / 1000 : null)),
        borderColor: FIN_PLAN,
        fill: false,
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        pointHoverRadius: 5,
        yAxisID: 'y-financeiro',
        tension: 0.3,
      })

    if (series.finReal)
      datasets.push({
        label: 'Financeiro Realizado',
        data: dados.curva.map((c) => (c.medido ? c.acwp / 1000 : null)),
        borderColor: FIN_REAL,
        backgroundColor: (context) => {
          const { chart } = context
          const { ctx, chartArea } = chart
          if (!chartArea) return 'rgba(127,176,138,0.12)'
          const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, 'rgba(127,176,138,0.18)')
          g.addColorStop(1, 'rgba(127,176,138,0)')
          return g
        },
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 6,
        yAxisID: 'y-financeiro',
        tension: 0.35,
      })

    if (series.fisPlan)
      datasets.push({
        label: 'Físico Planejado',
        data: dados.curva.map((c) => (base === 'hh' ? c.avanco_plan_hh : c.avanco_plan_custo)),
        borderColor: FIS_PLAN,
        fill: false,
        borderWidth: 1.5,
        borderDash: [5, 4],
        pointRadius: 0,
        pointHoverRadius: 5,
        yAxisID: 'y-fisico',
        tension: 0.3,
      })

    if (series.fisReal)
      datasets.push({
        label: 'Físico Realizado',
        data: dados.curva.map((c) => (c.medido ? (base === 'hh' ? c.avanco_real_hh : c.avanco_real_custo) : null)),
        borderColor: FIS_REAL,
        fill: false,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 6,
        yAxisID: 'y-fisico',
        tension: 0.35,
      })

    return { labels, datasets }
  }, [dados, base, series])

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick: (_evt, elements) => {
        if (elements?.length && dados) setSemana(dados.curva[elements[0].index].semana)
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(27,30,36,0.96)',
          titleColor: '#8b919c',
          bodyColor: '#8b919c',
          borderColor: 'rgba(255,255,255,0.14)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y
              if (v == null) return null
              if (ctx.dataset.yAxisID === 'y-financeiro') return `${ctx.dataset.label}: R$ ${v.toFixed(0)}k`
              return `${ctx.dataset.label}: ${v.toFixed(1)}%`
            },
          },
        },
      },
      scales: {
        'y-financeiro': {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Financeiro (R$ mil)', color: '#8b919c', font: { size: 11 } },
          ticks: { color: '#8b919c', font: { size: 10 }, callback: (v) => `R$ ${v}k` },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
        'y-fisico': {
          type: 'linear',
          position: 'right',
          min: 0,
          max: 100,
          title: { display: true, text: 'Físico (%)', color: '#8b919c', font: { size: 11 } },
          ticks: { color: '#8b919c', font: { size: 10 }, callback: (v) => `${v}%` },
          grid: { drawOnChartArea: false },
        },
        x: {
          ticks: { color: '#8b919c', font: { size: 10 }, maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 18 },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
    }),
    [dados]
  )

  if (erro)
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Erro ao carregar dados</h3>
          <p>{erro}</p>
        </div>
      </div>
    )

  if (!dados || !p)
    return (
      <div className="page">
        <div className="loading">Carregando acompanhamento semanal...</div>
      </div>
    )

  const total = dados.totais.custo_direto
  const indiretoTotal = dados.totais.indireto || 0
  const indiretoPlan = p.indireto_planejado || 0
  const indiretoReal = p.indireto_realizado
  const saldoIndireto = indiretoReal == null ? null : indiretoPlan - indiretoReal
  const bcwpA = base === 'hh' ? p.bcwp_a_hh : p.bcwp_a_custo
  const bcwp = bcwpA == null ? null : bcwpA + (p.bcwp_b || 0) + (p.bcwp_c || 0)
  const spi = p.bcws > 0 && bcwp != null ? bcwp / p.bcws : null
  const cpi = p.acwp > 0 && bcwp != null ? bcwp / p.acwp : null
  const saldoDireto = p.bcws - p.acwp
  // O alternador escolhe a régua do avanço físico: hora-homem ou custo.
  const avancoPlan = base === 'hh' ? p.avanco_plan_hh : p.avanco_plan_custo
  const avancoReal = base === 'hh' ? p.avanco_real_hh : p.avanco_real_custo
  const inicioSem = menos6(p.data_fim)
  const primeira = menos6(dados.curva[0].data_fim)
  const ultima = dados.curva[dados.curva.length - 1].data_fim

  const legendas = [
    ['finReal', 'Financeiro realizado', FIN_REAL, 'solid'],
    ['finPlan', 'Financeiro planejado', FIN_PLAN, 'dashed'],
    ['fisReal', 'Físico realizado', FIS_REAL, 'solid'],
    ['fisPlan', 'Físico planejado', FIS_PLAN, 'dashed'],
  ]

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">Av. Coronel José Dias Bicalho, 635 · São José · Belo Horizonte</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">
              Orçamento: {fmtMoeda(dados.totais.obra)} · {dados.curva.length} semanas ·{' '}
              {dmy(primeira)} a {dmy(ultima)} · Até S{String(p.semana).padStart(2, '0')}
            </div>
          </div>

          <div className="sel-wrap">
            <div className="sel-lbl">Semana</div>
            <select className="periodo" value={semana} onChange={(e) => setSemana(parseInt(e.target.value))}>
              {grupos.map((g) => (
                <optgroup key={g.rotulo} label={g.rotulo}>
                  {g.semanas.map((s) => (
                    <option key={s.semana} value={s.semana}>
                      {`S${String(s.semana).padStart(2, '0')} · ${dm(s.data_inicio)} a ${dm(s.data_fim)}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>
            Dashboard mensal
          </button>
          <button className="nav-btn active">Acompanhamento semanal</button>
        </div>
      </div>

      {dados.consistencia.lancamentos_sem_semana > 0 && (
        <div className="alert-strip">
          <div className="alert-main">
            <div className="alert-title">Fora do acumulado</div>
            <div className="alert-text">
              {dados.consistencia.lancamentos_sem_semana} lançamentos sem data nem competência, somando{' '}
              <b>{fmtMoeda(dados.consistencia.valor_sem_semana)}</b>, não entram em nenhuma semana.
            </div>
          </div>
        </div>
      )}

      <div className="hero">
        <div className="hero-block">
          <div className="hero-label">Custo Total da Obra · Planejado</div>
          <div className="hero-row">
            <div>
              <div className="hero-cap">DIRETO</div>
              <div className="hero-num">{fmtMoeda(total)}</div>
            </div>
            <div className="hero-op">+</div>
            <div>
              <div className="hero-cap">INDIRETO</div>
              <div className="hero-num">{fmtMoeda(indiretoTotal)}</div>
            </div>
            <div className="hero-op">=</div>
            <div className="hero-total">
              <div className="hero-cap">TOTAL</div>
              <div className="hero-num">{fmtMoeda(dados.totais.obra)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '4px 0 16px' }}>
        <span style={{ font: "500 12px 'IBM Plex Sans'", color: '#8b919c' }}>Medir avanço físico por</span>
        <button className={base === 'custo' ? 'btn-primary' : 'btn-sm'} onClick={() => setBase('custo')}>
          Custo do orçamento
        </button>
        <button className={base === 'hh' ? 'btn-primary' : 'btn-sm'} onClick={() => setBase('hh')}>
          Horas de mão de obra
        </button>
        <span style={{ font: "500 11px 'IBM Plex Sans'", color: '#8b919c' }}>
          {base === 'custo'
            ? 'é a régua da curva planejada'
            : `base de ${dados.consistencia.hh_total_evm.toLocaleString('pt-BR')} h · só a parcela de produção`}
        </span>
      </div>

      {/* Linha 1 — custo direto, na mesma ordem do dashboard mensal */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <div className="kpi">
          <div className="kpi-label">Custo Direto Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: PLAN }}>
            {fmtMoeda(p.bcws)}
          </div>
          <div className="kpi-sub">Acumulado até S{String(p.semana).padStart(2, '0')}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Custo Direto Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: REAL }}>
            <span style={PILL}>{fmtMoeda(p.acwp)}</span>
          </div>
          <div className="kpi-sub">{fmtPerc((p.acwp / p.bcws) * 100)} do planejado</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Saldo Custo Direto</div>
          <div
            className="kpi-value"
            style={{ fontSize: '20px', lineHeight: '1.2', color: saldoDireto >= 0 ? VERDE : VERMELHO }}
          >
            {fmtMoeda(saldoDireto)}
          </div>
          <div className="kpi-sub">{saldoDireto >= 0 ? 'Economia' : 'Acima'}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Avanço Físico Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtPerc(avancoPlan)}</div>
          <div className="kpi-sub">{base === 'hh' ? 'Hh acumulado ÷ Hh do projeto' : 'Custo acumulado ÷ custo direto'}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Desvio Físico do Projeto</div>
          <div
            className="kpi-value"
            style={{
              fontSize: '20px',
              lineHeight: '1.2',
              color: avancoReal != null && avancoReal >= avancoPlan ? VERDE : VERMELHO,
            }}
          >
            {avancoReal == null ? '—' : `${avancoReal >= avancoPlan ? '+' : ''}${(avancoReal - avancoPlan).toFixed(1)}%`}
          </div>
          <div className="kpi-sub">
            {avancoReal != null && avancoReal >= avancoPlan ? 'Adiantado' : 'Atrasado'} · p.p. do projeto
          </div>
        </div>
      </div>

      {/* Linha 2 — custo indireto, quatro cards como no mensal */}
      <div
        className="kpi-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginTop: '-10px' }}
      >
        <div className="kpi">
          <div className="kpi-label">Custo Indireto Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: PLAN }}>
            {fmtMoeda(indiretoPlan)}
          </div>
          <div className="kpi-sub">Rateio linear · acumulado até S{String(p.semana).padStart(2, '0')}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Custo Indireto Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: REAL }}>
            <span style={PILL}>{indiretoReal == null ? '—' : fmtMoeda(indiretoReal)}</span>
          </div>
          <div className="kpi-sub">
            {indiretoReal == null || indiretoPlan <= 0 ? '—' : `${fmtPerc((indiretoReal / indiretoPlan) * 100)} do planejado`}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Saldo Custo Indireto</div>
          <div
            className="kpi-value"
            style={{
              fontSize: '20px',
              lineHeight: '1.2',
              color: saldoIndireto == null ? REAL : saldoIndireto >= 0 ? VERDE : VERMELHO,
            }}
          >
            {saldoIndireto == null ? '—' : fmtMoeda(saldoIndireto)}
          </div>
          <div className="kpi-sub">{saldoIndireto == null ? '—' : saldoIndireto >= 0 ? 'Economia' : 'Acima'}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Avanço Físico Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>
            {avancoReal == null ? '—' : fmtPerc(avancoReal)}
          </div>
          <div className="kpi-sub">Medido até S{String(dados.ultima_semana_com_avanco).padStart(2, '0')}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Curva S — Acompanhamento Físico-Financeiro</div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', margin: '10px 0 6px', alignItems: 'center' }}>
          {legendas.map(([chave, nome, cor, traco]) => (
            <button
              key={chave}
              onClick={() => setSeries((v) => ({ ...v, [chave]: !v[chave] }))}
              onDoubleClick={() =>
                setSeries({ finPlan: false, finReal: false, fisPlan: false, fisReal: false, [chave]: true })
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                font: "500 11px 'IBM Plex Sans'",
                color: series[chave] ? '#e8eaed' : '#5c6169',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
              title="Clique para ocultar · duplo clique para ver só esta"
            >
              <span
                style={{
                  width: '18px',
                  height: 0,
                  borderTop: `2px ${traco} ${cor}`,
                  opacity: series[chave] ? 1 : 0.3,
                }}
              />
              {nome}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', font: "500 11px 'IBM Plex Sans'", color: '#8b919c' }}>
            Clique na legenda para ocultar · duplo clique isola uma linha · clique no gráfico para ir à semana
          </span>
        </div>
        <div style={{ height: '400px', position: 'relative' }}>{chart && <Line data={chart} options={chartOptions} />}</div>
      </div>

      <div className="card">
        <div className="card-title">Medição do Custo Direto — as três parcelas</div>
        <table>
          <thead>
            <tr>
              <th>Parcela</th>
              <th style={{ textAlign: 'right' }}>Planejado</th>
              <th style={{ textAlign: 'right' }}>Agregado</th>
              <th style={{ textAlign: 'right' }}>Índice</th>
              <th style={{ textAlign: 'right' }}>Peso na obra</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Produção', 'percentual físico por item', p.bcws_a, bcwpA, dados.totais.a],
              ['Locação de equipamentos', 'custo incorrido, limitado ao planejado', p.bcws_b, p.bcwp_b, dados.totais.b],
              ['Funcionários diretos', 'tempo decorrido — não sinaliza atraso', p.bcws_c, p.bcwp_c, dados.totais.c],
            ].map(([nome, criterio, plan, agregado, peso]) => {
              const i = plan > 0 && agregado != null ? agregado / plan : null
              return (
                <tr key={nome}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{nome}</div>
                    <div style={{ color: '#8b919c', fontSize: 11, marginTop: 2 }}>{criterio}</div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: PLAN }}>{fmtMoeda(plan)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    {agregado == null ? '—' : fmtMoeda(agregado)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--mono)',
                      color: i == null ? '#8b919c' : i >= 1 ? VERDE : VERMELHO,
                    }}
                  >
                    {fmtIdx(i)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: '#8b919c' }}>
                    {fmtPerc((peso / total) * 100)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
