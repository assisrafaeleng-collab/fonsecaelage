// pages/semanal.js
// Acompanhamento semanal — mesma linguagem visual do Dashboard mensal:
// classes de styles/globals.css, paleta e formatadores de components/Dashboard.jsx.
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Line } from 'react-chartjs-2'
import { fmtMoeda } from '../lib/constants'
import { fetchComSenha, garantirSenha } from '../lib/fetch-com-senha'
import DiarioOcorrencias from '../components/DiarioOcorrencias'
import ContasAPagarDetalhe from '../components/ContasAPagarDetalhe'
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
const AMBAR = '#c9a45c'
// Painel de custo direto por grupo: nº, nome, orçado, agregado, custo, estouro / economia, seta
const GRUPO_COLS = '38px minmax(0,1fr) 120px 140px 190px 170px 28px'

const FIN_PLAN = '#5f8a6d'
const FIN_REAL = '#7fb08a'
const FIN_AGREG = '#d4b26a'
const FIS_PLAN = '#5e7d99'
const FIS_REAL = '#7fa8d4'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_EXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const fmtPerc = (v) => (v == null ? '-' : `${v.toFixed(1)}%`)
const fmtIdx = (v) => (v == null ? '-' : v.toFixed(3).replace('.', ','))
// Eficiencia de custo da linha (agregado / realizado): 1,05 = 5% abaixo do orcado.
const fmtEficiencia = (v) => (v == null ? '—' : v.toFixed(2).replace('.', ','))
const iso = (s) => (s ? String(s).slice(0, 10) : '')
const dm = (s) => (s ? `${iso(s).slice(8, 10)}/${iso(s).slice(5, 7)}` : '')
const dmy = (s) => (s ? `${iso(s).slice(8, 10)}/${iso(s).slice(5, 7)}/${iso(s).slice(0, 4)}` : '')

const menos6 = (s) => {
  const [y, m, d] = iso(s).split('-').map(Number)
  if (!y) return ''
  return new Date(Date.UTC(y, m - 1, d) - 6 * 86400000).toISOString().slice(0, 10)
}
// Inicio da semana: o do calendario (semanas partidas na virada do mes tem
// menos de 7 dias); resposta antiga sem o campo, 6 dias antes do fim.
const inicioDe = (c) => (c && c.data_inicio ? iso(c.data_inicio) : menos6(c && c.data_fim))

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
  const [abrirProjecao, setAbrirProjecao] = useState(false)
  const [abrirIndiretos, setAbrirIndiretos] = useState(false)
  const [abrirAvanco, setAbrirAvanco] = useState(false)
  const [abrirAPagar, setAbrirAPagar] = useState(false)
  const [avancoGrupos, setAvancoGrupos] = useState(null)
  const [mapa, setMapa] = useState(null)
  const [avancoAberto, setAvancoAberto] = useState(null)
  // Painel de avanço: pavimentos abertos ('3|3.2') e pavimentos com as linhas
  // não iniciadas à mostra; começa tudo recolhido
  const [pavAvancoAberto, setPavAvancoAberto] = useState(() => new Set())
  const [pavNaoIniciados, setPavNaoIniciados] = useState(() => new Set())
  const alternarEm = (set) => (k) =>
    set((atual) => {
      const novo = new Set(atual)
      if (novo.has(k)) novo.delete(k)
      else novo.add(k)
      return novo
    })
  const [itemAberto, setItemAberto] = useState(null)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ data: '', incremento: '', acumulado: '' })
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState(null)
  const [recarregar, setRecarregar] = useState(0)
  const [indiretos, setIndiretos] = useState(null)
  const [grupoAberto, setGrupoAberto] = useState(null)
  // Pavimentos abertos no painel de custo direto ('3|3.2', '7|2º'); começam recolhidos
  const [pavAberto, setPavAberto] = useState(() => new Set())
  const alternarPav = (k) =>
    setPavAberto((atual) => {
      const novo = new Set(atual)
      if (novo.has(k)) novo.delete(k)
      else novo.add(k)
      return novo
    })
  const [abertura, setAbertura] = useState(null)
  const [somas, setSomas] = useState(null)
  const [carregandoGrupos, setCarregandoGrupos] = useState(false)

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

  // Pede a senha de lançamento (conferida no servidor) antes de editar medições.
  const exigirSenha = async (acao) => {
    if (await garantirSenha()) acao()
  }

  // pavimento: só para código repetido por pavimento (medição por linha)
  const salvarMedicao = async (cod_eap, id, pavimento = null) => {
    setSalvando(true)
    setErroSalvar(null)
    try {
      const r = await fetchComSenha('/api/avanco-lancamento', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, codigo_eap: cod_eap, pavimento, data: form.data, percentual: form.acumulado }),
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
      const r = await fetchComSenha('/api/avanco-lancamento', {
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
      const ini = inicioDe(c)
      const rot = rotuloMes(ini)
      if (!g.length || g[g.length - 1].rotulo !== rot) g.push({ rotulo: rot, semanas: [] })
      g[g.length - 1].semanas.push({ ...c, data_inicio: ini })
    })
    return g
  }, [dados])

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
  // Contas a pagar do ultimo fechamento (relatorio do TOTVS, classificado por
  // EAP). Direto = com NF e "Prev. Financ."; entra no IPC. Sem carga, zero.
  const contas = dados.contas_a_pagar || { disponivel: false, direto: 0, indireto: 0 }
  const aPagarDireto = contas.direto || 0
  const aPagarIndireto = contas.indireto || 0
  const saldoIndireto = indiretoReal == null ? null : indiretoPlan - indiretoReal - aPagarIndireto
  const pctIndireto = saldoIndireto == null || indiretoPlan <= 0 ? null : (saldoIndireto / indiretoPlan) * 100
  // Avanço físico é sempre horas executadas ÷ horas orçadas (decisão out/26),
  // nunca ponderado por valor. O alternador só escolhe quais cards aparecem.
  const nomeAvanco = 'Avanço Físico'

  // Valor agregado e custo direto na semana SELECIONADA (decisão out/26:
  // tudo na mesma data, em todas as telas). Semana sem medição nova usa o
  // percentual acumulado da última medição; o agregado é a mesma conta do
  // dashboard mensal e da /valor-agregado (lib/painel-semanal.js).
  const semMedida = Math.min(p.semana, dados.ultima_semana_com_avanco || p.semana)
  const pRef = p
  const sRef = `S${String(p.semana).padStart(2, '0')}`
  const refAtrasada = semMedida < p.semana
  // Avanço físico e IDP (decisão out/26): planejado e realizado SEMPRE na
  // semana selecionada. Semana sem medição nova usa o realizado acumulado da
  // última medição (a curva já vem com ele) contra o planejado da própria
  // semana, como no IPC do mês.
  const sSel = `S${String(p.semana).padStart(2, '0')}`
  const sMedicao = `S${String(dados.ultima_semana_com_avanco || p.semana).padStart(2, '0')}`
  // Valor agregado sempre na régua de custo: percentual executado × custo do
  // item. O alternador Hh não muda quanto o serviço feito deveria ter custado.
  const agregado =
    pRef.bcwp_a_custo == null ? null : pRef.bcwp_a_custo + (pRef.bcwp_b || 0) + (pRef.bcwp_c || 0)
  const realizadoRef = pRef.acwp
  // Saldo do direto = valor agregado − pago − a pagar. O a pagar fecha a
  // conta do que foi executado e ainda nao foi pago; zerado, o saldo tende a
  // mostrar economia que e so conta em aberto.
  const comprometido = realizadoRef + aPagarDireto
  const saldoDireto = agregado == null ? null : agregado - comprometido
  const pctDireto = saldoDireto == null || !(agregado > 0) ? null : (saldoDireto / agregado) * 100
  // Total: soma dos dois saldos sobre a soma das duas bases.
  const saldoTotal = saldoDireto == null || saldoIndireto == null ? null : saldoDireto + saldoIndireto
  const baseTotal = (agregado || 0) + indiretoPlan
  const pctTotal = saldoTotal == null || baseTotal <= 0 ? null : (saldoTotal / baseTotal) * 100
  // IPC mensal (decisão out/26): na semana de fechamento (a que termina no
  // último dia do mês), o IPC daquele mês; nas semanas do meio, o do último
  // mês fechado. Avanço e custo até o último dia do mês + contas a pagar do
  // fechamento. Vem pronto da rota (kpis.ipc_mes).
  const ipcMes = dados.kpis.ipc_mes || null
  const idc = ipcMes && ipcMes.ipc != null ? ipcMes.ipc : null
  const nomeMesIpc = ipcMes ? MESES_EXT[Number(ipcMes.mes.slice(5, 7)) - 1] : ''
  const rotuloIpc = !ipcMes ? 'IPC' : ipcMes.semana_de_fechamento ? `IPC do mês · ${nomeMesIpc}` : `IPC de ${nomeMesIpc}`
  const corteIpc = ipcMes ? dm(ipcMes.data_corte) : ''
  // A projeção usa o IPC do mês, então agregado e comprometido também são os
  // do fechamento (mesma data); o IDP continua o da semana.
  const agregadoIpc = ipcMes ? ipcMes.agregado : null
  const comprometidoIpc = ipcMes ? ipcMes.realizado_direto + ipcMes.a_pagar_direto : null
  // IDP pelo avanço físico em Hh, as duas pontas na mesma semana (a da última
  // medição). Em reais, locação (gasto) e funcionários (tempo) entrariam como
  // "avanço" e distorceriam o índice de prazo.
  const fisPlanRef = p.avanco_plan_hh
  const fisRealRef = p.avanco_real_hh
  const idp = fisPlanRef > 0 && fisRealRef != null ? fisRealRef / fisPlanRef : null

  // Projeção do custo direto no término (mesma conta da rota, na semana de
  // referência da tela).
  //   otimista   = realizado + falta ÷ IDC
  //   provável   = otimista + custo de calendário × semanas extras
  //   pessimista = realizado + falta ÷ (IDC × IDP), com o IDP limitado a 1
  const projecao = (() => {
    if (idc == null || idp == null || idc <= 0 || idp <= 0 || agregadoIpc == null) return null
    const orcado = dados.totais.custo_direto
    // Falta = o que ainda nao foi executado, a preco de orcamento.
    const falta = orcado - agregadoIpc
    // Prazo em semanas de 7 dias (o mesmo da rota)
    const duracao = (dados.kpis.projecao && dados.kpis.projecao.duracao_semanas) || dados.curva.length
    const semanasExtras = Math.max(duracao / idp - duracao, 0)
    const porSemana = (dados.kpis.projecao && dados.kpis.projecao.custo_calendario_semana) || 0
    const otimista = comprometidoIpc + falta / idc
    return {
      orcado,
      falta,
      otimista,
      provavel: otimista + porSemana * semanasExtras,
      // Adiantamento não barateia a obra: no pessimista o IDP fica até 1
      // (decisão out/26, mesma regra da rota).
      pessimista: comprometidoIpc + falta / (idc * Math.min(idp, 1)),
      semanasExtras,
      porSemana,
      custoAtraso: porSemana * semanasExtras,
    }
  })()
  // Avanço em Hh. Planejado e realizado na mesma semana: a da ultima medicao
  // (ou a selecionada, se for anterior). Depois da medicao o realizado so
  // repete o ultimo valor, e o planejado continuaria andando.
  const avancoPlan = p.avanco_plan_hh
  const avancoReal = p.avanco_real_hh
  const inicioSem = inicioDe(p)
  const primeira = inicioDe(dados.curva[0])
  const ultima = dados.curva[dados.curva.length - 1].data_fim

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
        <span style={{ font: "500 12px 'IBM Plex Sans'", color: '#8b919c' }}>Mostrar</span>
        <button className={base === 'custo' ? 'btn-primary' : 'btn-sm'} onClick={() => setBase('custo')}>
          Custos
        </button>
        <button className={base === 'hh' ? 'btn-primary' : 'btn-sm'} onClick={() => setBase('hh')}>
          Avanço físico
        </button>
        <span style={{ font: "500 11px 'IBM Plex Sans'", color: '#8b919c' }}>
          avanço físico = horas executadas ÷ {dados.consistencia.hh_total_evm.toLocaleString('pt-BR')} h orçadas (parcela de produção)
        </span>
      </div>

      {/* Linha 1 — custo direto, na mesma ordem do dashboard mensal */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <div
          className="kpi kpi-clickable"
          onClick={() => router.push(`/valor-agregado?semana=${p.semana}`)}
          title={`Serviço executado a preço de orçamento (percentual × custo do item).\nPlanejado pelo cronograma até ${sRef}: ${fmtMoeda(pRef.bcws)}\nClique para ver a memória de cálculo`}
        >
          <div className="kpi-label">Valor Agregado ↗</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: PLAN }}>
            {agregado == null ? '—' : fmtMoeda(agregado)}
          </div>
          <div className="kpi-sub">
            Executado até {sRef}
            {refAtrasada ? ` · medição de ${sMedicao}` : ''}
          </div>
        </div>

        <div
          className="kpi kpi-clickable"
          onClick={() => setAbrirGrupos((v) => !v)}
          title="Ver abertura por grupo"
        >
          <div className="kpi-label">Custo Direto Realizado {abrirGrupos ? '▴' : '▾'}</div>
          <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: REAL }}>
            <span style={PILL}>{fmtMoeda(realizadoRef)}</span>
          </div>
          <div className="kpi-sub">
            {agregado ? `${fmtPerc((comprometido / agregado) * 100)} do executado (pago + a pagar)` : '—'}
            {refAtrasada ? ` · até ${sRef}` : ''}
          </div>
        </div>

        <div
          className="kpi"
          title={
            saldoDireto == null
              ? ''
              : `Executado (valor agregado): ${fmtMoeda(agregado)}\n` +
                `− Pago: ${fmtMoeda(realizadoRef)}\n` +
                `− A pagar: ${fmtMoeda(aPagarDireto)}\n` +
                `= Saldo: ${fmtMoeda(saldoDireto)}\n\n` +
                (contas.disponivel
                  ? `A pagar: vencimentos a partir de ${contas.vencimentos_a_partir_de} · fechamento ${contas.fechamento}.`
                  : 'Contas a pagar ainda não carregado: parte da economia pode ser só conta ainda não paga.')
          }
        >
          <div className="kpi-label">Saldo Custo Direto</div>
          <div
            className="kpi-value"
            style={{
              fontSize: '20px',
              lineHeight: '1.2',
              color: saldoDireto == null ? REAL : saldoDireto >= 0 ? VERDE : VERMELHO,
            }}
          >
            {saldoDireto == null ? '—' : fmtMoeda(saldoDireto)}
          </div>
          <div className="kpi-sub">
            {saldoDireto == null
              ? 'Sem medição'
              : `${saldoDireto >= 0 ? 'Economia' : 'Acima'} · até ${sRef}`}
          </div>
        </div>

        {base === 'custo' ? (
          <div
            className="kpi"
            title={
              pctDireto == null
                ? ''
                : `(Valor agregado − realizado − a pagar) ÷ valor agregado\n` +
                  `(${fmtMoeda(agregado)} − ${fmtMoeda(realizadoRef)} − ${fmtMoeda(aPagarDireto)}) ÷ ${fmtMoeda(agregado)}`
            }
          >
            <div className="kpi-label">% Desvio do Custo Direto</div>
            <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: pctDireto == null ? REAL : pctDireto >= 0 ? VERDE : VERMELHO }}>
              {pctDireto == null ? '—' : `${pctDireto >= 0 ? '+' : ''}${fmtPerc(pctDireto)}`}
            </div>
            <div className="kpi-sub">
              {pctDireto == null ? 'Sem medição' : `${pctDireto >= 0 ? 'Economia' : 'Acima'} sobre o valor agregado · até ${sRef}`}
            </div>
          </div>
        ) : (
          <div className="kpi">
            <div className="kpi-label">{nomeAvanco} · Planejado</div>
            <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>{fmtPerc(avancoPlan)}</div>
            <div className="kpi-sub">Hh planejado ÷ Hh do projeto · em {sSel}</div>
          </div>
        )}

        {base === 'custo' ? (
          <div
            className="kpi"
            title={
              saldoTotal == null
                ? ''
                : `Saldo do direto: ${fmtMoeda(saldoDireto)}\n` +
                  `+ Saldo do indireto: ${fmtMoeda(saldoIndireto)}\n` +
                  `= Saldo total: ${fmtMoeda(saldoTotal)}\n\n` +
                  `% = saldo total ÷ (valor agregado + indireto planejado)`
            }
          >
            <div className="kpi-label">Saldo Total da Obra</div>
            <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: saldoTotal == null ? REAL : saldoTotal >= 0 ? VERDE : VERMELHO }}>
              {saldoTotal == null ? '—' : fmtMoeda(saldoTotal)}
            </div>
            <div className="kpi-sub" style={{ color: pctTotal == null ? undefined : pctTotal >= 0 ? VERDE : VERMELHO }}>
              {pctTotal == null ? 'Sem medição' : `${pctTotal >= 0 ? '+' : ''}${fmtPerc(pctTotal)} · direto + indireto`}
            </div>
          </div>
        ) : (
        <div className="kpi">
          <div className="kpi-label">Desvio Físico</div>
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
            {avancoReal != null && avancoReal >= avancoPlan ? 'Adiantado' : 'Atrasado'} · p.p. do projeto · em {sSel}
            {refAtrasada ? ` · medição de ${sMedicao}` : ''}
          </div>
        </div>
        )}
      </div>

      {/* Linha 2 — custo indireto e avanço físico realizado */}
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

        {base === 'custo' ? (
          <div
            className="kpi"
            title={
              pctIndireto == null
                ? ''
                : `(Indireto planejado − realizado − a pagar) ÷ indireto planejado\n` +
                  `(${fmtMoeda(indiretoPlan)} − ${fmtMoeda(indiretoReal)} − ${fmtMoeda(aPagarIndireto)}) ÷ ${fmtMoeda(indiretoPlan)}`
            }
          >
            <div className="kpi-label">% Desvio do Custo Indireto</div>
            <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: pctIndireto == null ? REAL : pctIndireto >= 0 ? VERDE : VERMELHO }}>
              {pctIndireto == null ? '—' : `${pctIndireto >= 0 ? '+' : ''}${fmtPerc(pctIndireto)}`}
            </div>
            <div className="kpi-sub">
              {pctIndireto == null ? '—' : `${pctIndireto >= 0 ? 'Economia' : 'Acima'} sobre o planejado · até S${String(p.semana).padStart(2, '0')}`}
            </div>
          </div>
        ) : (
          <div
            className="kpi kpi-clickable"
            onClick={() => setAbrirAvanco((v) => !v)}
            title="Ver avanço por grupo"
          >
            <div className="kpi-label">
              {nomeAvanco} · Realizado {abrirAvanco ? '▴' : '▾'}
            </div>
            <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2' }}>
              {avancoReal == null ? '—' : fmtPerc(avancoReal)}
            </div>
            <div className="kpi-sub">
              Hh executado ÷ Hh do projeto · medido até S
              {String(dados.ultima_semana_com_avanco).padStart(2, '0')}
            </div>
          </div>
        )}

        {base === 'custo' && (
          <div
            className="kpi kpi-clickable"
            onClick={() => setAbrirAPagar((v) => !v)}
            title={
              contas.disponivel
                ? `Custo direto a pagar (com NF + previsto sem NF), o mesmo valor que entra no IPC. Vencimentos a partir de ${contas.vencimentos_a_partir_de} · fechamento ${contas.fechamento}.\nIndireto a pagar (fora deste card): ${fmtMoeda(aPagarIndireto)}. Clique para ver todos os títulos.` +
                  (contas.pendente > 0 ? `\nFora da conta: ${fmtMoeda(contas.pendente)} sem EAP (pendente)` : '')
                : `Contas a pagar ainda não carregado: ${contas.motivo || ''}`
            }
          >
            <div className="kpi-label">Custo direto a pagar {abrirAPagar ? '▴' : '▾'}</div>
            <div className="kpi-value" style={{ fontSize: '20px', lineHeight: '1.2', color: '#c9a45c' }}>
              {fmtMoeda(aPagarDireto)}
            </div>
            <div className="kpi-sub">
              {contas.disponivel ? `Vencimentos a partir de ${contas.vencimentos_a_partir_de} · fechamento ${contas.fechamento}` : 'Aguardando a carga do TOTVS'}
            </div>
          </div>
        )}
      </div>

      {/* Linha 3 — projeção do custo direto no término. Fechada: só o orçado;
          aberta: índices e os três cenários. Fórmulas no passar do mouse. */}
      <div
        className="kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: abrirProjecao ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)',
          gap: '16px',
          marginTop: '-10px',
        }}
      >
        <div
          className="kpi kpi-clickable"
          onClick={() => setAbrirProjecao((v) => !v)}
          title={abrirProjecao ? 'Clique para recolher' : 'Clique para ver IDC, IDP e os três cenários'}
        >
          <div className="kpi-label">Projeções de Custo Final {abrirProjecao ? '▴' : '▾'}</div>
          <div className="kpi-sub" style={{ marginTop: 8 }}>
            {abrirProjecao ? `Custo direto no término · ${rotuloIpc} · IDP ${sSel}` : 'Clique para ver as projeções'}
          </div>
        </div>

        {abrirProjecao && (
          <>
            <div
              className="kpi"
              title={
                idc == null
                  ? ''
                  : `${rotuloIpc}: avanço e custo até ${corteIpc}\n` +
                    `IPC = valor agregado ÷ (realizado + a pagar do fechamento)\n` +
                    `= ${fmtMoeda(agregadoIpc)} ÷ (${fmtMoeda(ipcMes.realizado_direto)} + ${fmtMoeda(ipcMes.a_pagar_direto)})\n` +
                    `= ${fmtIdx(idc)}\n\n` +
                    (ipcMes.semana_de_fechamento
                      ? 'Semana de fechamento: IPC do mês.\n'
                      : 'Semana do meio do mês: IPC do último fechamento.\n') +
                    (ipcMes.sem_contas_a_pagar ? 'Mês sem contas a pagar carregado: só o realizado.\n' : '') +
                    'Acima de 1: o executado custou menos que o orçado.\nAbaixo de 1: custou mais.'
              }
            >
              <div className="kpi-label">{rotuloIpc}</div>
              <div className="kpi-value" style={{ fontSize: '18px', lineHeight: '1.2', color: idc == null ? REAL : idc >= 1 ? VERDE : VERMELHO }}>
                {fmtIdx(idc)}
              </div>
              <div className="kpi-sub">{idc == null ? 'Sem medição' : idc >= 1 ? 'Abaixo do orçado' : 'Acima do orçado'} · até {corteIpc}</div>
            </div>

            <div
              className="kpi"
              title={
                idp == null
                  ? ''
                  : `IDP = avanço físico realizado ÷ avanço físico planejado\n` +
                    `(hora-homem, ambos em ${sSel}` +
                    (refAtrasada ? `; realizado acumulado da última medição, ${sMedicao})\n` : ')\n') +
                    `= ${fmtPc2(fisRealRef)} ÷ ${fmtPc2(fisPlanRef)}\n` +
                    `= ${fmtIdx(idp)}\n\n` +
                    'Acima de 1: obra adiantada.\nAbaixo de 1: obra atrasada.'
              }
            >
              <div className="kpi-label">IDP · Eficiência de Prazo</div>
              <div className="kpi-value" style={{ fontSize: '18px', lineHeight: '1.2', color: idp == null ? REAL : idp >= 1 ? VERDE : VERMELHO }}>
                {fmtIdx(idp)}
              </div>
              <div className="kpi-sub">{idp == null ? 'Sem medição' : idp >= 1 ? 'Adiantado' : 'Atrasado'} · em {sSel}</div>
            </div>

            {[
              [
                'Projeção Otimista',
                'otimista',
                projecao &&
                  `Realizado + falta ÷ IDC\n` +
                    `= ${fmtMoeda(comprometidoIpc)} + ${fmtMoeda(projecao.falta)} ÷ ${fmtIdx(idc)}\n` +
                    `(falta = orçado ${fmtMoeda(projecao.orcado)} − agregado ${fmtMoeda(agregadoIpc)}, em ${corteIpc})\n` +
                    `= ${fmtMoeda(projecao.otimista)}\n\n` +
                    'Mantém a eficiência de custo atual até o fim.',
              ],
              [
                'Projeção Realista',
                'provavel',
                projecao &&
                  `Otimista + semanas extras × custo de calendário\n` +
                    `= ${fmtMoeda(projecao.otimista)} + ${projecao.semanasExtras.toFixed(1).replace('.', ',')} sem × ${fmtMoeda(projecao.porSemana)}\n` +
                    `= ${fmtMoeda(projecao.provavel)}\n\n` +
                    `Semanas extras = ${dados.curva.length} ÷ IDP − ${dados.curva.length} (zero se adiantado).\n` +
                    (projecao.semanasExtras === 0 ? 'IDP ≥ 1: sem semanas extras, por isso fica igual ao otimista.\n' : '') +
                    'Custo de calendário = locação + funcionários + indireto que corre a obra toda, por semana.',
              ],
              [
                'Projeção Pessimista',
                'pessimista',
                projecao &&
                  `Realizado + falta ÷ (IDC × IDP, limitado a 1)\n` +
                    `= ${fmtMoeda(comprometidoIpc)} + ${fmtMoeda(projecao.falta)} ÷ (${fmtIdx(idc)} × ${fmtIdx(Math.min(idp, 1))})\n` +
                    `= ${fmtMoeda(projecao.pessimista)}\n\n` +
                    (idp > 1
                      ? `IDP real ${fmtIdx(idp)}: adiantamento não barateia a obra, então aqui o IDP fica em 1.\nCom IDP ≥ 1, este cenário fica igual ao otimista.`
                      : 'Custo e prazo pesam juntos: o atraso encarece o que falta.'),
              ],
            ].map(([nome, chave, formula]) => (
              <div key={chave} className="kpi" title={formula ? `${formula}\n\nOrçado do custo direto: ${fmtMoeda(projecao.orcado)}` : ''}>
                <div className="kpi-label">{nome}</div>
                <div
                  className="kpi-value"
                  style={{
                    fontSize: '18px',
                    lineHeight: '1.2',
                    color: projecao == null ? REAL : projecao[chave] <= projecao.orcado ? VERDE : VERMELHO,
                  }}
                >
                  {projecao == null ? '—' : fmtMoeda(projecao[chave])}
                </div>
                <div className="kpi-sub">
                  {projecao == null
                    ? 'Sem medição'
                    : `${projecao[chave] <= projecao.orcado ? 'Abaixo' : 'Acima'} do orçado em ${fmtMoeda(Math.abs(projecao[chave] - projecao.orcado))}`}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {abrirGrupos && (
        <div className="card">
          <div className="card-title">
            Custo direto por grupo — valor agregado × custo até S{String(p.semana).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 11, color: '#8b919c', margin: '-6px 0 10px' }}>
            Valor agregado pela mesma regra do card (inclusive compra antecipada) · custo = pago + a pagar (base do
            IPC) · estouro / economia = custo − valor agregado: positivo (vermelho) custou mais que o orçado pelo que foi
            executado, negativo (verde) custou menos; o % é sobre o valor agregado
          </div>
          {carregandoGrupos && <div className="loading">Somando os lançamentos da semana...</div>}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRUPO_COLS,
              gap: 12,
              padding: '0 4px 6px',
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8b919c',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span />
            <span>Grupo</span>
            <span style={{ textAlign: 'right' }}>Orçado</span>
            <span style={{ textAlign: 'right' }}>Valor agregado</span>
            <span style={{ textAlign: 'right' }}>Custo (pago + a pagar)</span>
            <span style={{ textAlign: 'right' }}>Estouro / economia</span>
            <span />
          </div>
          {(abertura || []).map((g) => {
            const aberto = grupoAberto === g.grupo
            // Ritmo de gasto vs cronograma: só informação secundária
            const ritmo = g.planejado > 0 ? `ritmo de gasto: ${fmtPerc((g.realizado / g.planejado) * 100)} do planejado` : null
            return (
              <div key={g.grupo} style={{ borderBottom: '1px solid var(--border)' }}>
                <div
                  onClick={() => setGrupoAberto(aberto ? null : g.grupo)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: GRUPO_COLS,
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
                    {g.fora_do_orcamento ? '—' : g.grupo}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{g.nome}</div>
                    <div style={{ fontSize: 11, color: '#8b919c', marginTop: 2 }}>
                      {g.itens.filter(linhaVisivel).length} itens{g.fora_do_orcamento ? '' : ` · M${g.mes_inicio}–M${g.mes_fim}`}
                      {ritmo ? ` · ${ritmo}` : ''}
                    </div>
                  </div>
                  <ColunasValorCusto v={g} />
                  <span style={{ color: '#8b919c', textAlign: 'center' }}>{aberto ? '▴' : '▾'}</span>
                </div>

                {aberto &&
                  (g.por_pavimento ? g.pavimentos || [] : [{ pavimento: null, itens: g.itens }]).map((pv) => (
                    <div key={pv.chave || pv.pavimento || 'geral'}>
                      {pv.pavimento && (() => {
                        // Pavimento no mesmo formato do grupo, recolhido; clicando, abrem as linhas
                        const k = `${g.grupo}|${pv.chave}`
                        const pvAberto = pavAberto.has(k)
                        return (
                          <div
                            onClick={() => alternarPav(k)}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: GRUPO_COLS,
                              gap: 12,
                              alignItems: 'center',
                              padding: '12px 4px',
                              borderTop: '1px solid var(--border)',
                              background: 'var(--bg3)',
                              borderRadius: 6,
                              cursor: 'pointer',
                              marginBottom: pvAberto ? 6 : 0,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 11,
                                color: PLAN,
                                textAlign: 'center',
                              }}
                            >
                              {pv.codigo}
                            </span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, color: PLAN }}>{pv.pavimento}</div>
                              <div style={{ fontSize: 11, color: '#8b919c', marginTop: 2 }}>
                                {pv.itens.filter(linhaVisivel).length} itens
                                {pv.mes_inicio ? ` · M${pv.mes_inicio}–M${pv.mes_fim}` : ''}
                              </div>
                            </div>
                            <ColunasValorCusto v={pv} />
                            <span style={{ color: '#8b919c', textAlign: 'center' }}>{pvAberto ? '▴' : '▾'}</span>
                          </div>
                        )
                      })()}
                      {(!pv.pavimento || pavAberto.has(`${g.grupo}|${pv.chave}`)) && (
                      <table style={{ marginBottom: 10 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 70 }}>EAP</th>
                            <th>Descrição</th>
                            <th style={{ textAlign: 'right', width: 110 }}>Orçado</th>
                            <th
                              style={{ textAlign: 'right', width: 120 }}
                              title="Mesma regra do card de valor agregado: % executado × orçado; aço e material de forma pelo maior entre o avanço do serviço e o custo (compra antecipada); locação pelo gasto até o orçado; funcionários pelo tempo"
                            >
                              Valor agregado
                            </th>
                            <th style={{ textAlign: 'right', width: 110 }}>Pago</th>
                            <th
                              style={{ textAlign: 'right', width: 110 }}
                              title="Contas a pagar do último fechamento (TOTVS), a mesma base do IPC"
                            >
                              A pagar
                            </th>
                            <th
                              style={{ textAlign: 'right', width: 80 }}
                              title="Só nas linhas de material (aço e material de forma): (pago + a pagar) ÷ orçado da linha"
                            >
                              % do orçado
                            </th>
                            <th
                              style={{ textAlign: 'right', width: 120 }}
                              title="(Pago + a pagar) − valor agregado. Positivo = estouro (vermelho), negativo = economia (verde); o % é sobre o valor agregado"
                            >
                              Estouro / economia
                            </th>
                            <th style={{ textAlign: 'right', width: 80 }}>Período</th>
                          </tr>
                        </thead>
                    <tbody>
                      {pv.itens.filter(linhaVisivel).map((i) => {
                        return (
                        <React.Fragment key={i.chave || i.cod_eap}>
                        <tr
                          key={i.cod_eap}
                          onClick={() => setItemAberto(itemAberto === `c${i.cod_eap}|${i.pavimento || ''}` ? null : `c${i.cod_eap}|${i.pavimento || ''}`)}
                          style={{ cursor: (i.lancamentos || []).length ? 'pointer' : 'default' }}
                        >
                          <td style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>{i.cod_eap}</td>
                          <td>
                            {i.descricao}
                            {(i.lancamentos || []).length > 0 && (
                              <span style={{ color: '#8b919c', fontSize: 11, marginLeft: 8 }}>
                                {itemAberto === `c${i.cod_eap}|${i.pavimento || ''}` ? '▴' : '▾'} {i.lancamentos.length} lanç.
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: PLAN }}>
                            {i.planejado_total > 0 ? fmtMoeda(i.planejado_total) : '—'}
                          </td>
                          <td
                            style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}
                            title={i.perc_executado == null ? '' : `${fmtPerc(i.perc_executado)} executado`}
                          >
                            {i.agregado > 0 ? fmtMoeda(i.agregado) : '—'}
                            {i.material_comprado && (
                              <span
                                style={{ display: 'block', fontSize: 10, color: '#8b919c', fontFamily: 'inherit' }}
                                title={`Compra antecipada (material comprado antes da execução): o agregado segue o custo (pago + a pagar, até o orçado), não o avanço do serviço (${fmtMoeda(i.agregado_heranca || 0)})`}
                              >
                                compra antecipada
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                            {i.pago > 0 ? fmtMoeda(i.pago) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: i.a_pagar > 0 ? AMBAR : undefined }}>
                            {i.a_pagar > 0 ? fmtMoeda(i.a_pagar) : '—'}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontFamily: 'var(--mono)',
                              color: i.perc_orcado == null ? '#8b919c' : i.perc_orcado > 100 ? VERMELHO : undefined,
                            }}
                            title={
                              i.perc_orcado == null
                                ? ''
                                : `(pago + a pagar) ÷ orçado
= (${fmtMoeda(i.pago)} + ${fmtMoeda(i.a_pagar || 0)}) ÷ ${fmtMoeda(i.planejado_total)}`
                            }
                          >
                            {i.perc_orcado == null ? '—' : fmtPerc(i.perc_orcado)}
                          </td>
                          <CelulaEstouro agregado={i.agregado} pago={i.pago} aPagar={i.a_pagar} />
                          <td
                            style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: '#8b919c' }}
                          >
                            {i.mes_inicio ? `M${i.mes_inicio}–M${i.mes_fim}` : ''}
                          </td>
                        </tr>
                        {itemAberto === `c${i.cod_eap}|${i.pavimento || ''}` && (i.lancamentos || []).length > 0 && (
                          <tr key={`${i.cod_eap}-det`}>
                            <td colSpan={9} style={{ padding: 0 }}>
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
                  ))}
              </div>
            )
          })}

          {(() => {
            const pg = (somas || dados.consistencia).painel_grupos
            if (!pg) return null
            const ok = (d) => d != null && Math.abs(d) < 1
            const im = pg.ipc_mes
            const mesIpc = im ? MESES_EXT[Number(im.mes.slice(5, 7)) - 1] : ''
            return (
              <div style={{ paddingTop: 14, fontSize: 12, color: '#8b919c', lineHeight: 1.7 }}>
                <div>
                  Soma dos grupos: orçado {fmtMoeda(pg.orcado)} · valor agregado {fmtMoeda(pg.agregado)} · pago{' '}
                  {fmtMoeda(pg.pago)} · a pagar {fmtMoeda(pg.a_pagar)} ·{' '}
                  {(() => {
                    const e = estouroDe(pg.agregado, (pg.pago || 0) + (pg.a_pagar || 0))
                    return (
                      <span title={tituloEstouro(e, pg.agregado, pg.pago, pg.a_pagar)}>
                        {e != null && e.rs > 0.005 ? 'estouro' : 'economia'}{' '}
                        <b style={{ color: corEstouro(e) }}>
                          {e == null ? '—' : `${fmtEstouroRs(e.rs)} (${fmtEstouroPerc(e.perc)})`}
                        </b>
                      </span>
                    )
                  })()}
                </div>
                <div style={{ color: ok(pg.dif_agregado) && ok(pg.dif_custo) ? '#8b919c' : VERMELHO }}>
                  Card de valor agregado: {fmtMoeda(pg.card_agregado)}
                  {ok(pg.dif_agregado) ? ' (bate)' : ` (diferença ${fmtMoeda(pg.dif_agregado)})`} · pago + a pagar do
                  direto: {fmtMoeda(pg.card_pago + pg.card_a_pagar)}
                  {ok(pg.dif_custo) ? ' (bate)' : ` (diferença ${fmtMoeda(pg.dif_custo)})`} · IPC na semana:{' '}
                  {fmtIdx(pg.ipc_semana)}
                </div>
                {im && im.ipc != null && (
                  <div>
                    {im.semana_de_fechamento
                      ? `Semana de fechamento: a soma dos grupos é a base do IPC de ${mesIpc} (${fmtIdx(im.ipc)}, corte ${dm(im.data_corte)}).`
                      : `IPC de ${mesIpc} (corte ${dm(im.data_corte)}): ${fmtIdx(im.ipc)}. O painel está na semana selecionada; ele dá o IPC do mês na semana de fechamento.`}
                  </div>
                )}
              </div>
            )
          })()}
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
                <th style={{ textAlign: 'right', width: 120 }}>Orçado</th>
                <th style={{ textAlign: 'right', width: 120 }}>Realizado</th>
                <th style={{ textAlign: 'right', width: 90 }} title="Realizado ÷ orçado da categoria">
                  % do orçado
                </th>
                <th style={{ textAlign: 'right', width: 130 }}>Planejado até aqui</th>
              </tr>
            </thead>
            <tbody>
              {(indiretos || []).map((i) => {
                const chave = `i${i.cod_eap || i.categoria}`
                const temLanc = (i.lancamentos || []).length > 0
                return (
                  <React.Fragment key={i.cod_eap || i.categoria}>
                  <tr
                    onClick={() => setItemAberto(itemAberto === chave ? null : chave)}
                    style={{ cursor: temLanc ? 'pointer' : 'default' }}
                  >
                    <td style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>{i.cod_eap || '—'}</td>
                    <td>
                      {i.categoria}
                      <span style={{ color: '#8b919c', fontSize: 11, marginLeft: 8 }}>
                        {i.mes_desembolso > 0 ? `M${i.mes_desembolso}` : 'diluído na obra'}
                      </span>
                      {temLanc && (
                        <span style={{ color: '#8b919c', fontSize: 11, marginLeft: 8 }}>
                          {itemAberto === chave ? '▴' : '▾'} {i.lancamentos.length} lanç.
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: PLAN }}>
                      {fmtMoeda(i.planejado_total)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      {i.realizado > 0 ? fmtMoeda(i.realizado) : '—'}
                    </td>
                    {(() => {
                      // Realizado ÷ orçado da categoria; vermelho acima de 100%
                      const pct = i.planejado_total > 0 ? (i.realizado / i.planejado_total) * 100 : null
                      return (
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'var(--mono)',
                            color: pct == null ? '#8b919c' : pct > 100 ? VERMELHO : undefined,
                          }}
                          title={pct == null ? '' : `${fmtMoeda(i.realizado)} ÷ ${fmtMoeda(i.planejado_total)}`}
                        >
                          {pct == null ? '—' : fmtPerc(pct)}
                        </td>
                      )
                    })()}
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: '#8b919c' }}>
                      {i.planejado > 0 ? fmtMoeda(i.planejado) : '—'}
                    </td>
                  </tr>
                  {itemAberto === chave && temLanc && (
                    <tr>
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
                                {l.data
                                  ? l.data.slice(8, 10) + '/' + l.data.slice(5, 7) + '/' + l.data.slice(2, 4)
                                  : l.competencia}
                              </span>
                              <span style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>
                                S{String(l.semana).padStart(2, '0')}
                              </span>
                              <span>{l.fornecedor}</span>
                              <span style={{ color: '#8b919c' }}>{l.historico}</span>
                              <span style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoeda(l.valor)}</span>
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
          <div style={{ paddingTop: 14, fontSize: 12, color: '#8b919c' }}>
            Soma das categorias: planejado {fmtMoeda((somas || dados.consistencia).indiretos_planejado_soma)} ·
            realizado {fmtMoeda((somas || dados.consistencia).indiretos_realizado_soma)}
            {(somas || dados.consistencia).indireto_realizado_sem_categoria > 0 &&
              ` · ${fmtMoeda((somas || dados.consistencia).indireto_realizado_sem_categoria)} lançados em códigos que não existem no planejamento de indiretos`}
          </div>
        </div>
      )}

      {abrirAPagar && (
        <div className="card">
          <div className="card-title">
            Custo direto a pagar — todos os títulos (direto e indireto), vencimentos a partir de {contas.vencimentos_a_partir_de} · fechamento {contas.fechamento}
          </div>
          <ContasAPagarDetalhe />
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
                  ).map((pv) => {
                    // Pavimento no mesmo formato do grupo, recolhido; clicando, abrem as linhas
                    const kPav = `${g.grupo}|${pv.chave}`
                    const pvAberto = !pv.pavimento || pavAvancoAberto.has(kPav)
                    const comNaoIniciados = pavNaoIniciados.has(kPav)
                    const naoIniciados = (pv.itens || []).filter((i) => i.visivel === false).length
                    const linhas = (pv.itens || []).filter((i) => i.visivel !== false || comNaoIniciados)
                    const dPv =
                      pv.perc_planejado != null && pv.perc_realizado != null ? pv.perc_realizado - pv.perc_planejado : null
                    return (
                    <div key={pv.chave || pv.pavimento || 'geral'} style={{ marginBottom: pv.pavimento ? 0 : 10 }}>
                      {pv.pavimento && (
                        <div
                          onClick={() => alternarEm(setPavAvancoAberto)(kPav)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '38px 1fr 110px 110px 110px 90px 28px',
                            gap: 12,
                            alignItems: 'center',
                            padding: '12px 4px',
                            borderTop: '1px solid var(--border)',
                            background: 'var(--bg3)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            marginBottom: pvAberto ? 6 : 0,
                          }}
                        >
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: PLAN, textAlign: 'center' }}>
                            {pv.codigo}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: PLAN }}>{pv.pavimento}</div>
                            <div style={{ fontSize: 11, color: '#8b919c', marginTop: 2 }}>
                              {pv.em_curso} em curso · {pv.hh_real.toLocaleString('pt-BR')} h de{' '}
                              {pv.hh_total.toLocaleString('pt-BR')} h
                              {naoIniciados > 0 ? ` · ${naoIniciados} não iniciados` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                            <div style={{ color: PLAN }}>{fmtPerc(pv.perc_planejado)}</div>
                            <div style={{ fontSize: 10, color: '#8b919c' }}>planejado</div>
                          </div>
                          <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                            <div>{fmtPerc(pv.perc_realizado)}</div>
                            <div style={{ fontSize: 10, color: '#8b919c' }}>realizado</div>
                          </div>
                          <div
                            style={{
                              textAlign: 'right',
                              fontFamily: 'var(--mono)',
                              color: dPv == null ? '#8b919c' : dPv < 0 ? VERMELHO : VERDE,
                            }}
                          >
                            <div>{dPv == null ? '—' : `${dPv > 0 ? '+' : ''}${dPv.toFixed(1).replace('.', ',')} p.p.`}</div>
                            <div style={{ fontSize: 10, color: '#8b919c' }}>desvio</div>
                          </div>
                          <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: '#8b919c', fontSize: 11 }}>
                            {fmtPerc(pv.peso)} do Hh
                          </div>
                          <span style={{ color: '#8b919c', textAlign: 'center' }}>{pvAberto ? '▴' : '▾'}</span>
                        </div>
                      )}
                      {pvAberto && pv.pavimento && naoIniciados > 0 && (
                        <div style={{ textAlign: 'right', margin: '0 0 6px' }}>
                          <button className="btn-sm" onClick={() => alternarEm(setPavNaoIniciados)(kPav)}>
                            {comNaoIniciados
                              ? 'Ocultar não iniciados'
                              : `Mostrar ${naoIniciados} não iniciados (para lançar medição)`}
                          </button>
                        </div>
                      )}
                      {pvAberto && linhas.length > 0 && (
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
                          {linhas.map((i) => {
                            const d = i.perc_realizado - i.perc_planejado
                            return (
                              <React.Fragment key={i.chave || i.cod_eap}>
                                <tr
                                  onClick={() =>
                                    setItemAberto(itemAberto === `a${i.chave || i.cod_eap}` ? null : `a${i.chave || i.cod_eap}`)
                                  }
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td style={{ fontFamily: 'var(--mono)', color: '#8b919c' }}>{i.cod_eap}</td>
                                  <td>
                                    {i.descricao}
                                    {i.medicao_por_pavimento && (
                                      <span
                                        style={{ color: PLAN, fontSize: 11, marginLeft: 8 }}
                                        title="Código repetido por pavimento: a medição vale só para a linha deste pavimento"
                                      >
                                        {i.pavimento} pav
                                      </span>
                                    )}
                                    <span style={{ color: '#8b919c', fontSize: 11, marginLeft: 8 }}>
                                      {itemAberto === `a${i.chave || i.cod_eap}` ? '▴' : '▾'}{' '}
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
                                {itemAberto === `a${i.chave || i.cod_eap}` && (
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
                                              exigirSenha(() =>
                                                salvarMedicao(i.cod_eap, editando, i.medicao_por_pavimento ? i.pavimento : null)
                                              )
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
                      )}
                    </div>
                    )
                  })}
              </div>
            )
          })}
          <div style={{ paddingTop: 14, fontSize: 12, color: '#8b919c' }}>
            Só a parcela de produção (grupos com entra_evm). Locação e funcionários não medem avanço físico.
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Curva S — físico e financeiro</div>
        <CurvaS
          curva={dados.curva}
          semana={p.semana}
          ultMed={dados.ultima_semana_com_avanco || p.semana}
          onPick={setSemana}
          aPagar={(dados.kpis.ipc_fechamento && dados.kpis.ipc_fechamento.a_pagar_direto) || 0}
          semFech={dados.kpis.ipc_fechamento ? dados.kpis.ipc_fechamento.semana_do_corte : null}
          mesFech={dados.kpis.ipc_fechamento ? dados.kpis.ipc_fechamento.mes : null}
        />
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
    </div>
  )
}

/* ─── PAINEL DE CUSTO DIRETO POR GRUPO ───────────────────────── */
// Linha de título do orçamento (orçado zero, sem custo e sem agregado) não
// aparece na tela; continua nas somas, onde não altera nada.
const linhaVisivel = (i) => i.planejado_total > 0.005 || Math.abs(i.custo || 0) > 0.005 || (i.agregado || 0) > 0.005

// Estouro / economia = custo (pago + a pagar) − valor agregado. Positivo =
// estouro (vermelho), negativo = economia (verde); o % é sobre o valor
// agregado. Sem valor agregado e sem custo: null ("—"). A eficiência
// (agregado ÷ custo) fica só no texto ao passar o mouse.
function estouroDe(agregado, custo) {
  const ag = agregado || 0
  const c = custo || 0
  if (ag <= 0.005 && c <= 0.005) return null
  const rs = c - ag
  return { rs, perc: ag > 0.005 ? (rs / ag) * 100 : null, ef: ag > 0.005 && c > 0.005 ? ag / c : null }
}
const corEstouro = (e) => (e == null || Math.abs(e.rs) < 0.005 ? '#8b919c' : e.rs > 0 ? VERMELHO : VERDE)
const fmtEstouroRs = (rs) => (rs > 0.005 ? '+' : '') + fmtMoeda(Math.abs(rs) < 0.005 ? 0 : rs)
const fmtEstouroPerc = (p) => (p == null ? '—' : `${p > 0.05 ? '+' : ''}${p.toFixed(1).replace('.', ',')}%`)
const tituloEstouro = (e, agregado, pago, aPagar) =>
  e == null
    ? 'Sem valor agregado e sem custo'
    : `(Pago + a pagar) − valor agregado\n= (${fmtMoeda(pago || 0)} + ${fmtMoeda(aPagar || 0)}) − ${fmtMoeda(agregado || 0)}` +
      `\nEficiência (valor agregado ÷ custo): ${e.ef == null ? '—' : fmtIdx(e.ef)}`

// Célula da tabela de itens: R$ em cima, % embaixo
function CelulaEstouro({ agregado, pago, aPagar }) {
  const e = estouroDe(agregado, (pago || 0) + (aPagar || 0))
  return (
    <td
      style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: corEstouro(e) }}
      title={tituloEstouro(e, agregado, pago, aPagar)}
    >
      {e == null ? '—' : fmtEstouroRs(e.rs)}
      {e != null && <span style={{ display: 'block', fontSize: 10 }}>{fmtEstouroPerc(e.perc)}</span>}
    </td>
  )
}

// Orçado, valor agregado, custo (pago + a pagar) e estouro / economia de um
// grupo ou pavimento: quatro células do grid GRUPO_COLS.
function ColunasValorCusto({ v, compacto }) {
  const fs = compacto ? 12 : 13
  const sub = { fontSize: 10, color: '#8b919c' }
  return (
    <>
      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: fs }}>
        <div>{fmtMoeda(v.orcado || 0)}</div>
        {!compacto && <div style={sub}>orçado</div>}
      </div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: fs }}>
        <div style={{ color: PLAN }}>{v.agregado > 0 ? fmtMoeda(v.agregado) : '—'}</div>
        {v.agregado > 0 && v.orcado > 0 && <div style={sub}>{fmtPerc((v.agregado / v.orcado) * 100)} do orçado</div>}
      </div>
      <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: fs }}>
        <div>{v.custo > 0 ? fmtMoeda(v.custo) : '—'}</div>
        {v.custo > 0 && <div style={sub}>pago {fmtMoeda(v.pago || 0)}</div>}
        {v.a_pagar > 0 && <div style={{ ...sub, color: AMBAR }}>a pagar {fmtMoeda(v.a_pagar)}</div>}
      </div>
      <BarraEstouro v={v} fs={fs} />
    </>
  )
}

// Estouro / economia com barra divergente: marca no zero, economia (verde)
// para a esquerda, estouro (vermelho) para a direita; escala de ±50% do
// valor agregado (estouro sem valor agregado enche a barra).
function BarraEstouro({ v, fs }) {
  const e = estouroDe(v.agregado, (v.pago || 0) + (v.a_pagar || 0))
  const cor = corEstouro(e)
  const frac = e == null ? 0 : e.perc == null ? 1 : Math.min(Math.abs(e.perc), 50) / 50
  const estouro = e != null && e.rs > 0
  return (
    <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }} title={tituloEstouro(e, v.agregado, v.pago, v.a_pagar)}>
      <div style={{ fontSize: fs, color: cor }}>{e == null ? '—' : fmtEstouroRs(e.rs)}</div>
      {e != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginTop: 3 }}>
          <span style={{ fontSize: 10, color: cor }}>{fmtEstouroPerc(e.perc)}</span>
          <span style={{ position: 'relative', width: 70, height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
            <span
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                [estouro ? 'left' : 'right']: '50%',
                width: `${frac * 50}%`,
                background: cor,
              }}
            />
            <span style={{ position: 'absolute', left: '50%', top: -1, bottom: -1, width: 1, background: 'var(--text2)' }} />
          </span>
        </div>
      )}
    </div>
  )
}

/* ─── CURVA S SEMANAL (mesmo layout do Sirius 60) ───────────── */
const fmtK = (v) =>
  Math.abs(v) >= 1e6 ? `R$ ${(v / 1e6).toFixed(2).replace('.', ',')}M` : `R$ ${Math.round(v / 1000)}k`
const fmtPc2 = (v) => `${v.toFixed(2).replace('.', ',')}%`
const fmtPcEixo = (v) => `${Number(v.toFixed(1)).toString().replace('.', ',')}%`

// Faixa "redonda" para o eixo: 4 intervalos de 1, 2, 2,5 ou 5 × 10^n que
// cobrem [min, max] dos valores visíveis.
function faixaDoEixo(min, max, padrao) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return padrao
  if (max - min < 1e-9) {
    const folga = Math.max(Math.abs(max) * 0.05, padrao[1] * 0.01)
    min -= folga
    max += folga
  }
  const bruto = (max - min) / 4
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)))
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => Math.ceil(max / p) - Math.floor(min / p) <= 4) || 10 * pot
  let lo = Math.floor(min / passo) * passo
  if (lo < 0 && min >= 0) lo = 0
  return [lo, lo + 4 * passo]
}

// Data ISO + n meses (dia limitado ao fim do mês)
const somarMeses = (s, n) => {
  const [y, m, d] = iso(s).split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1))
  const fim = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, fim))
  return alvo.toISOString().slice(0, 10)
}

// aPagar: contas a pagar do direto do último fechamento; semFech: semana do
// fechamento (a que contém o último dia do mês fechado).
function CurvaS({ curva, semana, ultMed, onPick, aPagar = 0, semFech = null, mesFech = null }) {
  const W = 900, H = 340, PADL = 52, PADR = 66, PADT = 26, PADB = 40
  const n = curva.length
  const [hover, setHover] = useState(null)
  const [ocultas, setOcultas] = useState({})
  // Trecho visível: modo dos botões ('atual', '3m', 'toda') ou faixa arrastada
  const [zoom, setZoom] = useState({ modo: '3m' })
  const [arraste, setArraste] = useState(null)

  // Realizado (físico, valor agregado e custo) termina na semana selecionada;
  // o planejado vai até o fim da obra.
  const ate = (c) => c.semana <= semana
  // Valor agregado na regua de custo, igual ao card, so ate a ultima medicao.
  const va = (c) =>
    !ate(c) || c.semana > ultMed || c.bcwp_a_custo == null ? null : c.bcwp_a_custo + (c.bcwp_b || 0) + (c.bcwp_c || 0)
  const pontos = curva.map((c) => {
    const cr = c.medido && ate(c) ? c.acwp : null
    return {
      semana: c.semana,
      data_inicio: c.data_inicio,
      data_fim: c.data_fim,
      // Físico sempre em Hh (horas executadas ÷ horas orçadas)
      fp: c.avanco_plan_hh,
      fr: c.medido && ate(c) ? c.avanco_real_hh : null,
      vp: c.bcws,
      va: va(c),
      cr,
      // Comprometido = pago + contas a pagar do último fechamento, a partir da
      // semana do fechamento; antes dela coincide com o pago. Na semana do
      // fechamento é o custo do IPC.
      cc: cr == null ? null : semFech != null && c.semana >= semFech ? cr + aPagar : cr,
    }
  })

  const series = [
    { id: 'fp', nome: 'Físico planejado', cor: '#5B9BD5', campo: 'fp', dash: '5,4', tipo: 'pct' },
    { id: 'fr', nome: 'Físico realizado', cor: '#4D9B6A', campo: 'fr', dash: null, tipo: 'pct' },
    { id: 'vp', nome: 'Valor planejado (VP)', cor: '#C9B38A', campo: 'vp', dash: '5,4', tipo: 'rs' },
    { id: 'va', nome: 'Valor agregado (VA)', cor: '#E8B04B', campo: 'va', dash: null, tipo: 'rs' },
    { id: 'cr', nome: 'Custo pago', cor: '#D9734E', campo: 'cr', dash: null, tipo: 'rs' },
    { id: 'cc', nome: 'Custo comprometido (pago + a pagar)', cor: '#B05A8C', campo: 'cc', dash: '2,3', tipo: 'rs' },
  ]
  const visiveis = series.filter((sr) => !ocultas[sr.id])

  // Índices do trecho visível
  const iSel = Math.max(0, pontos.findIndex((m) => m.semana === semana))
  const [i0, i1] = (() => {
    if (zoom.modo === 'faixa') return [zoom.i0, zoom.i1]
    if (zoom.modo === 'toda') return [0, n - 1]
    if (zoom.modo === 'atual') return [0, Math.max(iSel, 1)]
    const ref = pontos[iSel].data_fim
    const de = somarMeses(ref, -3)
    const ateData = somarMeses(ref, 3)
    let a = pontos.findIndex((m) => iso(m.data_fim) >= de)
    let b = pontos.length - 1 - [...pontos].reverse().findIndex((m) => iso(m.data_fim) <= ateData)
    if (a < 0) a = 0
    if (b < a + 1) b = Math.min(n - 1, a + 1)
    return [a, b]
  })()
  const span = Math.max(i1 - i0, 1)

  // Eixos ajustados ao trecho visível (só as séries ligadas)
  const faixa = (tipo, padrao) => {
    let min = Infinity
    let max = -Infinity
    visiveis
      .filter((sr) => sr.tipo === tipo)
      .forEach((sr) => {
        for (let i = i0; i <= i1; i += 1) {
          const v = pontos[i][sr.campo]
          if (v == null) continue
          min = Math.min(min, v)
          max = Math.max(max, v)
        }
      })
    return faixaDoEixo(min, max, padrao)
  }
  const maxFinObra = Math.max(...pontos.map((m) => Math.max(m.vp || 0, m.va || 0, m.cr || 0, m.cc || 0)), 1)
  const [pLo, pHi] = faixa('pct', [0, 100])
  const [rLo, rHi] = faixa('rs', [0, maxFinObra])

  const x = (i) => PADL + ((i - i0) / span) * (W - PADL - PADR)
  const yPct = (v) => H - PADB - ((v - pLo) / (pHi - pLo || 1)) * (H - PADT - PADB)
  const yFin = (v) => H - PADB - ((v - rLo) / (rHi - rLo || 1)) * (H - PADT - PADB)
  const esc = (sr) => (sr.tipo === 'pct' ? yPct : yFin)

  const linha = (campo, f) => {
    let d = ''
    for (let i = i0; i <= i1; i += 1) {
      const v = pontos[i][campo]
      if (v == null) continue
      d += (d === '' ? 'M' : 'L') + x(i).toFixed(1) + ',' + f(v).toFixed(1)
    }
    return d
  }

  function alternar(id) {
    const nova = { ...ocultas, [id]: !ocultas[id] }
    if (series.every((sr) => nova[sr.id])) return // nunca deixa o grafico vazio
    setOcultas(nova)
  }
  const mostrarSo = (ids) => {
    const o = {}
    series.forEach((sr) => {
      if (!ids.includes(sr.id)) o[sr.id] = true
    })
    setOcultas(o)
  }

  const indiceDo = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    if (px < PADL - 10 || px > W - PADR + 10) return null
    const i = i0 + Math.round(((px - PADL) / (W - PADL - PADR)) * span)
    return Math.max(i0, Math.min(i, i1))
  }

  const h = hover != null ? pontos[hover] : null
  // Saldo = valor agregado − custo comprometido (pago + a pagar), a base do IPC
  const saldo = h && h.va != null && h.cc != null ? h.va - h.cc : null
  const passoRotulo = span > 60 ? 8 : span > 30 ? 4 : span > 14 ? 2 : 1
  const ticks = [0, 1, 2, 3, 4]

  const botaoZoom = (rotulo, modo) => (
    <button
      key={modo}
      className="btn-sm"
      onClick={() => setZoom({ modo })}
      style={zoom.modo === modo ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}
    >
      {rotulo}
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        {botaoZoom('Até a semana atual', 'atual')}
        {botaoZoom('± 3 meses', '3m')}
        {botaoZoom('Obra toda', 'toda')}
        {zoom.modo !== '3m' && (
          <button className="btn-sm" onClick={() => setZoom({ modo: '3m' })}>
            Voltar ao normal
          </button>
        )}
        <span className="kpi-sub" style={{ marginLeft: 'auto' }}>
          S{pontos[i0].semana}–S{pontos[i1].semana} · arraste sobre o gráfico para ampliar um trecho
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', cursor: arraste ? 'col-resize' : 'crosshair', userSelect: 'none' }}
        onMouseDown={(e) => {
          const i = indiceDo(e)
          if (i != null) setArraste({ de: i, ate: i })
        }}
        onMouseMove={(e) => {
          const i = indiceDo(e)
          setHover(i)
          if (arraste && i != null) setArraste({ ...arraste, ate: i })
        }}
        onMouseLeave={() => {
          setHover(null)
          setArraste(null)
        }}
        onMouseUp={(e) => {
          const i = indiceDo(e)
          const a = arraste
          setArraste(null)
          if (!a) return
          const fim = i == null ? a.ate : i
          const lo = Math.min(a.de, fim)
          const hi = Math.max(a.de, fim)
          // Arrasto de 2 semanas ou mais amplia; clique simples vai à semana
          if (hi - lo >= 2) setZoom({ modo: 'faixa', i0: lo, i1: hi })
          else if (onPick) onPick(pontos[a.de].semana)
        }}
      >
        {ticks.map((k) => {
          const vp = pLo + ((pHi - pLo) * k) / 4
          const vr = rLo + ((rHi - rLo) * k) / 4
          const y = H - PADB - (k / 4) * (H - PADT - PADB)
          return (
            <g key={k}>
              <line x1={PADL} y1={y} x2={W - PADR} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={PADL - 8} y={y + 3} fill="var(--text3)" fontSize="9" textAnchor="end">
                {fmtPcEixo(vp)}
              </text>
              <text x={W - PADR + 8} y={y + 3} fill="var(--text3)" fontSize="9">
                {fmtK(vr)}
              </text>
            </g>
          )
        })}
        {pontos.map(
          (m, i) =>
            i >= i0 &&
            i <= i1 &&
            (m.semana % passoRotulo === 0 || m.semana === 1) && (
              <text key={i} x={x(i)} y={H - PADB + 15} fill="var(--text3)" fontSize="8" textAnchor="middle">
                S{m.semana}
              </text>
            )
        )}

        {iSel >= i0 && iSel <= i1 && (
          <g>
            <line x1={x(iSel)} y1={PADT - 10} x2={x(iSel)} y2={H - PADB}
                  stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5,4" />
            <text x={x(iSel)} y={PADT - 14} fill="var(--accent)" fontSize="9" textAnchor="middle" fontWeight="bold">
              S{semana}
            </text>
          </g>
        )}

        <clipPath id="curva-s-area">
          <rect x={PADL} y={PADT - 12} width={W - PADL - PADR} height={H - PADT - PADB + 12} />
        </clipPath>
        <g clipPath="url(#curva-s-area)">
          {/* comprometido por baixo: antes do fechamento ele coincide com o pago */}
          {[...visiveis].sort((p, q) => (q.id === 'cc') - (p.id === 'cc')).map((sr) => (
            <path key={sr.id} d={linha(sr.campo, esc(sr))} fill="none" stroke={sr.cor} strokeWidth="2"
                  strokeDasharray={sr.dash || 'none'} opacity={sr.dash === '5,4' ? 0.62 : 1}
                  strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </g>

        {arraste && arraste.ate !== arraste.de && (
          <rect
            x={Math.min(x(arraste.de), x(arraste.ate))}
            y={PADT - 10}
            width={Math.abs(x(arraste.ate) - x(arraste.de))}
            height={H - PADB - PADT + 10}
            fill="var(--accent)"
            opacity="0.12"
          />
        )}

        {h && (
          <g>
            <line x1={x(hover)} y1={PADT - 10} x2={x(hover)} y2={H - PADB}
                  stroke="var(--text3)" strokeWidth="1" opacity=".55" />
            {visiveis.map((sr) =>
              h[sr.campo] == null ? null : (
                <circle key={sr.id} cx={x(hover)} cy={esc(sr)(h[sr.campo])} r="3.5"
                        fill={sr.cor} stroke="var(--bg)" strokeWidth="1.5" />
              )
            )}
          </g>
        )}
      </svg>

      {/* leitura da semana sob o cursor */}
      <div style={{ minHeight: 62, marginTop: 4 }}>
        {h ? (
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center', padding: '10px 14px',
                        background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--border)' }}>
            <div style={{ font: '600 12px var(--mono)', color: 'var(--accent)' }}>
              S{String(h.semana).padStart(2, '0')} · {dm(inicioDe(h))} a {dm(h.data_fim)}
            </div>
            {visiveis.map((sr) => (
              <div key={sr.id}>
                <div className="kpi-sub">{sr.nome}</div>
                <div style={{ font: '600 13px var(--mono)', color: sr.cor }}>
                  {h[sr.campo] == null ? '—' : sr.tipo === 'pct' ? fmtPc2(h[sr.campo]) : fmtMoeda(h[sr.campo])}
                </div>
              </div>
            ))}
            {saldo != null && (
              <div>
                <div className="kpi-sub">Saldo (VA − comprometido)</div>
                <div style={{ font: '600 13px var(--mono)', color: saldo >= 0 ? VERDE : VERMELHO }}>
                  {fmtMoeda(saldo)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="kpi-sub" style={{ textAlign: 'center', padding: '14px 0' }}>
            Passe o mouse sobre o gráfico para ver os valores de cada semana · clique para ir à semana · arraste
            para ampliar.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' }}>
        {series.map((sr) => {
          const off = ocultas[sr.id]
          return (
            <button key={sr.id} onClick={() => alternar(sr.id)}
              title={off ? 'clique para mostrar' : 'clique para ocultar'}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, padding: '5px 11px',
                       borderRadius: 7, cursor: 'pointer',
                       background: off ? 'transparent' : 'var(--bg3)',
                       border: '1px solid ' + (off ? 'var(--border)' : 'var(--border2)'),
                       color: off ? 'var(--text3)' : 'var(--text2)', opacity: off ? 0.5 : 1 }}>
              <svg width="20" height="3">
                <line x1="0" y1="1.5" x2="20" y2="1.5" stroke={off ? 'var(--text3)' : sr.cor}
                      strokeWidth="2.5" strokeDasharray={sr.dash || 'none'} />
              </svg>
              {sr.nome}
            </button>
          )
        })}
      </div>

      {/* atalhos de comparacao */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, justifyContent: 'center' }}>
        {[
          ['Todas', ['fp', 'fr', 'vp', 'va', 'cr', 'cc']],
          ['Só físico', ['fp', 'fr']],
          ['Só financeiro', ['vp', 'va', 'cr', 'cc']],
          ['Agregado × realizado', ['va', 'cr', 'cc']],
          ['Agregado × comprometido', ['va', 'cc']],
          ['Só planejado', ['fp', 'vp']],
          ['Só realizado', ['fr', 'cr', 'cc']],
        ].map(([l, ids]) => {
          const ativo = series.every((sr) => (ids.includes(sr.id) ? !ocultas[sr.id] : !!ocultas[sr.id]))
          return (
            <button key={l} className="btn-sm" onClick={() => mostrarSo(ids)}
              style={ativo ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>
              {l}
            </button>
          )
        })}
      </div>

      <div className="kpi-sub" style={{ marginTop: 12, textAlign: 'center' }}>
        Eixo esquerdo: avanço físico. Eixo direito: custo direto acumulado. As linhas de realizado terminam na
        semana selecionada (S{semana}); o planejado vai até o fim da obra. Custo comprometido = pago + contas a pagar
        do direto do último fechamento
        {semFech != null ? ` (${mesFech ? rotuloMes(`${mesFech}-01`) + ', ' : ''}a partir da S${semFech}: ${fmtMoeda(aPagar)})` : ''}
        ; antes do fechamento coincide com o pago e, na semana do fechamento, é o custo do IPC. Os eixos se ajustam ao
        trecho visível.
      </div>
    </div>
  )
}
