import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// /api/dashboard-semanal
//
// EVM semanal das Flats Pampulha. O custo direto e medido em tres parcelas:
//
//   A  grupos 1-16 (entra_evm = true)  hora-homem              R$ 2.793.442,79
//   B  grupo 17 (locacao)              custo incorrido limitado R$   313.367,06
//   C  grupo 18 (funcionarios)         tempo decorrido          R$   356.776,00
//                                                        total R$ 3.463.585,85
//
// O BCWP da parcela A ja vem pronto da view v_avanco_semanal_realizado, em
// bcwp_a_acum, com forward fill do ultimo retrato por item. Esta rota nao
// recalcula Hh, nao rateia matriz x orcamento e nao importa lib/cronograma-hh:
// a base de horas (30.301,2 h) vive no banco, num lugar so.
//
// Nao ha catraca aqui. Se um retrato revisa um item para baixo, o BCWP cai.
// ---------------------------------------------------------------------------

// Nomes de coluna em um lugar so. Se o schema divergir, corrige aqui.
const COLS = {
  curva: {
    table: 'curva_s_semanal_planejada',
    semana: 'semana_numero',
    mes: 'mes_numero',
    bcwsA: 'parcela_a_acum',
    bcwsB: 'parcela_b_acum',
    bcwsC: 'parcela_c_acum',
    // conferencia: total das tres parcelas gravado na propria tabela
    totalAcum: 'custo_evm_acum',
    financeiro: 'financeiro_acum',
    percHh: 'perc_hh_acum',
  },
  realizado: {
    table: 'v_avanco_semanal_realizado',
    semana: 'semana_numero',
    bcwpA: 'bcwp_a_acum',
    hhAcum: 'hh_acumulado',
    dataInicio: 'data_inicio',
    dataFim: 'data_fim',
  },
}

// A curva planejada nao tem coluna de data: o calendario sai da view do
// realizado e e extrapolado a 7 dias por semana para as 87. Se a obra tiver
// semana fora do padrao, a extrapolacao mente — o certo e a curva ter as
// colunas de data tambem.
const addDias = (iso, n) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  // Date.UTC na entrada e toISOString na saida: tudo em UTC, sem passar pelo
  // fuso local. E a mesma armadilha das linhas 46-52 do dashboard-integrado.
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10)
}

// Base de medicao da parcela A.
//   'hh'    BCWP = hh_acumulado / Hh_total_evm x custo_total_A
//   'custo' BCWP = bcwp_a_acum da view (percentual x custo do item)
// A curva planejada distribui o BCWS por hora-homem, entao 'hh' deixa as duas
// pontas na mesma regua. Itens sem Hh (concreto usinado, aco comprado pronto)
// nao somam avanco proprio: o valor deles e apropriado conforme as atividades
// com mao de obra andam. O dinheiro nao se perde — muda o momento.
const BASE_PARCELA_A = 'custo'

// true  = as colunas bcws_* da curva ja sao acumuladas
// false = sao incrementos semanais e a rota acumula
const BCWS_JA_ACUMULADO = true

// Parcela B: alem do teto por item (preco_total), limitar tambem ao BCWS_B da
// semana, impedindo que a locacao apareca adiantada em relacao ao cronograma.
// Hoje o dashboard mensal so aplica o teto por item; deixo em false para o
// comportamento nao mudar sem voce decidir.
const LIMITAR_B_AO_PLANEJADO_DA_SEMANA = false

const TOTAL_SEMANAS = 87

// Grupos cujo servico se repete andar a andar e o cronograma acompanha por
// pavimento. Os demais sao lista unica, mesmo tendo pavimento no cadastro:
// reboco, instalacoes, gesso e pisos sao tocados como frente geral.
const GRUPOS_POR_PAVIMENTO = new Set([3, 4])

// Valores de referencia so para o bloco de consistencia da resposta.
const ESPERADO = { a: 2793442.79, b: 313367.06, c: 356776.0 }

const iso10 = (v) => String(v || '').slice(0, 10)

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
const r2 = (v) => parseFloat((Number(v) || 0).toFixed(2))
const r3 = (v) => parseFloat((Number(v) || 0).toFixed(3))

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const semanaQuery = req.query.semana ? parseInt(req.query.semana, 10) : null

  try {
    const [curvaRes, realizadoRes, orcamentoRes, indiretoRes, retratosRes, custosRes] = await Promise.all([
      supabase
        .from(COLS.curva.table)
        .select('*')
        .eq('obra_id', obra_id)
        .order(COLS.curva.semana),
      supabase
        .from(COLS.realizado.table)
        .select('*')
        .eq('obra_id', obra_id)
        .order(COLS.realizado.semana),
      supabase
        .from('orcamento_planejado')
        .select('*')
        .eq('obra_id', obra_id),
      supabase
        .from('custos_indiretos_planejados')
        .select('cod_eap, categoria, valor_total, mes_desembolso')
        .eq('obra_id', obra_id),
      supabase
        .from('avanco_fisico_historico')
        .select('id, codigo_eap, percentual_realizado, semana_numero, data_lancamento')
        .eq('obra_id', obra_id)
        .not('semana_numero', 'is', null)
        .order('semana_numero'),
      supabase
        .from('custos_lancamentos')
        .select('codigo_eap, data_emissao, data_vencimento, valor, status, competencia, fornecedor, historico, classificacao')
        .eq('obra_id', obra_id)
        .order('data_emissao'),
    ])

    // Ao contrario das linhas 34-38 do dashboard-integrado, toda resposta e
    // checada: dado parcial silencioso em EVM vira SPI errado, nao vira grafico
    // com um buraco.
    const respostas = [
      [COLS.curva.table, curvaRes],
      [COLS.realizado.table, realizadoRes],
      ['orcamento_planejado', orcamentoRes],
      ['custos_indiretos_planejados', indiretoRes],
      ['avanco_fisico_historico', retratosRes],
      ['custos_lancamentos', custosRes],
    ]
    for (const [nome, r] of respostas) {
      if (r.error) throw new Error(`${nome}: ${r.error.message}`)
      if (!r.data || r.data.length === 0) throw new Error(`${nome}: sem linhas para obra_id=${obra_id}`)
    }

    const curvaRaw = curvaRes.data
    const realizadoRaw = realizadoRes.data
    const orcamento = orcamentoRes.data
    const indiretos = indiretoRes.data
    const retratos = retratosRes.data
    const lancamentos = custosRes.data

    // -----------------------------------------------------------------------
    // 1. Planejado: BCWS acumulado das tres parcelas, semana a semana
    // -----------------------------------------------------------------------
    const C = COLS.curva
    let accA = 0
    let accB = 0
    let accC = 0
    const plan = new Map()
    const semanasOrdenadas = []

    curvaRaw
      .slice()
      .sort((x, y) => num(x[C.semana]) - num(y[C.semana]))
      .forEach((row) => {
        const s = parseInt(row[C.semana], 10)
        if (!Number.isFinite(s)) return
        if (BCWS_JA_ACUMULADO) {
          accA = num(row[C.bcwsA])
          accB = num(row[C.bcwsB])
          accC = num(row[C.bcwsC])
        } else {
          accA += num(row[C.bcwsA])
          accB += num(row[C.bcwsB])
          accC += num(row[C.bcwsC])
        }
        plan.set(s, { semana: s, data_fim: null, a: accA, b: accB, c: accC, total_tabela: num(row[C.totalAcum]), financeiro: num(row[C.financeiro]), perc_hh: num(row[C.percHh]), mes: parseInt(row[C.mes], 10) || null })
        semanasOrdenadas.push(s)
      })

    const ultimaSemana = semanasOrdenadas.length ? semanasOrdenadas[semanasOrdenadas.length - 1] : 0
    const fimDaCurva = plan.get(ultimaSemana)
    const totais = {
      a: fimDaCurva ? fimDaCurva.a : 0,
      b: fimDaCurva ? fimDaCurva.b : 0,
      c: fimDaCurva ? fimDaCurva.c : 0,
    }
    totais.total = totais.a + totais.b + totais.c

    // -----------------------------------------------------------------------
    // 2. Parcela A realizada: pronta da view
    // -----------------------------------------------------------------------
    // Base de horas da parcela A: mesma definicao do CTE "itens" da view
    // (orcamento_planejado com entra_evm). Sai do banco, nao e constante.
    const totalHhEvm = orcamento.reduce(
      (soma, it) => (it.entra_evm ? soma + num(it.hh) : soma),
      0
    )
    if (BASE_PARCELA_A === 'hh' && totalHhEvm <= 0) {
      throw new Error('orcamento_planejado: soma de hh com entra_evm = 0; sem base de horas nao da para medir a parcela A por Hh')
    }

    // ---------------------------------------------------------------------
    // Custo indireto (cod_eap 19.x) semanalizado.
    // A curva planejada nao cobre o indireto, entao cada item e distribuido
    // linearmente pelas semanas entre mes_inicio e mes_fim — o mes de cada
    // semana vem da propria curva, nao de calendario derivado. E rateio, nao
    // cronograma: serve para acompanhar, nao para cobrar prazo de indireto.
    // ---------------------------------------------------------------------
    const semanasDoMes = new Map()
    semanasOrdenadas.forEach((s) => {
      const m = plan.get(s).mes
      if (m == null) return
      if (!semanasDoMes.has(m)) semanasDoMes.set(m, [])
      semanasDoMes.get(m).push(s)
    })

    const indiretoSemanal = new Map()
    let indiretoTotal = 0
    let indiretoSemMes = 0
    indiretos.forEach((it) => {
      const valor = num(it.valor_total)
      indiretoTotal += valor
      const m = parseInt(it.mes_desembolso, 10)
      // mes_desembolso = 0 nao e "mes zero": e custo que corre a obra inteira
      // (administracao local, taxa de ADM, restaurante, contabilidade, IPTU).
      // Sem mes definido e sem competencia, dilui pelas 87 semanas.
      const alvo = m > 0 ? semanasDoMes.get(m) || [] : semanasOrdenadas
      if (!alvo.length) {
        indiretoSemMes += valor
        return
      }
      const fatia = valor / alvo.length
      alvo.forEach((s) => indiretoSemanal.set(s, (indiretoSemanal.get(s) || 0) + fatia))
    })

    // Classificacao pareada com a tela mensal: codigo comecando em 19. e
    // sempre indireto, mesmo quando o item (passeio externo, grama) e
    // fisicamente obra. Ha dois lancamentos cadastrados assim no orcamento
    // (grupo 16, cod_eap 19.1.3 e 19.1.4) que deveriam ter outro codigo — a
    // correcao certa e no cadastro, nao aqui, para nao divergir da mensal.
    const ehIndireto = (eap) => String(eap || '').startsWith('19.')

    const R = COLS.realizado
    const bcwpAPorSemana = new Map()
    const bcwpABases = new Map()
    const dataFimDaView = new Map()
    realizadoRaw.forEach((row) => {
      const s = parseInt(row[R.semana], 10)
      if (!Number.isFinite(s)) return
      // Em base Hh o BCWP e o avanco em horas convertido para reais pelo peso
      // da parcela A. Em base custo vem pronto da view.
      const porCusto = num(row[R.bcwpA])
      const porHh = totalHhEvm > 0 ? (num(row[R.hhAcum]) / totalHhEvm) * totais.a : 0
      bcwpAPorSemana.set(s, BASE_PARCELA_A === 'hh' ? porHh : porCusto)
      bcwpABases.set(s, { custo: porCusto, hh: porHh, hh_acum: num(row[R.hhAcum]) })
      if (row[R.dataFim]) dataFimDaView.set(s, String(row[R.dataFim]).slice(0, 10))
    })

    // Ancora do calendario: a semana mais antiga da view que tenha data.
    const semanasComData = Array.from(dataFimDaView.keys()).sort((a, b) => a - b)
    const ancora = semanasComData.length
      ? { semana: semanasComData[0], data_fim: dataFimDaView.get(semanasComData[0]) }
      : null
    if (!ancora) throw new Error(`${R.table}: nenhuma linha com ${R.dataFim}; sem calendario nao da para semanalizar o custo da parcela B`)

    semanasOrdenadas.forEach((s) => {
      const p = plan.get(s)
      p.data_fim = dataFimDaView.has(s)
        ? dataFimDaView.get(s)
        : addDias(ancora.data_fim, (s - ancora.semana) * 7)
    })

    // A view faz forward fill ate o fim do cronograma: ela tem as 87 semanas,
    // com bcwp_a_acum constante depois do ultimo retrato. Pegar o maior
    // semana_numero daria S87 e a curva do realizado viraria uma reta ate
    // fev/2028 — obra "medida" ate o fim. A semana corrente vem do calendario:
    // a ultima cujo data_fim ja passou.
    // Fuso explicito da obra. toISOString() daria a data em UTC: as 21h de BH
    // ja e o dia seguinte em UTC, e a semana corrente pularia uma noite antes
    // da hora. Em Vercel o processo roda em UTC, entao nao da para confiar no
    // fuso local do servidor — o timeZone vai fixo.
    const hojeISO = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    // Semana corrente = a semana EM CURSO, ou seja, a primeira cujo data_fim
    // ainda nao chegou. Usar a ultima ja encerrada atrasaria o dashboard em
    // uma semana durante os sete dias inteiros.
    let semanaCorrente = 0
    for (const s of semanasOrdenadas) {
      const df = plan.get(s).data_fim
      if (df && String(df).slice(0, 10) >= hojeISO) {
        semanaCorrente = s
        break
      }
    }
    // Depois do fim do cronograma: fica na ultima semana planejada.
    if (!semanaCorrente) semanaCorrente = ultimaSemana || 1

    // Quando o BCWP_A para de crescer: util para ver se o forward fill esta
    // cobrindo semanas sem retrato novo.
    let ultimaSemanaComAvanco = 0
    let anterior = null
    semanasOrdenadas.forEach((s) => {
      const v = bcwpAPorSemana.get(s)
      if (v == null) return
      if (anterior == null || v > anterior + 0.005) ultimaSemanaComAvanco = s
      anterior = v
    })

    const semanaAtual = Math.min(
      Math.max(semanaQuery && Number.isFinite(semanaQuery) ? semanaQuery : semanaCorrente, 1),
      ultimaSemana || TOTAL_SEMANAS
    )

    // -----------------------------------------------------------------------
    // 3. Parcela B realizada: custo incorrido do grupo 17, com teto
    //
    // Bucketiza por data_emissao contra o data_fim de cada semana. Comparacao
    // de string 'YYYY-MM-DD', sem new Date(): o parse de data ISO assume UTC e
    // em UTC-3 volta um dia, que e exatamente o bug que as linhas 46-52 do
    // dashboard-integrado tiveram que contornar.
    // -----------------------------------------------------------------------
    const fimDeSemana = semanasOrdenadas
      .map((s) => ({ semana: s, data_fim: plan.get(s).data_fim }))
      .filter((x) => !!x.data_fim)

    // Inicio da S1: seis dias antes do fim dela. Sem esse piso, todo lancamento
    // anterior a obra (pre-obra, mobilizacao, projeto) caía na S1, inflando o
    // ACWP e a parcela B da primeira semana.
    const inicioDaObra = fimDeSemana.length
      ? addDias(String(fimDeSemana[0].data_fim).slice(0, 10), -6)
      : null

    // Data que posiciona o lancamento na semana: a baixa (pagamento) quando
    // existe, senao a emissao. Custo de obra e caixa — nota emitida em agosto e
    // paga em setembro pertence a setembro. Os lancamentos antigos tem
    // data_vencimento nulo e seguem pela emissao, como sempre seguiram.
    const dataDoLancamento = (l) => l.data_vencimento || l.data_emissao || null

    let semLancamentoDatado = 0
    let valorSemData = 0

    // Lancamento sem data de emissao cai na PRIMEIRA semana da sua competencia.
    // E o caso do terreno: pago de uma vez, sem nota, competencia 2026-07.
    // Diluir pelo mes desenharia uma rampa que nao aconteceu.
    const primeiraSemanaDaCompetencia = (comp) => {
      const c = String(comp || '').slice(0, 7)
      if (!/^\d{4}-\d{2}$/.test(c)) return null
      for (const w of fimDeSemana) {
        if (String(w.data_fim).slice(0, 7) === c) return w.semana
      }
      // Competencia anterior ao inicio da obra: entra na primeira semana.
      if (fimDeSemana.length && c < String(fimDeSemana[0].data_fim).slice(0, 7)) {
        return fimDeSemana[0].semana
      }
      return null
    }

    const semanaDaData = (dataStr) => {
      if (!dataStr) return null
      const d = String(dataStr).slice(0, 10)
      // Pre-obra entra na S1: canteiro e terraplanagem foram pagos antes do
      // marco de inicio e os retratos ja medem esses itens a 100% na S1.
      // Descartar o custo e manter o BCWP inflaria o CPI.
      if (inicioDaObra && d < inicioDaObra) return fimDeSemana[0].semana
      for (const w of fimDeSemana) {
        if (d <= String(w.data_fim).slice(0, 10)) return w.semana
      }
      return null // depois do fim do cronograma
    }

    const tetoPorEap = {}
    const eapGrupo17 = new Set()
    orcamento.forEach((it) => {
      const eap = it.cod_eap
      if (!eap) return
      if (Number(it.grupo_numero) === 17) {
        eapGrupo17.add(eap)
        tetoPorEap[eap] = (tetoPorEap[eap] || 0) + num(it.preco_total)
      }
    })

    // incorridoB[semana][eap] -> valor da semana; acwp[semana] -> direto da semana
    const incorridoBPorSemana = new Map()
    const acwpPorSemana = new Map()
    const acwpIndiretoPorSemana = new Map()

    lancamentos
      .filter((l) => l.status === 'Normal')
      .forEach((l) => {
        const eap = l.codigo_eap || ''
        // Sem data de emissao nao da para dizer a que semana o lancamento
        // pertence. Ele fica de fora, mas contado: valor que some do acumulado
        // sem aviso e pior que valor ausente com aviso.
        const dt = dataDoLancamento(l)
        const s = dt ? semanaDaData(dt) : primeiraSemanaDaCompetencia(l.competencia)
        if (s == null) {
          semLancamentoDatado += 1
          valorSemData += num(l.valor)
          return
        }
        const valor = num(l.valor)

        if (ehIndireto(eap)) {
          acwpIndiretoPorSemana.set(s, (acwpIndiretoPorSemana.get(s) || 0) + valor)
        } else {
          acwpPorSemana.set(s, (acwpPorSemana.get(s) || 0) + valor)
        }
        if (eapGrupo17.has(eap)) {
          if (!incorridoBPorSemana.has(s)) incorridoBPorSemana.set(s, {})
          const bucket = incorridoBPorSemana.get(s)
          bucket[eap] = (bucket[eap] || 0) + valor
        }
      })

    // -----------------------------------------------------------------------
    // 4. Curva completa: 87 pontos, planejado sempre, realizado ate semanaAtual
    // -----------------------------------------------------------------------
    const incorridoAcumPorEap = {}
    let acwpAcum = 0
    let indiretoPlanAcum = 0
    let indiretoRealAcum = 0
    const curva = []

    semanasOrdenadas.forEach((s) => {
      const p = plan.get(s)

      // B: acumula o incorrido do grupo 17 e aplica o teto por item
      const doSemana = incorridoBPorSemana.get(s) || {}
      Object.keys(doSemana).forEach((eap) => {
        incorridoAcumPorEap[eap] = (incorridoAcumPorEap[eap] || 0) + doSemana[eap]
      })
      let bcwpB = Object.keys(incorridoAcumPorEap).reduce((soma, eap) => {
        const teto = tetoPorEap[eap] != null ? tetoPorEap[eap] : incorridoAcumPorEap[eap]
        return soma + Math.min(incorridoAcumPorEap[eap], teto)
      }, 0)
      if (LIMITAR_B_AO_PLANEJADO_DA_SEMANA) bcwpB = Math.min(bcwpB, p.b)

      // C: medida por tempo decorrido, entao o realizado acompanha o planejado
      // por construcao. SPI_C = 1 em toda semana; esta parcela nunca sinaliza
      // atraso, so dilui o SPI global.
      const bcwpC = p.c

      acwpAcum += acwpPorSemana.get(s) || 0
      indiretoPlanAcum += indiretoSemanal.get(s) || 0
      indiretoRealAcum += acwpIndiretoPorSemana.get(s) || 0

      const temRealizado = s <= semanaAtual
      const bcwpABase = bcwpAPorSemana.get(s) || 0

      curva.push({
        semana: s,
        data_fim: p.data_fim,
        mes: p.mes,
        bcws_a: r2(p.a),
        bcws_b: r2(p.b),
        bcws_c: r2(p.c),
        bcws: r2(p.a + p.b + p.c),
        // Os acumulados de custo e medicao existem em qualquer semana: sao o
        // que foi gasto e medido ate aqui. Nao ficam nulos no futuro — quem
        // decide ate onde desenhar a linha e o grafico, com o campo "medido".
        medido: temRealizado,
        bcwp_a: r2(bcwpABase),
        bcwp_b: r2(bcwpB),
        bcwp_c: r2(bcwpC),
        bcwp: r2(bcwpABase + bcwpB + bcwpC),
        acwp: r2(acwpAcum),
        financeiro_planejado: r2(p.financeiro),
        // Avanco fisico e medido em hora-homem, nao em reais: e a definicao da
        // planilha de planejamento (Hh acumulado / Hh total do projeto). O BCWS
        // continua rateado por custo — sao metricas diferentes, nao concorrentes.
        // Duas reguas do avanco fisico, calculadas sempre. O alternador da
        // tela escolhe qual mostrar; nenhuma das duas e "a certa" em abstrato.
        avanco_plan_hh: r2(p.perc_hh),
        // Avanco fisico e producao. As parcelas B (locacao) e C (funcionarios)
        // avancam por gasto e por calendario, nao por servico executado — somar
        // as duas aqui faria o indicador subir sozinho com o tempo passando.
        // As duas reguas (custo e Hh) pesam a MESMA parcela A de formas
        // diferentes; e so isso que o alternador troca.
        avanco_plan_custo: totais.a > 0 ? r2((p.a / totais.a) * 100) : null,
        avanco_real_hh: r2(((bcwpABases.get(s) || {}).hh_acum || 0) / totalHhEvm * 100),
        avanco_real_custo:
          totais.a > 0 ? r2((((bcwpABases.get(s) || {}).custo || 0) / totais.a) * 100) : null,
        indireto_planejado: r2(indiretoPlanAcum),
        indireto_realizado: r2(indiretoRealAcum),
        bcwp_a_custo: temRealizado ? r2((bcwpABases.get(s) || {}).custo || 0) : null,
        bcwp_a_hh: temRealizado ? r2((bcwpABases.get(s) || {}).hh || 0) : null,
        hh_acumulado: temRealizado ? r2((bcwpABases.get(s) || {}).hh_acum || 0) : null,
      })
    })

    // -----------------------------------------------------------------------
    // 4b. Abertura por grupo, ate a semana selecionada.
    // O planejado por grupo NAO existe pronto: a curva so guarda o agregado das
    // tres parcelas. Cada item e rateado linearmente entre mes_inicio e mes_fim,
    // que e a regua da tela mensal. A soma pode divergir do bcws da curva em
    // semanas intermediarias — a diferenca vai no bloco de consistencia.
    // -----------------------------------------------------------------------
    const semanasAte = new Set(semanasOrdenadas.filter((w) => w <= semanaAtual))

    const fatiaPlanejadaAte = (it) => {
      const valor = num(it.preco_total)
      const mi = parseInt(it.mes_inicio, 10) || 1
      const mf = parseInt(it.mes_fim, 10) || mi
      const alvo = []
      for (let m = mi; m <= mf; m += 1) (semanasDoMes.get(m) || []).forEach((w) => alvo.push(w))
      if (!alvo.length) return 0
      const dentro = alvo.filter((w) => semanasAte.has(w)).length
      return (valor / alvo.length) * dentro
    }

    const realizadoPorEapAte = {}
    const lancamentosPorEap = {}
    lancamentos
      .filter((l) => l.status === 'Normal')
      .forEach((l) => {
        const dt = dataDoLancamento(l)
        const w = dt ? semanaDaData(dt) : primeiraSemanaDaCompetencia(l.competencia)
        if (w == null || !semanasAte.has(w)) return
        const eap = l.codigo_eap || ''
        // Mesma regra do card de custo direto: codigo 19. e indireto, mesmo
        // quando o item existe no orcamento (passeio externo, grama). Sem isso
        // a soma da tabela fica acima do card pelo valor desses lancamentos.
        if (ehIndireto(eap)) return
        realizadoPorEapAte[eap] = (realizadoPorEapAte[eap] || 0) + num(l.valor)
        if (!lancamentosPorEap[eap]) lancamentosPorEap[eap] = []
        lancamentosPorEap[eap].push({
          semana: w,
          data: dataDoLancamento(l) ? iso10(dataDoLancamento(l)) : null,
          competencia: l.competencia || null,
          fornecedor: l.fornecedor || '',
          historico: l.historico || '',
          valor: r2(num(l.valor)),
        })
      })

    const porGrupo = new Map()
    orcamento.forEach((it) => {
      const g = parseInt(it.grupo_numero, 10)
      if (!Number.isFinite(g)) return
      if (!porGrupo.has(g)) {
        porGrupo.set(g, {
          grupo: g,
          nome: it.grupo_nome || it.macrogrupo || it.grupo_descricao || ('Grupo ' + g),
          mes_inicio: parseInt(it.mes_inicio, 10) || 1,
          mes_fim: parseInt(it.mes_fim, 10) || 1,
          planejado: 0,
          realizado: 0,
          itens: [],
        })
      }
      const linha = porGrupo.get(g)
      const plan = fatiaPlanejadaAte(it)
      const real = realizadoPorEapAte[it.cod_eap] || 0
      linha.planejado += plan
      linha.realizado += real
      linha.mes_inicio = Math.min(linha.mes_inicio, parseInt(it.mes_inicio, 10) || 1)
      linha.mes_fim = Math.max(linha.mes_fim, parseInt(it.mes_fim, 10) || 1)
      linha.itens.push({
        cod_eap: it.cod_eap,
        descricao: it.descricao || '',
        mes_inicio: parseInt(it.mes_inicio, 10) || null,
        mes_fim: parseInt(it.mes_fim, 10) || null,
        planejado: r2(plan),
        realizado: r2(real),
        planejado_total: r2(num(it.preco_total)),
        lancamentos: (lancamentosPorEap[it.cod_eap] || []).sort((a, b) =>
          String(a.data || '').localeCompare(String(b.data || ''))
        ),
      })
    })

    const grupos = Array.from(porGrupo.values())
      .sort((a, b) => a.grupo - b.grupo)
      .map((g) => ({
        ...g,
        planejado: r2(g.planejado),
        realizado: r2(g.realizado),
        itens: g.itens.sort((a, b) =>
          String(a.cod_eap).localeCompare(String(b.cod_eap), 'pt-BR', { numeric: true })
        ),
      }))

    // Abertura do indireto por categoria, mesma logica: planejado rateado
    // (mes_desembolso > 0 no mes; = 0 pela obra inteira) e truncado na semana;
    // realizado somado dos lancamentos com codigo de indireto ate a semana.
    const realizadoIndiretoPorEap = {}
    let realizadoIndiretoSemCategoria = 0
    lancamentos
      .filter((l) => l.status === 'Normal')
      .forEach((l) => {
        const eap = l.codigo_eap || ''
        if (!ehIndireto(eap)) return
        const dt = dataDoLancamento(l)
        const w = dt ? semanaDaData(dt) : primeiraSemanaDaCompetencia(l.competencia)
        if (w == null || !semanasAte.has(w)) return
        realizadoIndiretoPorEap[eap] = (realizadoIndiretoPorEap[eap] || 0) + num(l.valor)
      })

    const eapComCategoria = new Set(indiretos.map((it) => it.cod_eap).filter(Boolean))
    Object.keys(realizadoIndiretoPorEap).forEach((eap) => {
      if (!eapComCategoria.has(eap)) realizadoIndiretoSemCategoria += realizadoIndiretoPorEap[eap]
    })

    const indiretosAbertura = indiretos
      .map((it) => {
        const valor = num(it.valor_total)
        const m = parseInt(it.mes_desembolso, 10)
        const alvo = m > 0 ? semanasDoMes.get(m) || [] : semanasOrdenadas
        const dentro = alvo.filter((w) => semanasAte.has(w)).length
        const plan = alvo.length ? (valor / alvo.length) * dentro : 0
        const real = realizadoIndiretoPorEap[it.cod_eap] || 0
        return {
          cod_eap: it.cod_eap,
          categoria: it.categoria || it.cod_eap || 'Sem categoria',
          mes_desembolso: Number.isFinite(m) ? m : null,
          planejado: r2(plan),
          planejado_total: r2(valor),
          realizado: r2(real),
        }
      })
      .sort((a, b) => b.planejado_total - a.planejado_total)

    const somaIndiretoPlan = indiretosAbertura.reduce((t, i) => t + i.planejado, 0)
    const somaIndiretoReal =
      indiretosAbertura.reduce((t, i) => t + i.realizado, 0) + realizadoIndiretoSemCategoria

    // Avanco fisico por item ate a semana. O realizado e o ULTIMO retrato do
    // item ate aqui (mais recente por data_lancamento, nao o maior valor: item
    // revisado para baixo tem que cair). O planejado e a fracao de semanas ja
    // decorridas dentro do intervalo mes_inicio..mes_fim do item.
    const ultimoRetrato = {}
    const retratosPorEap = {}
    retratos.forEach((r) => {
      const w = parseInt(r.semana_numero, 10)
      if (!Number.isFinite(w) || w > semanaAtual) return
      const eap = r.codigo_eap
      if (!retratosPorEap[eap]) retratosPorEap[eap] = []
      retratosPorEap[eap].push({
        id: r.id,
        semana: w,
        data: r.data_lancamento ? iso10(r.data_lancamento) : null,
        perc: r2(num(r.percentual_realizado)),
      })
      const atual = ultimoRetrato[eap]
      const chave = [w, r.data_lancamento || '', r.id || 0]
      if (
        !atual ||
        chave[0] > atual.chave[0] ||
        (chave[0] === atual.chave[0] &&
          (String(chave[1]) > String(atual.chave[1]) ||
            (String(chave[1]) === String(atual.chave[1]) && chave[2] > atual.chave[2])))
      ) {
        ultimoRetrato[eap] = { perc: num(r.percentual_realizado), chave, semana: w }
      }
    })

    const percPlanejadoAte = (it) => {
      const mi = parseInt(it.mes_inicio, 10) || 1
      const mf = parseInt(it.mes_fim, 10) || mi
      const alvo = []
      for (let m = mi; m <= mf; m += 1) (semanasDoMes.get(m) || []).forEach((w) => alvo.push(w))
      if (!alvo.length) return 0
      return (alvo.filter((w) => semanasAte.has(w)).length / alvo.length) * 100
    }

    const avancoPorGrupo = new Map()
    orcamento.forEach((it) => {
      const g = parseInt(it.grupo_numero, 10)
      if (!Number.isFinite(g) || !it.entra_evm) return
      // Item so de material (concreto usinado, aco comprado pronto) nao tem
      // hora-homem: nao mede avanco fisico e polui a lista com 0,0 h.
      if (num(it.hh) <= 0) return
      if (!avancoPorGrupo.has(g)) {
        avancoPorGrupo.set(g, {
          grupo: g,
          nome: it.grupo_nome || it.macrogrupo || ('Grupo ' + g),
          hh_total: 0,
          hh_plan: 0,
          hh_real: 0,
          itens: [],
        })
      }
      const linha = avancoPorGrupo.get(g)
      const hh = num(it.hh)
      const pPlan = percPlanejadoAte(it)
      const retrato = ultimoRetrato[it.cod_eap]
      const pReal = retrato ? retrato.perc : 0
      linha.hh_total += hh
      linha.hh_plan += (hh * pPlan) / 100
      linha.hh_real += (hh * pReal) / 100
      // Varias linhas do orcamento compartilham o mesmo cod_eap (o mesmo
      // servico repetido por pavimento). A medicao e gravada por codigo, entao
      // essas linhas sao UMA atividade mensuravel: somar as horas e mostrar uma
      // vez so. Mostrar seis linhas identicas sugere seis medicoes possiveis.
      const chave = GRUPOS_POR_PAVIMENTO.has(g)
        ? `${it.cod_eap}|${it.pavimento || ''}`
        : it.cod_eap
      const existente = linha.itens.find((x) => x.chave === chave)
      if (existente) {
        existente.hh = r2(existente.hh + hh)
        existente.linhas += 1
        return
      }
      linha.itens.push({
        chave,
        linhas: 1,
        cod_eap: it.cod_eap,
        descricao: it.descricao || '',
        pavimento: it.pavimento || null,
        hh: r2(hh),
        perc_planejado: r2(pPlan),
        perc_realizado: r2(pReal),
        medido_na_semana: retrato ? retrato.semana : null,
        retratos: (retratosPorEap[it.cod_eap] || []).sort(
          (a, b) => a.semana - b.semana || String(a.data || '').localeCompare(String(b.data || ''))
        ),
        mes_inicio: parseInt(it.mes_inicio, 10) || null,
        mes_fim: parseInt(it.mes_fim, 10) || null,
      })
    })

    // So aparece o que ja deveria ter comecado ate a semana (perc_planejado > 0)
    // ou o que ja foi executado mesmo sem estar previsto ainda — atividade
    // adiantada precisa aparecer. O denominador continua sendo o Hh INTEIRO do
    // grupo e do pavimento: esconder item nao pode inflar percentual.
    const visivel = (i) => i.perc_planejado > 0 || i.perc_realizado > 0

    const avancoGrupos = Array.from(avancoPorGrupo.values())
      .filter((g) => g.itens.some(visivel))
      .sort((a, b) => a.grupo - b.grupo)
      .map((g) => ({
        grupo: g.grupo,
        nome: g.nome,
        hh_total: r2(g.hh_total),
        hh_plan: r2(g.hh_plan),
        hh_real: r2(g.hh_real),
        perc_planejado: g.hh_total > 0 ? r2((g.hh_plan / g.hh_total) * 100) : null,
        perc_realizado: g.hh_total > 0 ? r2((g.hh_real / g.hh_total) * 100) : null,
        peso: totalHhEvm > 0 ? r2((g.hh_total / totalHhEvm) * 100) : null,
        itens: g.itens.filter(visivel).sort((a, b) =>
          String(a.cod_eap).localeCompare(String(b.cod_eap), 'pt-BR', { numeric: true })
        ),
        itens_nao_iniciados: g.itens.filter((i) => !visivel(i)).length,
        por_pavimento: GRUPOS_POR_PAVIMENTO.has(g.grupo),
        // Estrutura e alvenaria repetem o mesmo servico por pavimento.
        // Agrupar por pavimento mostra em qual andar o atraso esta.
        pavimentos: !GRUPOS_POR_PAVIMENTO.has(g.grupo) ? [] : (() => {
          const m = new Map()
          g.itens.forEach((i) => {
            const p = i.pavimento || 'Sem pavimento'
            if (!m.has(p)) m.set(p, { pavimento: p, hh_total: 0, hh_plan: 0, hh_real: 0, itens: [] })
            const b = m.get(p)
            b.hh_total += i.hh
            b.hh_plan += (i.hh * i.perc_planejado) / 100
            b.hh_real += (i.hh * i.perc_realizado) / 100
            b.itens.push(i)
          })
          return Array.from(m.values())
            .map((b) => ({
              pavimento: b.pavimento,
              hh_total: r2(b.hh_total),
              hh_plan: r2(b.hh_plan),
              hh_real: r2(b.hh_real),
              perc_planejado: b.hh_total > 0 ? r2((b.hh_plan / b.hh_total) * 100) : null,
              perc_realizado: b.hh_total > 0 ? r2((b.hh_real / b.hh_total) * 100) : null,
              itens: b.itens.filter(visivel).sort((x, y) =>
                String(x.cod_eap).localeCompare(String(y.cod_eap), 'pt-BR', { numeric: true })
              ),
            }))
            .filter((b) => b.itens.length > 0)
            .sort((x, y) => String(x.pavimento).localeCompare(String(y.pavimento), 'pt-BR', { numeric: true }))
        })(),
      }))

    // Matriz pavimento x grupo para o mapa de avanco. Usa a MESMA base dos
    // cards: Hh, ultimo retrato por item, corte na semana selecionada. Antes
    // esse painel vinha das rotas mensais e discordava do resto da tela.
    const celulas = new Map()
    const pavimentosVistos = new Set()
    const gruposVistos = new Map()
    orcamento.forEach((it) => {
      const g = parseInt(it.grupo_numero, 10)
      if (!Number.isFinite(g) || !it.entra_evm) return
      const hh = num(it.hh)
      if (hh <= 0) return
      const pav = it.pavimento || 'Sem pavimento'
      pavimentosVistos.add(pav)
      if (!gruposVistos.has(g)) gruposVistos.set(g, it.grupo_nome || it.macrogrupo || ('Grupo ' + g))
      const k = `${pav}||${g}`
      if (!celulas.has(k)) celulas.set(k, { pavimento: pav, grupo: g, hh: 0, plan: 0, real: 0 })
      const c = celulas.get(k)
      const pPlan = percPlanejadoAte(it)
      const retrato = ultimoRetrato[it.cod_eap]
      const pReal = retrato ? retrato.perc : 0
      c.hh += hh
      c.plan += (hh * pPlan) / 100
      c.real += (hh * pReal) / 100
    })

    const mapaAvanco = {
      pavimentos: Array.from(pavimentosVistos).sort((a, b) =>
        String(a).localeCompare(String(b), 'pt-BR', { numeric: true })
      ),
      grupos: Array.from(gruposVistos.entries())
        .map(([numero, nome]) => ({ numero, nome }))
        .sort((a, b) => a.numero - b.numero),
      celulas: Array.from(celulas.values()).map((c) => ({
        pavimento: c.pavimento,
        grupo: c.grupo,
        hh: r2(c.hh),
        perc_planejado: c.hh > 0 ? r2((c.plan / c.hh) * 100) : null,
        perc_realizado: c.hh > 0 ? r2((c.real / c.hh) * 100) : null,
      })),
    }

    const hhRealDosGrupos = avancoGrupos.reduce((t, g) => t + g.hh_real, 0)

    const somaGruposPlan = grupos.reduce((t, g) => t + g.planejado, 0)
    const somaGruposReal = grupos.reduce((t, g) => t + g.realizado, 0)

    // -----------------------------------------------------------------------
    // 5. KPIs da semana selecionada
    // -----------------------------------------------------------------------
    const ponto = curva.find((x) => x.semana === semanaAtual) || curva[curva.length - 1]

    const spi = (bcwp, bcws) => (bcws > 0 && bcwp != null ? bcwp / bcws : null)

    const kpis = {
      semana: ponto.semana,
      data_fim: ponto.data_fim,
      bcws: ponto.bcws,
      bcwp: ponto.bcwp,
      acwp: ponto.acwp,
      spi: r3(spi(ponto.bcwp, ponto.bcws)),
      cpi: ponto.acwp > 0 && ponto.bcwp != null ? r3(ponto.bcwp / ponto.acwp) : null,
      sv: ponto.bcwp != null ? r2(ponto.bcwp - ponto.bcws) : null,
      cv: ponto.bcwp != null && ponto.acwp != null ? r2(ponto.bcwp - ponto.acwp) : null,
      avanco_fisico_planejado: ponto.avanco_plan_hh,
      avanco_fisico_realizado: ponto.avanco_real_hh,
      por_parcela: {
        a: {
          criterio: 'hora-homem',
          bcws: ponto.bcws_a,
          bcwp: ponto.bcwp_a,
          spi: r3(spi(ponto.bcwp_a, ponto.bcws_a)),
        },
        b: {
          criterio: 'custo incorrido limitado ao planejado',
          bcws: ponto.bcws_b,
          bcwp: ponto.bcwp_b,
          spi: r3(spi(ponto.bcwp_b, ponto.bcws_b)),
        },
        c: {
          criterio: 'tempo decorrido',
          bcws: ponto.bcws_c,
          bcwp: ponto.bcwp_c,
          spi: r3(spi(ponto.bcwp_c, ponto.bcws_c)),
        },
      },
    }

    // -----------------------------------------------------------------------
    // 6. Consistencia: se a base de horas ou o orcamento mudarem, aparece aqui
    //    em vez de virar um SPI silenciosamente errado.
    // -----------------------------------------------------------------------
    const consistencia = {
      hoje: hojeISO,
      semanas_na_curva: semanasOrdenadas.length,
      semanas_na_view: bcwpAPorSemana.size,
      semanas_esperadas: TOTAL_SEMANAS,
      total_a: r2(totais.a),
      total_b: r2(totais.b),
      total_c: r2(totais.c),
      total: r2(totais.total),
      divergencia_a: r2(totais.a - ESPERADO.a),
      divergencia_b: r2(totais.b - ESPERADO.b),
      divergencia_c: r2(totais.c - ESPERADO.c),
      divergencia_vs_custo_evm_acum: fimDaCurva
        ? r2(totais.total - fimDaCurva.total_tabela)
        : null,
      calendario_extrapolado_a_partir_de: { semana: ancora.semana, data_fim: ancora.data_fim },
      inicio_da_obra: inicioDaObra,
      base_parcela_a: BASE_PARCELA_A,
      grupos_planejado_soma: r2(somaGruposPlan),
      hh_realizado_dos_grupos: r2(hhRealDosGrupos),
      indiretos_planejado_soma: r2(somaIndiretoPlan),
      indiretos_realizado_soma: r2(somaIndiretoReal),
      indireto_realizado_sem_categoria: r2(realizadoIndiretoSemCategoria),
      grupos_realizado_soma: r2(somaGruposReal),
      indireto_rateio:
        'mes_desembolso > 0 vai para as semanas do mes; mes_desembolso = 0 dilui pela obra inteira',
      indireto_sem_mes_valido: r2(indiretoSemMes),
      indireto_itens: indiretos.length,
      lancamentos_sem_semana: semLancamentoDatado,
      valor_sem_semana: r2(valorSemData),
      indireto_total: r2(indiretoTotal),
      hh_total_evm: r2(totalHhEvm),
      lancamentos_pre_obra_na_s1: lancamentos.filter(
        (l) =>
          l.status === 'Normal' &&
          inicioDaObra &&
          String(dataDoLancamento(l) || '').slice(0, 10) < inicioDaObra
      ).length,
      lancamentos_depois_da_curva: lancamentos.filter((l) => {
        if (l.status !== 'Normal') return false
        const d = String(dataDoLancamento(l) || '').slice(0, 10)
        if (!d) return false
        if (inicioDaObra && d < inicioDaObra) return false
        return semanaDaData(dataDoLancamento(l)) == null
      }).length,
    }

    return res.status(200).json({
      semana_atual: semanaAtual,
      semana_corrente_calendario: semanaCorrente,
      ultima_semana_com_avanco: ultimaSemanaComAvanco,
      kpis,
      curva,
      grupos,
      indiretos: indiretosAbertura,
      avanco_grupos: avancoGrupos,
      mapa_avanco: mapaAvanco,
      totais: {
        a: r2(totais.a),
        b: r2(totais.b),
        c: r2(totais.c),
        custo_direto: r2(totais.total),
        indireto: r2(indiretoTotal),
        obra: r2(totais.total + indiretoTotal),
      },
      consistencia,
      metadata: {
        obra_id,
        total_semanas: semanasOrdenadas.length,
        fonte_bcwp_a: COLS.realizado.table,
        fonte_bcws: COLS.curva.table,
        catraca: false,
      },
    })
  } catch (error) {
    console.error('Erro no dashboard semanal:', error)
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}
