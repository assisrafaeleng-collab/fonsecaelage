// components/Dashboard.jsx
// fmtMoeda importada de lib/constants — sem duplicata local
import { FisicoPorAtividade, Heatmap } from './PaineisAnalise'
import DiarioOcorrencias from './DiarioOcorrencias'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Line } from 'react-chartjs-2'
import { fmtMoeda } from '../lib/constants'   // fonte única
import { garantirSenha } from '../lib/fetch-com-senha'
import ContasAPagarDetalhe from './ContasAPagarDetalhe'
import { competenciaDoLancamento } from '../lib/competencia'
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

/* ---- Mesma paleta do Sirius 60. Planejado e referencia (azul lavado),
   realizado e o numero medido (claro + pilula), cor semantica so em
   saldo e desvio. Tons dessaturados: ver styles/globals.css ---- */
const PLAN = '#6e8ba8'
const REAL = '#f2f4f7'
const PILL = { background: 'rgba(255,255,255,0.07)', padding: '3px 8px',
               borderRadius: 6 }
const VERDE = '#7fb08a'
const VERMELHO = '#c77b74'
const NEUTRO = '#8b919c'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const fmtPerc = (val) => {
  if (val == null) return '-'
  return `${val.toFixed(1)}%`
}

// Competencia AAAA-MM do mes do projeto (M1 = jul/2026).
const compDoMes = (m) => {
  const abs = 6 + (m - 1)
  return `${2026 + Math.floor(abs / 12)}-${String((abs % 12) + 1).padStart(2, '0')}`
}
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rotuloComp = (c) => `${NOMES_MES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—')

// Conferencia do fechamento: os lancamentos de uma competencia, com
// subtotais direto (EAP fora do 19) e indireto (EAP 19). A lista mostra
// fornecedor, por isso so carrega depois da senha, como a tela de custos.
function LancamentosDoMes({ mesInicial, ultimoMes }) {
  const [comp, setComp] = useState(compDoMes(mesInicial))
  const [liberado, setLiberado] = useState(false)
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => { setComp(compDoMes(mesInicial)) }, [mesInicial])

  useEffect(() => {
    if (!liberado) return
    setLista(null)
    setErro(null)
    // Busca tudo e filtra pela mesma regra do dashboard: a competencia
    // gravada pode vir como 2026-09 ou 2026-09-01.
    fetch('/api/custos', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (!d.lancamentos) throw new Error(d.message || d.error || 'resposta sem lançamentos')
        setLista(
          d.lancamentos
            .filter(l => l.status === 'Normal' && competenciaDoLancamento(l.competencia, l.data_emissao) === comp)
            .sort((a, b) =>
              String(a.codigo_eap || '').localeCompare(String(b.codigo_eap || ''), 'pt-BR', { numeric: true }) ||
              String(a.fornecedor || '').localeCompare(String(b.fornecedor || ''), 'pt-BR'))
        )
      })
      .catch(e => setErro(e.message))
  }, [liberado, comp])

  async function abrir() {
    if (await garantirSenha()) setLiberado(true)
  }

  const ehIndireto = (l) => String(l.codigo_eap || '').startsWith('19.')
  const soma = (xs) => xs.reduce((t, l) => t + (parseFloat(l.valor) || 0), 0)
  const opcoes = Array.from({ length: Math.max(ultimoMes, 1) }, (_, i) => compDoMes(i + 1)).reverse()
  const dir = { textAlign: 'right', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }

  return (
    <div className="card">
      <div className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span>Lançamentos do mês — conferência do fechamento</span>
        {liberado && (
          <select className="periodo" value={comp} onChange={e => setComp(e.target.value)}>
            {opcoes.map(c => <option key={c} value={c}>{rotuloComp(c)}</option>)}
          </select>
        )}
      </div>
      {!liberado && (
        <button className="nav-btn" style={{ borderBottom: 'none', color: 'var(--text)' }} onClick={abrir}>
          Ver os lançamentos de {rotuloComp(comp)} (pede a senha) ▸
        </button>
      )}
      {liberado && erro && <div className="empty-state"><p>Erro ao carregar: {erro}</p></div>}
      {liberado && !erro && !lista && <div className="loading">Carregando lançamentos...</div>}
      {liberado && lista && (() => {
        const ind = lista.filter(ehIndireto)
        const dirs = lista.filter(l => !ehIndireto(l))
        return (
          <>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', font: "500 12px 'IBM Plex Sans'", color: 'var(--text2)', marginBottom: 14 }}>
              <span>Direto <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{fmtMoeda(soma(dirs))}</b> ({dirs.length})</span>
              <span>Indireto <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{fmtMoeda(soma(ind))}</b> ({ind.length})</span>
              <span>Total <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{fmtMoeda(soma(lista))}</b> ({lista.length} lançamentos)</span>
            </div>
            {lista.length === 0 ? (
              <div className="empty-state"><p>Nenhum lançamento em {rotuloComp(comp)}.</p></div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fornecedor</th>
                      <th>Documento</th>
                      <th>Emissão</th>
                      <th>EAP</th>
                      <th>Tipo</th>
                      <th style={{ textAlign: 'right' }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map(l => (
                      <tr key={l.id}>
                        <td>
                          {l.fornecedor}
                          {l.historico && <div style={{ color: 'var(--text2)', fontSize: 11 }}>{l.historico}</div>}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{l.num_documento || '—'}</td>
                        <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{dmy(l.data_emissao)}</td>
                        <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }} title={l.classificacao || ''}>{l.codigo_eap || '—'}</td>
                        <td>{ehIndireto(l) ? 'Indireto' : 'Direto'}</td>
                        <td style={dir}>{fmtMoeda(parseFloat(l.valor) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {[['Subtotal direto', dirs], ['Subtotal indireto', ind], ['Total do mês', lista]].map(([rot, xs]) => (
                      <tr key={rot}>
                        <td colSpan={5} style={{ fontWeight: 600 }}>{rot}</td>
                        <td style={{ ...dir, fontWeight: 600 }}>{fmtMoeda(soma(xs))}</td>
                      </tr>
                    ))}
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}

// Custo direto a pagar: titulos sem pagamento com vencimento a partir do mes
// do fechamento, so o que e pago por entrega. O valor do card e o direto (com
// NF + previsto sem NF), o mesmo que entra no IPC; fica fora do custo
// realizado. Clique no card abre a lista completa (direto e indireto) por mes
// de vencimento.
function ContasAPagar() {
  const [resumo, setResumo] = useState(null)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    fetch('/api/contas-a-pagar?resumo=1', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => (d.error ? setErro(d.error) : setResumo(d)))
      .catch(e => setErro(e.message))
  }, [])

  const AMBAR = '#c9a45c'

  if (erro) return <div className="card"><div className="card-title">Custo direto a pagar</div><div className="empty-state"><p>Erro: {erro}</p></div></div>
  if (!resumo) return null
  if (!resumo.disponivel)
    return (
      <div className="card">
        <div className="card-title">Custo direto a pagar</div>
        <div style={{ font: "500 12px 'IBM Plex Sans'", color: 'var(--text2)' }}>Sem dados: {resumo.motivo}.</div>
      </div>
    )

  const t = resumo.totais
  return (
    <div className="card kpi-clickable" style={{ cursor: 'pointer' }} onClick={() => setAberto(v => !v)}>
      <div className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span>
          Custo direto a pagar — Vencimentos a partir de {resumo.vencimentos_a_partir_de} · fechamento {resumo.fechamento} {aberto ? '▴' : '▾'}
        </span>
        {resumo.n_alertas > 0 && (
          <span className="badge" style={{ background: 'rgba(201,164,92,.15)', color: AMBAR }}>
            ⚠ {resumo.n_alertas} título(s) com alerta
          </span>
        )}
      </div>
      <div className="kpi-value" style={{ fontSize: 22 }}>{fmtMoeda(t.ipc_direto)}</div>
      <div className="kpi-sub">
        com NF {fmtMoeda(t.direto)} + previsto sem NF {fmtMoeda(t.previsto_direto)} · é o valor que entra no IPC · fora do custo realizado
      </div>
      <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', margin: '12px 0 4px' }}>
        Por mês: {resumo.por_mes.map(m => `${rotuloComp(m.mes)} ${fmtMoeda(m.ipc_direto)}`).join(' · ')}
        {' · '}{aberto ? 'clique para fechar' : 'clique para ver todos os títulos (direto e indireto)'}
      </div>
      {aberto && (
        <div onClick={e => e.stopPropagation()} style={{ cursor: 'default' }}>
          <ContasAPagarDetalhe />
        </div>
      )}
    </div>
  )
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
                <span style={{ fontWeight: 700, color: (at.realizado - at.planejado) >= 0 ? VERDE : VERMELHO }}>
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
                  <div style={{ height: '100%', width: `${r}%`, background: VERDE }} title={`Executado: ${r.toFixed(1)}%`} />
                  {atraso > 0 && (
                    <div style={{ height: '100%', width: `${atraso}%`, background: VERMELHO }} title={`Atraso: ${atraso.toFixed(1)}%`} />
                  )}
                  <div style={{ height: '100%', width: `${restante}%`, background: NEUTRO, opacity: 0.3 }} title={`A executar: ${restante.toFixed(1)}%`} />
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
  // Ultimo mes com custo lancado (padrao da conferencia quando o filtro e "todos")
  const ultimoMesComCusto = meses_alinhados.reduce((u, m) => (m.financeiro_realizado != null ? m.mes_numero : u), 1)

  const labels = meses_alinhados.map(m => {
    if (!m.competencia) return `M${m.mes_numero}`
    const d = new Date(m.competencia + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  })

  const finPlan = meses_alinhados.map(m => m.financeiro_planejado ? m.financeiro_planejado / 1000 : null)
  const fisPlan = meses_alinhados.map(m => m.fisico_planejado)

  const ultimoMesFisReal = meses_alinhados.reduce((last, m, i) =>
    (m.fisico_realizado != null && Number.isFinite(m.fisico_realizado)) ? i : last, -1)
  const ultimoMesFinReal = meses_alinhados.reduce((last, m, i) =>
    (m.financeiro_realizado != null && Number.isFinite(m.financeiro_realizado)) ? i : last, -1)

  const fisReal = meses_alinhados.map((m, i) =>
    i <= ultimoMesFisReal ? m.fisico_realizado : null)
  const finReal = meses_alinhados.map((m, i) =>
    i <= ultimoMesFinReal ? (m.financeiro_realizado ? m.financeiro_realizado / 1000 : null) : null)

  const chartData = {
    labels,
    datasets: [
      { label: 'Financeiro Planejado', data: finPlan, borderColor: '#5f8a6d', backgroundColor: 'rgba(95, 138, 109, 0.1)', fill: false, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 3, pointHoverRadius: 5, pointStyle: 'circle', pointBackgroundColor: 'transparent', yAxisID: 'y-financeiro', tension: 0.3 },
      {
        label: 'Financeiro Realizado',
        data: finReal,
        borderColor: VERDE,
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
        pointBackgroundColor: VERDE,
        yAxisID: 'y-financeiro',
        tension: 0.35
      },
      { label: 'Físico Planejado', data: fisPlan, borderColor: '#5e7d99', backgroundColor: 'rgba(94, 125, 153, 0.1)', fill: false, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 3, pointHoverRadius: 5, pointStyle: 'circle', pointBackgroundColor: 'transparent', yAxisID: 'y-fisico', tension: 0.3 },
      { label: 'Físico Realizado', data: fisReal, borderColor: '#7fa8d4', backgroundColor: 'rgba(74, 143, 224, 0.1)', fill: false, borderWidth: 2.5, borderDash: [], pointRadius: 4, pointHoverRadius: 6, pointStyle: 'circle', pointBackgroundColor: '#7fa8d4', yAxisID: 'y-fisico', tension: 0.35 }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false, position: 'top', labels: { color: '#8b919c', font: { size: 11 }, usePointStyle: true, padding: 15 } },
      tooltip: {
        backgroundColor: 'rgba(27,30,36,0.96)', titleColor: '#8b919c', bodyColor: '#8b919c', borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, padding: 12, displayColors: true,
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
      'y-financeiro': { type: 'linear', position: 'left', title: { display: true, text: 'Financeiro (R$ mil)', color: '#8b919c', font: { size: 11 } }, ticks: { color: '#8b919c', font: { size: 10 }, callback: (v) => `R$ ${v}k` }, grid: { color: 'rgba(255,255,255,0.06)' } },
      'y-fisico': { type: 'linear', position: 'right', min: 0, max: 100, title: { display: true, text: 'Físico (%)', color: '#8b919c', font: { size: 11 } }, ticks: { color: '#8b919c', font: { size: 10 }, callback: (v) => `${v}%` }, grid: { drawOnChartArea: false } },
      x: { ticks: { color: '#8b919c', font: { size: 10 }, maxRotation: 45, minRotation: 45 }, grid: { color: 'rgba(255,255,255,0.06)' } }
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
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: PLAN }}>{fmtMoeda(custoDiretoPlano)}</div>
          <div className="kpi-sub">{mesLimite === 20 ? "Orçado para 20 meses" : `Acumulado até M${mesLimite}`}</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push('/custos-diretos-realizados-lista')}>
          <div className="kpi-label">Custo Direto Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: REAL }}>
            <span style={PILL}>{fmtMoeda(custoDiretoReal)}</span>
          </div>
          <div className="kpi-sub">{fmtPerc((custoDiretoReal / custoDiretoPlano) * 100)} do planejado</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Saldo Custo Direto</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: saldoCustoDireto >= 0 ? VERDE : VERMELHO }}>{fmtMoeda(saldoCustoDireto)}</div>
          <div className="kpi-sub">{saldoCustoDireto >= 0 ? 'Economia' : 'Acima'}</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push(`/avanco-fisico-planejado?mes=${mesLimite}`)}>
          <div className="kpi-label">Avanço Físico Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtPerc(avancoFisicoPlano)}</div>
          <div className="kpi-sub">Hh planejado ÷ Hh orçado · em S{String(kpis.avanco_semana_referencia || 0).padStart(2, '0')}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Desvio Físico do Projeto</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: avancoFisicoReal >= avancoFisicoPlano ? VERDE : VERMELHO }}>
            {avancoFisicoReal >= avancoFisicoPlano ? '+' : ''}{fmtPerc(avancoFisicoReal - avancoFisicoPlano)}
          </div>
          <div className="kpi-sub">{avancoFisicoReal >= avancoFisicoPlano ? 'Adiantado' : 'Atrasado'} · p.p. do projeto</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginTop: '-10px' }}>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push(`/custos-indiretos-planejados?mes=${mesLimite}`)}>
          <div className="kpi-label">Custo Indireto Planejado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: PLAN }}>{fmtMoeda(custoIndiretoPlano)}</div>
          <div className="kpi-sub">{mesLimite === 20 ? "Orçado para 20 meses" : `Acumulado até M${mesLimite}`}</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push('/custos-indiretos-realizados-lista')}>
          <div className="kpi-label">Custo Indireto Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: REAL }}>
            <span style={PILL}>{fmtMoeda(custoIndiretoReal)}</span>
          </div>
          <div className="kpi-sub">{custoIndiretoPlano > 0 ? fmtPerc((custoIndiretoReal / custoIndiretoPlano) * 100) : '0%'} do planejado</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Saldo Custo Indireto</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: saldoCustoIndireto >= 0 ? VERDE : VERMELHO }}>{fmtMoeda(saldoCustoIndireto)}</div>
          <div className="kpi-sub">{saldoCustoIndireto >= 0 ? 'Economia' : 'Acima'}</div>
        </div>
        <div className="kpi" style={{ cursor: 'pointer' }} onClick={() => router.push('/semanal')}>
          <div className="kpi-label">Avanço Físico Realizado</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtPerc(avancoFisicoReal)}</div>
          <div className="kpi-sub" title="Avanço físico = horas executadas ÷ horas orçadas (mesma conta da página semanal)">
            {(kpis.hh_executado || 0).toLocaleString('pt-BR')} h de {(kpis.hh_orcado || 0).toLocaleString('pt-BR')} h · em S{String(kpis.avanco_semana_referencia || 0).padStart(2, '0')}
          </div>
        </div>
        <div style={{ visibility: 'hidden' }}></div>
      </div>

      <div className="card">
        <div className="card-title">Curva S — Acompanhamento Físico-Financeiro</div>
        <div style={{ display:'flex', gap:'20px', flexWrap:'wrap', margin:'10px 0 6px' }}>
          <span style={{ display:'flex', alignItems:'center', gap:'7px', font:"500 11px 'IBM Plex Sans'", color:'#8b919c' }}>
            <span style={{ width:'18px', height:0, borderTop:'2px solid #7fb08a' }}></span>Financeiro realizado</span>
          <span style={{ display:'flex', alignItems:'center', gap:'7px', font:"500 11px 'IBM Plex Sans'", color:'#8b919c' }}>
            <span style={{ width:'18px', height:0, borderTop:'2px dashed #5f8a6d' }}></span>Financeiro planejado</span>
          <span style={{ display:'flex', alignItems:'center', gap:'7px', font:"500 11px 'IBM Plex Sans'", color:'#8b919c' }}>
            <span style={{ width:'18px', height:0, borderTop:'2px solid #7fa8d4' }}></span>Físico realizado</span>
          <span style={{ display:'flex', alignItems:'center', gap:'7px', font:"500 11px 'IBM Plex Sans'", color:'#8b919c' }}>
            <span style={{ width:'18px', height:0, borderTop:'2px dashed #5e7d99' }}></span>Físico planejado</span>
        </div>
        <div style={{ height: '400px', position: 'relative' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      <LancamentosDoMes
        mesInicial={mesLimite < 20 ? mesLimite : ultimoMesComCusto}
        ultimoMes={Math.max(ultimoMesComCusto, mesLimite < 20 ? mesLimite : 0)}
      />

      <ContasAPagar />

      <div className="card">
        <div className="card-title">Mapa de Avanço por Pavimento</div>
        <Heatmap mes={mesLimite} />
      </div>

      <div className="card">
        <div className="card-title">Físico por Atividade — Desvio Relativo da Atividade</div>
        <div style={{ fontSize: '11px', color: 'var(--text2)', margin: '8px 0 12px', lineHeight: 1.5 }}>
          Esta métrica mede o desvio da própria meta de cada atividade. Ela não é somável ao desvio absoluto do projeto.
        </div>
        <FisicoPorAtividade mes={mesLimite} />
      </div>

      <DiarioOcorrencias />
    </div>
  )
}
