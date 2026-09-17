// pages/semanal.js
// Acompanhamento semanal — mesma linguagem visual do Dashboard mensal:
// classes de styles/globals.css, paleta e formatadores de components/Dashboard.jsx.
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Line } from 'react-chartjs-2'
import { fmtMoeda } from '../lib/constants'
import DiarioOcorrencias from '../components/DiarioOcorrencias'
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
  const [abrirGrupos, setAbrirGrupos] = useState(false)
  const [abrirIndiretos, setAbrirIndiretos] = useState(false)
  const [abrirAvanco, setAbrirAvanco] = useState(false)
  const [avancoGrupos, setAvancoGrupos] = useState(null)
  const [mapa, setMapa] = useState(null)
  const [avancoAberto, setAvancoAberto] = useState(null)
  const [itemAberto, setItemAberto] = useState(null)
  const [autorizado, setAutorizado] = useState(false)
  const [pedindoSenha, setPedindoSenha] = useState(null)
  const [senha, setSenha] = useState('')
  const [senhaErrada, setSenhaErrada] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ data: '', incremento: '', acumulado: '' })
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  const [recarregar, setRecarregar] = useState(0)
  const [indiretos, setIndiretos] = useState(null)
  const [grupoAberto, setGrupoAberto] = useState(null)
  const [abertura, setAbertura] = useState(null)
  const [somas, setSomas] = useState(null)
  const [carregandoGrupos, setCarregandoGrupos] = useState(false)
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
        setAbertura(j.grupos || null)
        setIndiretos(j.indiretos || null)
        setAvancoGrupos(j.avanco_grupos || null)
        setMapa(j.mapa_avanco || null)
        setSomas(j.consistencia || null)
      })
      .catch((e) => setErro(e.message))
  }, [])

  // A abertura por grupo e calculada no servidor para UMA semana. Trocar de
  // semana no seletor exige pedir de novo — a curva ate o fim ja esta em
  // memoria, mas o acumulado por grupo nao.
  useEffect(() => {
    if (!dados || semana == null) return
    if (semana === dados.semana_atual && abertura) return
    let cancelado = false
    setCarregandoGrupos(true)
    fetch(`/api/dashboard-semanal?semana=${semana}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelado) return
        setAbertura(j.grupos || null)
        setIndiretos(j.indiretos || null)
        setAvancoGrupos(j.avanco_grupos || null)
        setMapa(j.mapa_avanco || null)
        setSomas(j.consistencia || null)
      })
      .catch(() => {
        if (!cancelado) setAbertura(null)
      })
      .finally(() => {
        if (!cancelado) setCarregandoGrupos(false)
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semana, dados, recarregar])

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('autenticado') === 'true') {
      setAutorizado(true)
    }
  }, [])

  const exigirSenha = (acao) => {
    if (autorizado) return acao()
    setPedindoSenha(() => acao)
  }

  const salvarMedicao = async (cod_eap, id) => {
    setSalvando(true)
    setErroSalvar(null)
    try {
      const r = await fetch('/api/avanco-lancamento', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, codigo_eap: cod_eap, data: form.data, percentual: form.acumulado }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message || j.error || 'Falha ao salvar')
      setEditando(null)
      setForm({ data: '', incremento: '', acumulado: '' })
      setRecarregar((v) => v + 1)
    } catch (e) {
      setErroSalvar(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const excluirMedicao = async (id) => {
    setSalvando(true)
    setErroSalvar(null)
    try {
      const r = await fetch('/api/avanco-lancamento', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.message || j.error || 'Falha ao excluir')
      setRecarregar((v) => v + 1)
    } catch (e) {
      setErroSalvar(e.message)
    } finally {
      setSalvando(false)
    }
  }

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
      {pedindoSenha && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div className="form-section" style={{ width: 320 }}>
            <div className="form-section-title">Área restrita</div>
            <p style={{ fontSize: 12, color: '#8b919c', marginBottom: 14 }}>
              Digite a senha para alterar medições de avanço.
            </p>
            <input
              type="password"
              autoFocus
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value)
                setSenhaErrada(false)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (senha === 'fonseca2025') {
                  sessionStorage.setItem('autenticado', 'true')
                  setAutorizado(true)
                  const acao = pedindoSenha
                  setPedindoSenha(null)
                  setSenha('')
                  acao()
                } else {
                  setSenhaErrada(true)
                  setSenha('')
                }
              }}
              placeholder="Senha"
            />
            {senhaErrada && (
              <div style={{ color: 'var(--red-tx)', fontSize: 12, marginTop: 8 }}>Senha incorreta.</div>
            )}
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button
                className="btn-primary"
                onClick={() => {
                  if (senha === 'fonseca2025') {
                    sessionStorage.setItem('autenticado', 'true')
                    setAutorizado(true)
                    const acao = pedindoSenha
                    setPedindoSenha(null)
                    setSenha('')
                    acao()
                  } else {
                    setSenhaErrada(true)
                    setSenha('')
                  }
                }}
              >
                Entrar
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setPedindoSenha(null)
                  setSenha('')
                  setSenhaErrada(false)
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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

        <div
          className="kpi kpi-clickable"
          onClick={() => setAbrirGrupos((v) => !v)}
          title="Ver abertura por grupo"
        >
          <div className="kpi-label">Custo Direto Realizado {abrirGrupos ? '▴' : '▾'}</div>
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
          <div className="kpi-sub">{base === 'hh' ? 'Hh acumulado ÷ Hh do projeto' : 'Custo da produção ÷ custo da produção'}</div>
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

        <div
          className="kpi kpi-clickable"
          onClick={() => setAbrirIndiretos((v) => !v)}
          title="Ver abertura por categoria"
        >
          <div className="kpi-label">Custo Indireto Realizado {abrirIndiretos ? '▴' : '▾'}</div>
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

        <div
          className="kpi kpi-clickable"
          onClick={() => setAbrirAvanco((v) => !v)}
          title="Ver avanço por grupo"
        >
          <div className="kpi-label">Avanço Físico Realizado {abrirAvanco ? '▴' : '▾'}</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>
            {avancoReal == null ? '—' : fmtPerc(avancoReal)}
          </div>
          <div className="kpi-sub">Medido até S{String(dados.ultima_semana_com_avanco).padStart(2, '0')}</div>
        </div>
      </div>

      {abrirGrupos && (
        <div className="card">
          <div className="card-title">
            Custo direto por grupo — acumulado até S{String(p.semana).padStart(2, '0')}
          </div>
          {carregandoGrupos && <div className="loading">Somando os lançamentos da semana...</div>}
          {(abertura || []).map((g) => {
            const desvio = g.planejado > 0 ? ((g.realizado - g.planejado) / g.planejado) * 100 : null
            const acima = desvio != null && desvio > 0
            const largura = g.planejado > 0 ? Math.min(100, (g.realizado / g.planejado) * 100) : 0
            const aberto = grupoAberto === g.grupo
            return (
              <div key={g.grupo} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  onClick={() => setGrupoAberto(aberto ? null : g.grupo)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '38px 1fr 140px 140px 150px 28px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '14px 4px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      color: '#8b919c',
                      border: '1px solid var(--border2)',
                      borderRadius: 7,
                      padding: '4px 0',
                      textAlign: 'center',
                    }}
                  >
                    {g.grupo}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{g.nome}</div>
                    <div style={{ fontSize: 11, color: '#8b919c', marginTop: 2 }}>
                      {g.itens.length} itens · M{g.mes_inicio}–M{g.mes_fim}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    <div style={{ color: PLAN }}>{fmtMoeda(g.planejado)}</div>
                    <div style={{ fontSize: 10, color: '#8b919c' }}>planejado</div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    <div>{fmtMoeda(g.realizado)}</div>
                    <div style={{ fontSize: 10, color: '#8b919c' }}>
                      {g.planejado > 0 ? `${fmtPerc((g.realizado / g.planejado) * 100)} do planejado` : 'realizado'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        color: desvio == null ? '#8b919c' : acima ? VERMELHO : VERDE,
                      }}
                    >
                      {desvio == null ? '—' : `${acima ? '▲' : '▼'} ${Math.abs(desvio).toFixed(1)}%`}
                    </span>
                    <span
                      style={{
                        width: 60,
                        height: 4,
                        background: 'var(--bg3)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width: `${largura}%`,
                          background: acima ? VERMELHO : VERDE,
                        }}
                      />
                    </span>
                  </div>
                  <span style={{ color: '#8b919c', textAlign: 'center' }}>{aberto ? '▴' : '▾'}</span>
                </div>

                {aberto && (
                  <table style={{ marginBottom: 14 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 70 }}>EAP</th>
                        <th>Descrição</th>
                        <th style={{ textAlign: 'right', width: 120 }}>Planejado</th>
                        <th style={{ textAlign: 'right', width: 120 }}>Realizado</th>
                        <th style={{ textAlign: 'right', width: 80 }}>% do plan.</th>
                        <th style={{ textAlign: 'right', width: 90 }}>Período</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.itens.map((i) => {
                        const consumo = i.planejado > 0 ? (i.realizado / i.planejado) * 100 : null
                        return (
                        <React.Fragment key={i.chave || i.cod_eap}>
                        <tr
                          key={i.cod_eap}
                          onClick={() => setItemAberto(itemAberto === `c${i.cod_eap}` ? null : `c${i.cod_eap}`)}
                          style={{ cursor: (i.lancamentos || []).length ? 'pointer' : 'default' }}
                        >
                          <td style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>{i.cod_eap}</td>
                          <td>
                            {i.descricao}
                            {(i.lancamentos || []).length > 0 && (
                              <span style={{ color: '#8b919c', fontSize: 11, marginLeft: 8 }}>
                                {itemAberto === `c${i.cod_eap}` ? '▴' : '▾'} {i.lancamentos.length} lanç.
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: PLAN }}>
                            {i.planejado > 0 ? fmtMoeda(i.planejado) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                            {i.realizado > 0 ? fmtMoeda(i.realizado) : '—'}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontFamily: 'var(--mono)',
                              color: consumo == null ? '#8b919c' : consumo > 100 ? VERMELHO : VERDE,
                            }}
                          >
                            {consumo == null ? '—' : fmtPerc(consumo)}
                          </td>
                          <td
                            style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: '#8b919c' }}
                          >
                            M{i.mes_inicio}–M{i.mes_fim}
                          </td>
                        </tr>
                        {itemAberto === `c${i.cod_eap}` && (i.lancamentos || []).length > 0 && (
                          <tr key={`${i.cod_eap}-det`}>
                            <td colSpan={6} style={{ padding: 0 }}>
                              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', margin: '0 0 8px' }}>
                                {i.lancamentos.map((l, k) => (
                                  <div
                                    key={k}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: '80px 60px 1fr 1fr 110px',
                                      gap: 10,
                                      padding: '5px 0',
                                      fontSize: 12,
                                      borderBottom: k < i.lancamentos.length - 1 ? '1px solid var(--border)' : 'none',
                                    }}
                                  >
                                    <span style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>
                                      {l.data ? l.data.slice(8, 10) + '/' + l.data.slice(5, 7) + '/' + l.data.slice(2, 4) : l.competencia}
                                    </span>
                                    <span style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>
                                      S{String(l.semana).padStart(2, '0')}
                                    </span>
                                    <span>{l.fornecedor}</span>
                                    <span style={{ color: '#8b919c' }}>{l.historico}</span>
                                    <span style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                                      {fmtMoeda(l.valor)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              paddingTop: 14,
              fontSize: 12,
              color: '#8b919c',
            }}
          >
            <span>
              Soma dos grupos: planejado {fmtMoeda((somas || dados.consistencia).grupos_planejado_soma)} · realizado{' '}
              {fmtMoeda((somas || dados.consistencia).grupos_realizado_soma)}
            </span>
            <span>
              Curva planejada (BCWS) na mesma semana: {fmtMoeda(p.bcws)} — a diferença é de régua: aqui cada
              item é rateado entre mês de início e fim; a curva tem distribuição própria.
            </span>
          </div>
        </div>
      )}

      {abrirIndiretos && (
        <div className="card">
          <div className="card-title">
            Custo indireto por categoria — acumulado até S{String(p.semana).padStart(2, '0')}
          </div>
          {carregandoGrupos && <div className="loading">Somando os lançamentos da semana...</div>}
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>EAP</th>
                <th>Categoria</th>
                <th style={{ textAlign: 'right', width: 130 }}>Planejado até aqui</th>
                <th style={{ textAlign: 'right', width: 130 }}>Realizado</th>
                <th style={{ textAlign: 'right', width: 90 }}>% do plan.</th>
                <th style={{ textAlign: 'right', width: 130 }}>Planejado total</th>
              </tr>
            </thead>
            <tbody>
              {(indiretos || []).map((i) => {
                const consumo = i.planejado > 0 ? (i.realizado / i.planejado) * 100 : null
                return (
                  <tr key={i.cod_eap || i.categoria}>
                    <td style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>{i.cod_eap || '—'}</td>
                    <td>
                      {i.categoria}
                      <span style={{ color: '#8b919c', fontSize: 11, marginLeft: 8 }}>
                        {i.mes_desembolso > 0 ? `M${i.mes_desembolso}` : 'diluído na obra'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: PLAN }}>
                      {i.planejado > 0 ? fmtMoeda(i.planejado) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {i.realizado > 0 ? fmtMoeda(i.realizado) : '—'}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontFamily: 'var(--mono)',
                        color: consumo == null ? '#8b919c' : consumo > 100 ? VERMELHO : VERDE,
                      }}
                    >
                      {consumo == null ? '—' : fmtPerc(consumo)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: '#8b919c' }}>
                      {fmtMoeda(i.planejado_total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ paddingTop: 14, fontSize: 12, color: '#8b919c' }}>
            Soma das categorias: planejado {fmtMoeda((somas || dados.consistencia).indiretos_planejado_soma)} ·
            realizado {fmtMoeda((somas || dados.consistencia).indiretos_realizado_soma)}
            {(somas || dados.consistencia).indireto_realizado_sem_categoria > 0 &&
              ` · ${fmtMoeda((somas || dados.consistencia).indireto_realizado_sem_categoria)} lançados em códigos que não existem no planejamento de indiretos`}
          </div>
        </div>
      )}

      {abrirAvanco && (
        <div className="card">
          <div className="card-title">
            Avanço físico por grupo — até S{String(p.semana).padStart(2, '0')} · ponderado por hora-homem
          </div>
          {carregandoGrupos && <div className="loading">Buscando os retratos da semana...</div>}
          {(avancoGrupos || []).map((g) => {
            const desvio =
              g.perc_planejado != null && g.perc_realizado != null ? g.perc_realizado - g.perc_planejado : null
            const atrasado = desvio != null && desvio < 0
            const aberto = avancoAberto === g.grupo
            return (
              <div key={g.grupo} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  onClick={() => setAvancoAberto(aberto ? null : g.grupo)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '38px 1fr 110px 110px 110px 90px 28px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '14px 4px',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      color: '#8b919c',
                      border: '1px solid var(--border2)',
                      borderRadius: 7,
                      padding: '4px 0',
                      textAlign: 'center',
                    }}
                  >
                    {g.grupo}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{g.nome}</div>
                    <div style={{ fontSize: 11, color: '#8b919c', marginTop: 2 }}>
                      {g.itens.length} em curso · {g.hh_total.toLocaleString('pt-BR')} h
                      {g.itens_nao_iniciados > 0 ? ` · ${g.itens_nao_iniciados} não iniciados` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    <div style={{ color: PLAN }}>{fmtPerc(g.perc_planejado)}</div>
                    <div style={{ fontSize: 10, color: '#8b919c' }}>planejado</div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                    <div>{fmtPerc(g.perc_realizado)}</div>
                    <div style={{ fontSize: 10, color: '#8b919c' }}>realizado</div>
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--mono)',
                      color: desvio == null ? '#8b919c' : atrasado ? VERMELHO : VERDE,
                    }}
                  >
                    <div>
                      {desvio == null ? '—' : `${desvio > 0 ? '+' : ''}${desvio.toFixed(1).replace('.', ',')} p.p.`}
                    </div>
                    <div style={{ fontSize: 10, color: '#8b919c' }}>desvio</div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: '#8b919c', fontSize: 11 }}>
                    {fmtPerc(g.peso)} do Hh
                  </div>
                  <span style={{ color: '#8b919c', textAlign: 'center' }}>{aberto ? '▴' : '▾'}</span>
                </div>

                {aberto &&
                  (g.por_pavimento
                    ? g.pavimentos || []
                    : [{ pavimento: null, itens: g.itens }]
                  ).map((pv) => (
                    <div key={pv.pavimento || 'geral'} style={{ marginBottom: 10 }}>
                      {pv.pavimento && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 4px',
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: PLAN,
                          borderTop: '1px solid var(--border)',
                        }}
                      >
                        <span>{pv.pavimento}</span>
                        <span style={{ color: '#8b919c', textTransform: 'none', letterSpacing: 0 }}>
                          {pv.hh_real.toLocaleString('pt-BR')} h de {pv.hh_total.toLocaleString('pt-BR')} h ·
                          planejado {fmtPerc(pv.perc_planejado)} · realizado {fmtPerc(pv.perc_realizado)}
                        </span>
                      </div>
                      )}
                      <table style={{ marginBottom: 6 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 70 }}>EAP</th>
                            <th>Descrição</th>
                            <th style={{ textAlign: 'right', width: 80 }}>Hh</th>
                            <th style={{ textAlign: 'right', width: 90 }}>Planejado</th>
                            <th style={{ textAlign: 'right', width: 90 }}>Realizado</th>
                            <th style={{ textAlign: 'right', width: 90 }}>Desvio</th>
                            <th style={{ textAlign: 'right', width: 100 }}>Último retrato</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pv.itens.map((i) => {
                            const d = i.perc_realizado - i.perc_planejado
                            return (
                              <React.Fragment key={i.chave || i.cod_eap}>
                                <tr
                                  onClick={() =>
                                    setItemAberto(itemAberto === `a${i.cod_eap}` ? null : `a${i.cod_eap}`)
                                  }
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>{i.cod_eap}</td>
                                  <td>
                                    {i.descricao}
                                    <span style={{ color: '#8b919c', fontSize: 11, marginLeft: 8 }}>
                                      {itemAberto === `a${i.cod_eap}` ? '▴' : '▾'}{' '}
                                      {(i.retratos || []).length === 0
                                        ? 'lançar medição'
                                        : `${i.retratos.length} ${i.retratos.length === 1 ? 'medição' : 'medições'}`}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: '#8b919c' }}>
                                    {i.hh.toLocaleString('pt-BR')}
                                    {i.linhas > 1 && (
                                      <span style={{ fontSize: 10, display: 'block' }}>{i.linhas} locais</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: PLAN }}>
                                    {fmtPerc(i.perc_planejado)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                                    {fmtPerc(i.perc_realizado)}
                                  </td>
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      fontFamily: 'var(--mono)',
                                      color: d < 0 ? VERMELHO : VERDE,
                                    }}
                                  >
                                    {`${d > 0 ? '+' : ''}${d.toFixed(1).replace('.', ',')}`}
                                  </td>
                                  <td
                                    style={{
                                      textAlign: 'right',
                                      fontFamily: 'var(--mono)',
                                      fontSize: 10,
                                      color: '#8b919c',
                                    }}
                                  >
                                    {i.medido_na_semana
                                      ? `S${String(i.medido_na_semana).padStart(2, '0')}`
                                      : 'sem medição'}
                                  </td>
                                </tr>
                                {itemAberto === `a${i.cod_eap}` && (
                                  <tr>
                                    <td colSpan={7} style={{ padding: 0 }}>
                                      <div
                                        style={{
                                          background: 'var(--bg)',
                                          borderRadius: 8,
                                          padding: '12px 14px',
                                          margin: '0 0 8px',
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontFamily: 'var(--mono)',
                                            fontSize: 10,
                                            letterSpacing: '0.1em',
                                            textTransform: 'uppercase',
                                            color: PLAN,
                                            marginBottom: 8,
                                          }}
                                        >
                                          {(i.retratos || []).length === 0
                                            ? 'Memória de cálculo — nenhuma medição ainda'
                                            : `Memória de cálculo — ${i.retratos.length} ${
                                                i.retratos.length === 1 ? 'lançamento' : 'lançamentos'
                                              }`}
                                        </div>
                                        {(i.retratos || []).map((rt, k) => {
                                          const anterior = k > 0 ? i.retratos[k - 1].perc : 0
                                          const delta = rt.perc - anterior
                                          return (
                                            <div
                                              key={k}
                                              style={{
                                                display: 'grid',
                                                gridTemplateColumns: '90px 80px 1fr 90px 90px',
                                                gap: 10,
                                                padding: '6px 0',
                                                fontSize: 12,
                                                borderBottom:
                                                  k < i.retratos.length - 1 ? '1px solid var(--border)' : 'none',
                                              }}
                                            >
                                              <span style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>
                                                {rt.data
                                                  ? rt.data.slice(8, 10) +
                                                    '/' +
                                                    rt.data.slice(5, 7) +
                                                    '/' +
                                                    rt.data.slice(2, 4)
                                                  : '—'}
                                              </span>
                                              <span style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>
                                                Semana {rt.semana}
                                              </span>
                                              <span
                                                style={{
                                                  fontFamily: 'var(--mono)',
                                                  color: delta < 0 ? VERMELHO : VERDE,
                                                }}
                                              >
                                                {delta === 0
                                                  ? '—'
                                                  : `${delta > 0 ? '+' : ''}${delta.toFixed(1).replace('.', ',')}%`}
                                              </span>
                                              <span />
                                              <span
                                                style={{
                                                  textAlign: 'right',
                                                  fontFamily: 'var(--mono)',
                                                  display: 'flex',
                                                  gap: 8,
                                                  justifyContent: 'flex-end',
                                                  alignItems: 'center',
                                                }}
                                              >
                                                {fmtPerc(rt.perc)}
                                                <button
                                                  className="btn-sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    exigirSenha(() => {
                                                      setEditando(rt.id)
                                                      const anteriorDele =
                                                        k > 0 ? i.retratos[k - 1].perc : 0
                                                      setForm({
                                                        data: rt.data || '',
                                                        incremento: (rt.perc - anteriorDele)
                                                          .toFixed(1)
                                                          .replace('.', ','),
                                                        acumulado: String(rt.perc),
                                                      })
                                                    })
                                                  }}
                                                >
                                                  editar
                                                </button>
                                                <button
                                                  className="btn-danger"
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    exigirSenha(() => excluirMedicao(rt.id))
                                                  }}
                                                >
                                                  excluir
                                                </button>
                                              </span>
                                            </div>
                                          )
                                        })}
                                        <div
                                          style={{
                                            display: 'flex',
                                            gap: 10,
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            paddingTop: 12,
                                            marginTop: 8,
                                            borderTop: '1px solid var(--border)',
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <input
                                            type="date"
                                            value={form.data}
                                            onChange={(e) => setForm({ ...form, data: e.target.value })}
                                            style={{ width: 150 }}
                                          />
                                          <div className="field" style={{ width: 130 }}>
                                            <label>Avançou</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              step="0.1"
                                              placeholder="%"
                                              value={form.incremento}
                                              onChange={(e) => {
                                                const inc = parseFloat(e.target.value)
                                                const base = editando
                                                  ? 0
                                                  : i.perc_realizado || 0
                                                setForm({
                                                  ...form,
                                                  incremento: e.target.value,
                                                  acumulado: Number.isFinite(inc)
                                                    ? String(
                                                        Math.min(
                                                          100,
                                                          parseFloat((base + inc).toFixed(2))
                                                        )
                                                      )
                                                    : '',
                                                })
                                              }}
                                            />
                                          </div>
                                          <span style={{ color: '#8b919c', fontSize: 18, paddingTop: 12 }}>→</span>
                                          <div className="field" style={{ width: 140 }}>
                                            <label>Total fica em</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              step="0.1"
                                              placeholder="%"
                                              value={form.acumulado}
                                              onChange={(e) => {
                                                const ac = parseFloat(e.target.value)
                                                const base = i.perc_realizado || 0
                                                setForm({
                                                  ...form,
                                                  acumulado: e.target.value,
                                                  incremento: Number.isFinite(ac)
                                                    ? parseFloat((ac - base).toFixed(2))
                                                        .toString()
                                                        .replace('.', ',')
                                                    : '',
                                                })
                                              }}
                                            />
                                          </div>
                                          <button
                                            className="btn-primary"
                                            disabled={salvando || !form.data || form.acumulado === ''}
                                            onClick={() =>
                                              exigirSenha(() => salvarMedicao(i.cod_eap, editando))
                                            }
                                          >
                                            {editando ? 'Salvar alteração' : 'Incluir medição'}
                                          </button>
                                          {editando && (
                                            <button
                                              className="btn-secondary"
                                              onClick={() => {
                                                setEditando(null)
                                                setForm({ data: '', incremento: '', acumulado: '' })
                                              }}
                                            >
                                              Cancelar
                                            </button>
                                          )}
                                          <span style={{ fontSize: 11, color: '#8b919c', maxWidth: 210 }}>
                                            preencha um dos dois — o outro se ajusta. Hoje em{' '}
                                            {fmtPerc(i.perc_realizado)}.
                                          </span>
                                          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8b919c' }}>
                                            Total acumulado:{' '}
                                            <b style={{ color: 'var(--text)' }}>{fmtPerc(i.perc_realizado)}</b>
                                          </span>
                                        </div>
                                        {erroSalvar && (
                                          <div className="toast toast-err" style={{ marginTop: 10 }}>
                                            {erroSalvar}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </div>
            )
          })}
          <div style={{ paddingTop: 14, fontSize: 12, color: '#8b919c' }}>
            Só a parcela de produção (grupos com entra_evm). Locação e funcionários não medem avanço físico.
          </div>
        </div>
      )}

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

      {mapa && (
        <div className="card">
          <div className="card-title">Mapa de Avanço por Pavimento</div>
          <div style={{ fontSize: 11, color: '#8b919c', margin: '0 0 12px' }}>
            Até S{String(p.semana).padStart(2, '0')} · ponderado por hora-homem · cor pelo realizado sobre o
            planejado da própria célula.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Pav</th>
                  {mapa.grupos.map((g) => (
                    <th key={g.numero} style={{ textAlign: 'center', fontSize: 9, lineHeight: 1.3 }}>
                      {g.numero}
                      <br />
                      {g.nome.split(' ')[0].slice(0, 8)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* De cima para baixo, como o prédio: cobertura no topo, térreo embaixo. */}
                {[...mapa.pavimentos].reverse().map((pav) => (
                  <tr key={pav}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{pav}</td>
                    {mapa.grupos.map((g) => {
                      const c = mapa.celulas.find((x) => x.pavimento === pav && x.grupo === g.numero)
                      if (!c) return <td key={g.numero} />
                      const plan = c.perc_planejado || 0
                      const real = c.perc_realizado || 0
                      const futuro = plan <= 0 && real <= 0
                      const razao = plan > 0 ? real / plan : 1
                      const fundo = futuro
                        ? 'transparent'
                        : razao >= 1
                        ? 'rgba(127,176,138,0.85)'
                        : razao >= 0.85
                        ? 'rgba(217,160,91,0.85)'
                        : 'rgba(199,123,116,0.85)'
                      return (
                        <td
                          key={g.numero}
                          title={`${g.nome} · ${pav}\nplanejado ${fmtPerc(plan)} · realizado ${fmtPerc(real)} · ${c.hh.toLocaleString('pt-BR')} h`}
                          style={{
                            textAlign: 'center',
                            background: fundo,
                            color: futuro ? '#5c6169' : '#131316',
                            fontFamily: 'var(--mono)',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 4,
                            padding: '8px 4px',
                          }}
                        >
                          {futuro ? '' : `${Math.round(real)}%`}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 18, paddingTop: 12, fontSize: 11, color: '#8b919c' }}>
            {[
              ['rgba(127,176,138,0.85)', 'Em dia'],
              ['rgba(217,160,91,0.85)', 'Atenção'],
              ['rgba(199,123,116,0.85)', 'Atrasado'],
              ['transparent', 'Não iniciado'],
            ].map(([cor, txt]) => (
              <span key={txt} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 11,
                    height: 11,
                    background: cor,
                    border: cor === 'transparent' ? '1px solid var(--border2)' : 'none',
                    borderRadius: 3,
                  }}
                />
                {txt}
              </span>
            ))}
          </div>
        </div>
      )}

      {avancoGrupos && avancoGrupos.length > 0 && (
        <div className="card">
          <div className="card-title">Físico por Atividade — Desvio Relativo da Atividade</div>
          <div style={{ fontSize: 11, color: '#8b919c', margin: '8px 0 16px', lineHeight: 1.5 }}>
            Compara cada grupo com a própria meta até S{String(p.semana).padStart(2, '0')}. Não é somável ao
            desvio do projeto — um grupo pequeno atrasado pesa pouco no total.
          </div>
          {avancoGrupos.map((g) => {
            const real = Math.min(Math.max(g.perc_realizado || 0, 0), 100)
            const plan = Math.min(Math.max(g.perc_planejado || 0, 0), 100)
            const atraso = Math.max(0, plan - real)
            const resto = Math.max(0, 100 - Math.max(real, plan))
            const d = real - plan
            return (
              <div key={g.grupo} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>
                    {g.grupo}. {g.nome}
                  </span>
                  <span style={{ display: 'flex', gap: 14, alignItems: 'center', fontFamily: 'var(--mono)' }}>
                    <span style={{ color: '#8b919c' }}>Plan {fmtPerc(plan)}</span>
                    <span>Real {fmtPerc(real)}</span>
                    <span style={{ fontWeight: 700, color: d >= 0 ? VERDE : VERMELHO }}>
                      {d >= 0 ? '+' : ''}
                      {d.toFixed(1).replace('.', ',')}%
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    height: 10,
                    background: 'var(--bg3)',
                    borderRadius: 5,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ width: `${real}%`, background: VERDE }} title={`Executado ${fmtPerc(real)}`} />
                  {atraso > 0 && (
                    <div style={{ width: `${atraso}%`, background: VERMELHO }} title={`Atraso ${fmtPerc(atraso)}`} />
                  )}
                  <div style={{ width: `${resto}%`, background: PLAN, opacity: 0.35 }} title="A executar" />
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 18, paddingTop: 6, fontSize: 11, color: '#8b919c' }}>
            {[[VERDE, 'Executado'], [VERMELHO, 'Atraso'], [PLAN, 'A executar']].map(([cor, txt]) => (
              <span key={txt} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 11, height: 11, background: cor, borderRadius: 3, opacity: txt === 'A executar' ? 0.35 : 1 }} />
                {txt}
              </span>
            ))}
          </div>
        </div>
      )}

      <DiarioOcorrencias />

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
