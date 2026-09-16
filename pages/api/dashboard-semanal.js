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
    bcwsA: 'parcela_a_acum',
    bcwsB: 'parcela_b_acum',
    bcwsC: 'parcela_c_acum',
    // conferencia: total das tres parcelas gravado na propria tabela
    totalAcum: 'custo_evm_acum',
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

// Valores de referencia so para o bloco de consistencia da resposta.
const ESPERADO = { a: 2793442.79, b: 313367.06, c: 356776.0 }

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
    const [curvaRes, realizadoRes, orcamentoRes, custosRes] = await Promise.all([
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
        .select('cod_eap, grupo_numero, preco_total, hh, entra_evm')
        .eq('obra_id', obra_id),
      supabase
        .from('custos_lancamentos')
        .select('codigo_eap, data_emissao, valor, status')
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
      ['custos_lancamentos', custosRes],
    ]
    for (const [nome, r] of respostas) {
      if (r.error) throw new Error(`${nome}: ${r.error.message}`)
      if (!r.data || r.data.length === 0) throw new Error(`${nome}: sem linhas para obra_id=${obra_id}`)
    }

    const curvaRaw = curvaRes.data
    const realizadoRaw = realizadoRes.data
    const orcamento = orcamentoRes.data
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
        plan.set(s, { semana: s, data_fim: null, a: accA, b: accB, c: accC, total_tabela: num(row[C.totalAcum]) })
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
    const totalHhEvm = orcamento.reduce((soma, it) => (it.entra_evm ? soma + num(it.hh) : soma), 0)
    if (BASE_PARCELA_A === 'hh' && totalHhEvm <= 0) throw new Error('orcamento_planejado: soma de hh com entra_evm = 0')

    const R = COLS.realizado
    const bcwpAPorSemana = new Map()
    const dataFimDaView = new Map()
    realizadoRaw.forEach((row) => {
      const s = parseInt(row[R.semana], 10)
      if (!Number.isFinite(s)) return
      const valorA = BASE_PARCELA_A === 'hh' ? (num(row[R.hhAcum]) / totalHhEvm) * totais.a : num(row[R.bcwpA])
      bcwpAPorSemana.set(s, valorA)
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

    const semanaDaData = (dataStr) => {
      if (!dataStr) return null
      const d = String(dataStr).slice(0, 10)
      if (inicioDaObra && d < inicioDaObra) return fimDeSemana[0].semana // pre-obra vai para a S1
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

    lancamentos
      .filter((l) => l.status === 'Normal')
      .forEach((l) => {
        const eap = l.codigo_eap || ''
        const s = semanaDaData(l.data_emissao)
        if (s == null) return
        const valor = num(l.valor)

        if (!eap.startsWith('19.')) {
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

      const temRealizado = s <= semanaAtual
      const bcwpA = temRealizado ? (bcwpAPorSemana.get(s) ?? null) : null

      const bcwpTotal =
        temRealizado && bcwpA != null ? bcwpA + bcwpB + bcwpC : null

      curva.push({
        semana: s,
        data_fim: p.data_fim,
        bcws_a: r2(p.a),
        bcws_b: r2(p.b),
        bcws_c: r2(p.c),
        bcws: r2(p.a + p.b + p.c),
        bcwp_a: bcwpA == null ? null : r2(bcwpA),
        bcwp_b: temRealizado ? r2(bcwpB) : null,
        bcwp_c: temRealizado ? r2(bcwpC) : null,
        bcwp: bcwpTotal == null ? null : r2(bcwpTotal),
        acwp: temRealizado ? r2(acwpAcum) : null,
      })
    })

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
      avanco_fisico_planejado: totais.total > 0 ? r2((ponto.bcws / totais.total) * 100) : null,
      avanco_fisico_realizado:
        totais.total > 0 && ponto.bcwp != null ? r2((ponto.bcwp / totais.total) * 100) : null,
      por_parcela: {
        a: {
          criterio: 'percentual fisico por item, ponderado por custo',
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
      hh_total_evm: r2(totalHhEvm),
      lancamentos_antes_da_obra: lancamentos.filter(
        (l) =>
          l.status === 'Normal' &&
          inicioDaObra &&
          String(l.data_emissao || '').slice(0, 10) < inicioDaObra
      ).length,
      lancamentos_depois_da_curva: lancamentos.filter((l) => {
        if (l.status !== 'Normal') return false
        const d = String(l.data_emissao || '').slice(0, 10)
        if (!d) return false
        if (inicioDaObra && d < inicioDaObra) return false
        return semanaDaData(l.data_emissao) == null
      }).length,
    }

    return res.status(200).json({
      semana_atual: semanaAtual,
      semana_corrente_calendario: semanaCorrente,
      ultima_semana_com_avanco: ultimaSemanaComAvanco,
      kpis,
      curva,
      totais: {
        a: r2(totais.a),
        b: r2(totais.b),
        c: r2(totais.c),
        custo_direto: r2(totais.total),
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
