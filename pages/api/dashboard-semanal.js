import { supabase } from '../../lib/supabase'
import { carregarContasAPagar, resumirContas, listarFechamentos } from '../../lib/contas-a-pagar'
import { carregarCalendario, addDias } from '../../lib/calendario'

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

// Calendario: tabela calendario_semanas (lib/calendario.js). As semanas nao
// tem mais 7 dias sempre (decisao out/26: a semana termina no domingo ou no
// ultimo dia do mes), entao todo rateio por semana pesa pelos dias dela. Sem
// a tabela, cai no antigo: data da view extrapolada a 7 dias por semana.

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

// Custo que corre pelo calendario, usado no cenario provavel da projecao: cada
// semana a mais de obra custa (parcela B + parcela C + indireto que corre a
// obra inteira) / 87. O indireto entra pela regra mes_desembolso = 0, a mesma
// do rateio. Se algum item com mes_desembolso = 0 nao depender do tempo (taxa
// percentual, por exemplo), ponha o cod_eap aqui para tirar da conta.
const INDIRETO_FORA_DO_CALENDARIO = new Set([])

// Regras do valor agregado da producao (parcela A), por codigo.
//
// POR_TEMPO: verba que se gasta por mes, nao por servico. O agregado corre
// linear pela obra toda (semanas decorridas / total), como o indireto de
// mes_desembolso = 0; medicao lancada para o item e ignorada.
const AGREGADO_POR_TEMPO = new Set(['1.1.6'])
// HERDA: item so de material, sem medicao propria. Usa o percentual dos
// servicos a que pertence, ponderado pelo custo deles. Cada par e um codigo
// ('2.1.9') ou o comeco da descricao ('desc:Forma de chapa ...'). A busca por
// descricao fica no MESMO subgrupo do item (3.3.7 so procura em 3.3.x), que
// na estrutura e o pavimento; o que nao for achado aparece na consistencia.
const FORMA = 'desc:Forma de chapa compensada plastificada 18 mm'
const ARMACAO = 'desc:Armação aço CA-50'
const LANCAMENTO = 'desc:Lançamento, adensamento e acabamento de concreto'
const AGREGADO_HERDA = {
  // Fundacao: forma e aco de bloco e viga baldrame seguem os dois servicos.
  '2.1.13': ['2.1.9', '2.1.10'],
  '2.1.14': ['2.1.9', '2.1.10'],
  // Estrutura, por pavimento: forma (material) segue a forma de chapa do
  // andar; aco (material) segue a armacao do andar.
  '3.1.6': ['3.1.4'],
  '3.1.7': [ARMACAO],
  '3.2.6': [FORMA],
  '3.2.7': [ARMACAO],
  '3.3.7': [FORMA],
  '3.3.8': [ARMACAO],
  '3.4.7': [FORMA],
  '3.4.8': [ARMACAO],
  '3.5.6': [FORMA],
  '3.5.7': [ARMACAO],
  '3.6.5': [FORMA],
  '3.6.6': [ARMACAO],
  '3.7.5': [FORMA],
  '3.7.6': [ARMACAO],
  // Concreto do 7o sem Hh: segue o lancamento do andar.
  '3.7.2': [LANCAMENTO],
  // Eletrica: cabos seguem o 7.1.7.
  '7.1.8': ['7.1.7'],
  '7.1.9': ['7.1.7'],
  // Esquadrias e area externa.
  '12.1.22': ['12.1.21'],
  '16.1.4': ['16.1.3'],
  '16.1.5': ['16.1.3'],
}

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

    // Contas a pagar do ultimo fechamento (direto, com NF e "Prev. Financ.").
    // IPC = valor agregado do direto / (realizado do direto + a pagar do
    // direto). Sem a tabela no banco, o a pagar fica zerado e a resposta avisa.
    const contas = await carregarContasAPagar(supabase, obra_id)
    const resumoContas = contas.disponivel ? resumirContas(contas.linhas) : null
    const aPagarDireto = resumoContas ? resumoContas.totais.ipc_direto : 0
    const aPagarPorEap = resumoContas ? resumoContas.por_eap_direto : {}

    const curvaRaw = curvaRes.data
    const realizadoRaw = realizadoRes.data
    const orcamento = orcamentoRes.data
    const indiretos = indiretoRes.data
    const retratos = retratosRes.data
    const lancamentos = custosRes.data
    const cal = await carregarCalendario(supabase, obra_id)

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
        // Mes da semana: o do calendario (a semana nao cruza mais o mes); sem
        // calendario, o da curva.
        const doCal = cal.porSemana.get(s)
        const mes = doCal && doCal.mes ? doCal.mes : parseInt(row[C.mes], 10) || null
        plan.set(s, { semana: s, data_fim: null, a: accA, b: accB, c: accC, total_tabela: num(row[C.totalAcum]), financeiro: num(row[C.financeiro]), perc_hh: num(row[C.percHh]), mes })
        semanasOrdenadas.push(s)
      })

    const ultimaSemana = semanasOrdenadas.length ? semanasOrdenadas[semanasOrdenadas.length - 1] : 0

    // Peso de cada semana = dias dela (7 se a semana nao estiver no calendario).
    const diasDe = (w) => {
      const c = cal.porSemana.get(w)
      return c ? c.dias : 7
    }
    const somaDias = (lista) => lista.reduce((t, w) => t + diasDe(w), 0)
    const diasAcum = new Map()
    let totalDias = 0
    semanasOrdenadas.forEach((w) => {
      totalDias += diasDe(w)
      diasAcum.set(w, totalDias)
    })
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

    // Planejado das verbas por tempo (AGREGADO_POR_TEMPO). A curva do banco
    // foi gerada com o item entre mes_inicio e mes_fim do orcamento — no caso
    // do 1.1.6, tudo no mes 1. Aqui ele sai dessa janela e volta linear pela
    // obra toda, a mesma regra do agregado; sem isso o item pareceria
    // atrasado ate a S87. O total da parcela A nao muda.
    // ATENCAO: a correcao le mes_inicio/mes_fim do orcamento para saber como
    // a curva distribuiu o item. Se mudar esses meses no banco, a curva tem
    // que ser regerada junto — senao a correcao tira o valor do lugar errado.
    const correcaoPlanejadoTempo = []
    orcamento.forEach((it) => {
      if (!it.entra_evm || !AGREGADO_POR_TEMPO.has(it.cod_eap)) return
      const custo = num(it.preco_total)
      const mi = parseInt(it.mes_inicio, 10) || 1
      const mf = parseInt(it.mes_fim, 10) || mi
      const janela = []
      for (let m = mi; m <= mf; m += 1) (semanasDoMes.get(m) || []).forEach((w) => janela.push(w))
      if (!janela.length || custo <= 0) return
      const diasJanela = somaDias(janela)
      semanasOrdenadas.forEach((w) => {
        const original = (custo * somaDias(janela.filter((x) => x <= w))) / diasJanela
        const linear = (custo * diasAcum.get(w)) / totalDias
        plan.get(w).a += linear - original
      })
      correcaoPlanejadoTempo.push({ cod_eap: it.cod_eap, custo: r2(custo), mes_inicio: mi, mes_fim: mf })
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
      const diasAlvo = somaDias(alvo)
      alvo.forEach((s) => indiretoSemanal.set(s, (indiretoSemanal.get(s) || 0) + (valor * diasDe(s)) / diasAlvo))
    })

    // Classificacao pareada com a tela mensal: codigo comecando em 19. e
    // sempre indireto, mesmo quando o item (passeio externo, grama) e
    // fisicamente obra. Ha dois lancamentos cadastrados assim no orcamento
    // (grupo 16, cod_eap 19.1.3 e 19.1.4) que deveriam ter outro codigo — a
    // correcao certa e no cadastro, nao aqui, para nao divergir da mensal.
    const ehIndireto = (eap) => String(eap || '').startsWith('19.')

    // -----------------------------------------------------------------------
    // Valor agregado da producao calculado aqui, item a item, semana a semana.
    // A view soma percentual x custo de todo item medido; as regras acima
    // (verba por tempo, material que herda o avanco do servico) nao cabem
    // nela. Hh continua vindo da view.
    // -----------------------------------------------------------------------
    // custo_encerrado: coluna opcional do orcamento (alter table ... add
    // column custo_encerrado boolean). Sem a coluna, tudo fica em aberto.
    const encerradoPorEap = {}
    orcamento.forEach((it) => {
      if (it.cod_eap && it.custo_encerrado === true) encerradoPorEap[it.cod_eap] = true
    })
    const custoPorEap = {}
    const descPorEap = {}
    orcamento.forEach((it) => {
      if (!it.entra_evm || !it.cod_eap) return
      custoPorEap[it.cod_eap] = (custoPorEap[it.cod_eap] || 0) + num(it.preco_total)
      if (!descPorEap[it.cod_eap]) descPorEap[it.cod_eap] = String(it.descricao || '')
    })
    // Valor agregado do MATERIAL (decisao out/26): linhas "Apenas Material" de
    // aco e de material de forma, fundacao inclusive. Concreto usinado fica
    // fora (entra pela medicao). Agregado = o MAIOR entre a heranca do servico
    // (avanco x orcado) e o custo da linha (pago + a pagar) limitado ao orcado.
    const ehMaterialAgregado = (eap) => {
      const d = descPorEap[eap] || ''
      return /apenas material/i.test(d) && /^\s*(a[çc]o\b|material forma)/i.test(d)
    }
    const MATERIAL_AGREGADO = new Set(Object.keys(custoPorEap).filter(ehMaterialAgregado))
    const paresNaoEncontrados = []
    const paresResolvidos = {}
    Object.entries(AGREGADO_HERDA).forEach(([eap, pares]) => {
      const codigos = []
      pares.forEach((par) => {
        if (par.startsWith('desc:')) {
          const alvo = par.slice(5).trim().toLowerCase()
          const subgrupo = String(eap).split('.').slice(0, 2).join('.') + '.'
          const achados = Object.keys(descPorEap).filter(
            (c) =>
              c !== eap &&
              String(c).startsWith(subgrupo) &&
              descPorEap[c].trim().toLowerCase().startsWith(alvo)
          )
          if (!achados.length) paresNaoEncontrados.push(`${eap} -> ${par}`)
          achados.forEach((c) => codigos.push(c))
        } else if (custoPorEap[par] != null) codigos.push(par)
        else paresNaoEncontrados.push(`${eap} -> ${par}`)
      })
      if (codigos.length) paresResolvidos[eap] = Array.from(new Set(codigos))
    })

    // Percentual medido por codigo em cada semana (ultimo retrato ate ela).
    const retratosOrd = retratos
      .map((r) => ({ eap: r.codigo_eap, w: parseInt(r.semana_numero, 10), d: String(r.data_lancamento || ''), id: r.id || 0, perc: num(r.percentual_realizado) }))
      .filter((r) => Number.isFinite(r.w))
      .sort((a, b) => a.w - b.w || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0) || a.id - b.id)
    const percMedido = {}
    const semanaMedida = {}
    let iRet = 0
    const percPorSemana = new Map()
    semanasOrdenadas.forEach((w) => {
      while (iRet < retratosOrd.length && retratosOrd[iRet].w <= w) {
        const r = retratosOrd[iRet]
        percMedido[r.eap] = r.perc
        semanaMedida[r.eap] = r.w
        iRet += 1
      }
      percPorSemana.set(w, { perc: { ...percMedido }, semana: { ...semanaMedida } })
    })

    const regraAgregado = (eap) =>
      AGREGADO_POR_TEMPO.has(eap) ? 'tempo' : paresResolvidos[eap] ? 'herda' : 'medido'
    // Percentual do item na semana w, pela regra dele.
    const percAgregado = (eap, w) => {
      const regra = regraAgregado(eap)
      if (regra === 'tempo') return ((diasAcum.get(w) || 0) / totalDias) * 100
      const snap = percPorSemana.get(w) || { perc: {} }
      if (regra === 'herda') {
        const pares = paresResolvidos[eap]
        const peso = pares.reduce((t, c) => t + (custoPorEap[c] || 0), 0)
        if (peso <= 0) return 0
        return pares.reduce((t, c) => t + (custoPorEap[c] || 0) * (snap.perc[c] || 0), 0) / peso
      }
      return snap.perc[eap] || 0
    }
    const agregadoRota = new Map()
    const agregadoMedido = new Map()
    semanasOrdenadas.forEach((w) => {
      let total = 0
      let medido = 0
      Object.keys(custoPorEap).forEach((eap) => {
        const v = (custoPorEap[eap] * percAgregado(eap, w)) / 100
        total += v
        if (regraAgregado(eap) !== 'tempo') medido += v
      })
      agregadoRota.set(w, total)
      agregadoMedido.set(w, medido)
    })

    const R = COLS.realizado
    const bcwpAPorSemana = new Map()
    const bcwpViewCusto = new Map()
    const bcwpABases = new Map()
    const dataFimDaView = new Map()
    realizadoRaw.forEach((row) => {
      const s = parseInt(row[R.semana], 10)
      if (!Number.isFinite(s)) return
      // Em base Hh o BCWP e o avanco em horas convertido para reais pelo peso
      // da parcela A. Em base custo vem pronto da view.
      bcwpViewCusto.set(s, num(row[R.bcwpA]))
      const porCusto = agregadoRota.has(s) ? agregadoRota.get(s) : num(row[R.bcwpA])
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
    if (!ancora && !cal.semanas.length) throw new Error(`calendario_semanas vazio e ${R.table} sem ${R.dataFim}: sem calendario nao da para semanalizar o custo`)

    semanasOrdenadas.forEach((s) => {
      const p = plan.get(s)
      const c = cal.porSemana.get(s)
      p.data_fim = c
        ? c.data_fim
        : dataFimDaView.has(s)
          ? dataFimDaView.get(s)
          : addDias(ancora.data_fim, (s - ancora.semana) * 7)
      p.data_inicio = c ? c.data_inicio : addDias(p.data_fim, -6)
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
    // Usa so os itens medidos: a verba por tempo cresce toda semana e faria
    // parecer que houve medicao nova.
    semanasOrdenadas.forEach((s) => {
      const v = agregadoMedido.has(s) ? agregadoMedido.get(s) : bcwpAPorSemana.get(s)
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

    // Inicio da S1 (data_inicio do calendario). Sem esse piso, todo lancamento
    // anterior a obra (pre-obra, mobilizacao, projeto) caía na S1, inflando o
    // ACWP e a parcela B da primeira semana.
    const inicioDaObra = fimDeSemana.length ? plan.get(fimDeSemana[0].semana).data_inicio : null

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
    // Parcela de cada codigo, pelo grupo do orcamento: 1-16 = A, 17 = B, 18 = C.
    // O ACWP precisa dessa separacao para o CPI da producao existir: somado,
    // o custo de locacao e funcionarios (CPI 1 por construcao) dilui o indice.
    const parcelaPorEap = {}
    const eapEmMaisDeUmaParcela = new Set()
    orcamento.forEach((it) => {
      const eap = it.cod_eap
      if (!eap) return
      const g = Number(it.grupo_numero)
      const parcela = g >= 1 && g <= 16 ? 'a' : g === 17 ? 'b' : g === 18 ? 'c' : null
      if (parcela && !ehIndireto(eap)) {
        if (parcelaPorEap[eap] && parcelaPorEap[eap] !== parcela) eapEmMaisDeUmaParcela.add(eap)
        parcelaPorEap[eap] = parcelaPorEap[eap] || parcela
      }
      if (g === 17) {
        eapGrupo17.add(eap)
        tetoPorEap[eap] = (tetoPorEap[eap] || 0) + num(it.preco_total)
      }
    })

    // incorridoB[semana][eap] -> valor da semana; acwp[semana] -> direto da semana
    const incorridoBPorSemana = new Map()
    const acwpPorSemana = new Map()
    // acwpParcelaPorSemana[semana] -> { a, b, c, nc }. nc = lancamento direto
    // cujo codigo nao esta no orcamento: entra no ACWP total (o card de custo
    // realizado nao muda), mas nao contamina o CPI de nenhuma parcela.
    const acwpParcelaPorSemana = new Map()
    const acwpIndiretoPorSemana = new Map()
    const eapsNaoClassificados = {}
    // Pago por codigo em cada semana (so direto): base do saldo por item.
    const pagoEapPorSemana = new Map()

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
          if (!pagoEapPorSemana.has(s)) pagoEapPorSemana.set(s, {})
          const pe = pagoEapPorSemana.get(s)
          pe[eap] = (pe[eap] || 0) + valor
          const parcela = parcelaPorEap[eap] || 'nc'
          if (!acwpParcelaPorSemana.has(s)) acwpParcelaPorSemana.set(s, { a: 0, b: 0, c: 0, nc: 0 })
          acwpParcelaPorSemana.get(s)[parcela] += valor
          if (parcela === 'nc') eapsNaoClassificados[eap || '(vazio)'] = (eapsNaoClassificados[eap || '(vazio)'] || 0) + valor
        }
        if (eapGrupo17.has(eap)) {
          if (!incorridoBPorSemana.has(s)) incorridoBPorSemana.set(s, {})
          const bucket = incorridoBPorSemana.get(s)
          bucket[eap] = (bucket[eap] || 0) + valor
        }
      })

    // Pago acumulado das linhas de material ate cada semana, para a regra do
    // agregado do material. O a pagar e o do ultimo fechamento, o mesmo que
    // entra no denominador do IPC.
    const pagoMaterialAte = new Map()
    {
      const acc = {}
      semanasOrdenadas.forEach((w) => {
        const pe = pagoEapPorSemana.get(w) || {}
        MATERIAL_AGREGADO.forEach((eap) => (acc[eap] = (acc[eap] || 0) + (pe[eap] || 0)))
        pagoMaterialAte.set(w, { ...acc })
      })
    }
    const materialNaSemana = (eap, w) => {
      const orcado = custoPorEap[eap] || 0
      const heranca = (orcado * percAgregado(eap, w)) / 100
      const custo = ((pagoMaterialAte.get(w) || {})[eap] || 0) + (aPagarPorEap[eap] || 0)
      const porCusto = Math.min(custo, orcado)
      return {
        heranca,
        custo,
        agregado: Math.max(heranca, porCusto),
        perc_orcado: orcado > 0 ? (custo / orcado) * 100 : null,
        // Material comprado antes da execucao: o custo segura o agregado
        comprado: porCusto > heranca + 0.005,
      }
    }
    // Agregado do codigo na semana, pela regra dele (material ou percentual).
    const agregadoItem = (eap, w) =>
      MATERIAL_AGREGADO.has(eap)
        ? materialNaSemana(eap, w).agregado
        : ((custoPorEap[eap] || 0) * percAgregado(eap, w)) / 100
    semanasOrdenadas.forEach((w) => {
      let delta = 0
      MATERIAL_AGREGADO.forEach((eap) => {
        const m = materialNaSemana(eap, w)
        delta += m.agregado - m.heranca
      })
      if (!delta) return
      agregadoRota.set(w, (agregadoRota.get(w) || 0) + delta)
      if (bcwpABases.has(w)) {
        const b = bcwpABases.get(w)
        b.custo += delta
        if (BASE_PARCELA_A === 'custo') bcwpAPorSemana.set(w, b.custo)
      }
    })

    // -----------------------------------------------------------------------
    // 4. Curva completa: 87 pontos, planejado sempre, realizado ate semanaAtual
    // -----------------------------------------------------------------------
    const incorridoAcumPorEap = {}
    let acwpAcum = 0
    const pagoEapAcum = {}
    // Saldo por item da producao. O realizado e o que foi PAGO; o agregado e o
    // que foi EXECUTADO. Item em aberto (boleto a vencer, parcela, medicao do
    // empreiteiro ainda nao paga) entra no saldo pelo menor entre agregado e
    // pago: mostra estouro, nunca economia que ainda vai sair do caixa. Item
    // com custo_encerrado = true no orcamento entra pelo agregado cheio.
    const saldoProducaoNaSemana = (w) => {
      let agregadoSaldo = 0
      let aguardando = 0
      let itensAPagar = 0
      let agEnc = 0
      let pagoEnc = 0
      Object.keys(custoPorEap).forEach((eap) => {
        const ag = agregadoItem(eap, w)
        const pago = pagoEapAcum[eap] || 0
        if (encerradoPorEap[eap]) {
          agregadoSaldo += ag
          agEnc += ag
          pagoEnc += pago
        } else {
          agregadoSaldo += Math.min(ag, pago)
          if (ag > pago + 0.005) {
            aguardando += ag - pago
            itensAPagar += 1
          }
        }
      })
      return { agregadoSaldo, aguardando, itensAPagar, agEnc, pagoEnc }
    }
    const acwpParcelaAcum = { a: 0, b: 0, c: 0, nc: 0 }
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
      const pes = pagoEapPorSemana.get(s)
      if (pes) Object.keys(pes).forEach((k) => (pagoEapAcum[k] = (pagoEapAcum[k] || 0) + pes[k]))
      const dp = acwpParcelaPorSemana.get(s)
      if (dp) Object.keys(acwpParcelaAcum).forEach((k) => (acwpParcelaAcum[k] += dp[k]))
      indiretoPlanAcum += indiretoSemanal.get(s) || 0
      indiretoRealAcum += acwpIndiretoPorSemana.get(s) || 0

      const temRealizado = s <= semanaAtual
      const bcwpABase = bcwpAPorSemana.get(s) || 0

      curva.push({
        semana: s,
        data_inicio: p.data_inicio,
        data_fim: p.data_fim,
        dias: diasDe(s),
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
        acwp_a: r2(acwpParcelaAcum.a),
        acwp_b: r2(acwpParcelaAcum.b),
        acwp_c: r2(acwpParcelaAcum.c),
        acwp_nao_classificado: r2(acwpParcelaAcum.nc),
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
        ...(() => {
          if (!temRealizado)
            return { bcwp_a_saldo: null, aguardando_pagamento: null, itens_a_pagar: null, agregado_encerrado: null, pago_encerrado: null }
          const sp = saldoProducaoNaSemana(s)
          return {
            bcwp_a_saldo: r2(sp.agregadoSaldo),
            aguardando_pagamento: r2(sp.aguardando),
            itens_a_pagar: sp.itensAPagar,
            agregado_encerrado: r2(sp.agEnc),
            pago_encerrado: r2(sp.pagoEnc),
          }
        })(),
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
      return (valor * somaDias(alvo.filter((w) => semanasAte.has(w)))) / somaDias(alvo)
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
      // Valor agregado da linha: orcado x % executado do codigo na semana,
      // pela mesma regra do card (medido, herda ou tempo). Fora do EVM
      // (locacao, funcionarios) nao ha % executado.
      const orcado = num(it.preco_total)
      const perc = it.entra_evm && it.cod_eap ? percAgregado(it.cod_eap, semanaAtual) : null
      // Material: regra propria, na parte desta linha do orcado do codigo
      const mat = it.entra_evm && MATERIAL_AGREGADO.has(it.cod_eap) ? materialNaSemana(it.cod_eap, semanaAtual) : null
      const fatia = mat && custoPorEap[it.cod_eap] > 0 ? orcado / custoPorEap[it.cod_eap] : 1
      const agregado = perc == null ? null : mat ? mat.agregado * fatia : (orcado * perc) / 100
      linha.planejado += plan
      linha.realizado += real
      linha.orcado = (linha.orcado || 0) + orcado
      linha.agregado = (linha.agregado || 0) + (agregado || 0)
      linha.mes_inicio = Math.min(linha.mes_inicio, parseInt(it.mes_inicio, 10) || 1)
      linha.mes_fim = Math.max(linha.mes_fim, parseInt(it.mes_fim, 10) || 1)
      linha.itens.push({
        cod_eap: it.cod_eap,
        descricao: it.descricao || '',
        pavimento: it.pavimento || null,
        mes_inicio: parseInt(it.mes_inicio, 10) || null,
        mes_fim: parseInt(it.mes_fim, 10) || null,
        planejado: r2(plan),
        realizado: r2(real),
        planejado_total: r2(orcado),
        perc_executado: perc == null ? null : r2(perc),
        agregado: agregado == null ? null : r2(agregado),
        // So nas linhas de material: (pago + a pagar) / orcado e a marcacao
        // de material comprado antes da execucao
        material: !!mat,
        perc_orcado: mat && mat.perc_orcado != null ? r2(mat.perc_orcado) : null,
        material_comprado: mat ? mat.comprado : null,
        agregado_heranca: mat ? r2(mat.heranca * fatia) : null,
        // Eficiencia de custo = agregado / (realizado + a pagar do codigo).
        // Sem medicao (agregado zero ou fora do EVM) ou sem custo, fica nula
        // e a tela mostra "—".
        a_pagar: r2(aPagarPorEap[it.cod_eap] || 0),
        eficiencia: agregado > 0 && real + (aPagarPorEap[it.cod_eap] || 0) > 0
          ? r3(agregado / (real + (aPagarPorEap[it.cod_eap] || 0)))
          : null,
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
        orcado: r2(g.orcado || 0),
        agregado: r2(g.agregado || 0),
        itens: g.itens.sort((a, b) =>
          String(a.cod_eap).localeCompare(String(b.cod_eap), 'pt-BR', { numeric: true })
        ),
        // Mesma regra do painel de avanco: estrutura e alvenaria abrem por
        // pavimento; os outros ficam em lista unica.
        por_pavimento: GRUPOS_POR_PAVIMENTO.has(g.grupo),
        pavimentos: !GRUPOS_POR_PAVIMENTO.has(g.grupo)
          ? []
          : (() => {
              const m = new Map()
              g.itens.forEach((i) => {
                const p = i.pavimento || 'Sem pavimento'
                if (!m.has(p)) m.set(p, { pavimento: p, planejado: 0, realizado: 0, orcado: 0, agregado: 0, itens: [] })
                const b = m.get(p)
                b.planejado += i.planejado
                b.realizado += i.realizado
                b.orcado += i.planejado_total
                b.agregado += i.agregado || 0
                b.itens.push(i)
              })
              return Array.from(m.values())
                .map((b) => ({
                  pavimento: b.pavimento,
                  planejado: r2(b.planejado),
                  realizado: r2(b.realizado),
                  orcado: r2(b.orcado),
                  agregado: r2(b.agregado),
                  itens: b.itens.sort((x, y) =>
                    String(x.cod_eap).localeCompare(String(y.cod_eap), 'pt-BR', { numeric: true })
                  ),
                }))
                .sort((x, y) =>
                  String(x.pavimento).localeCompare(String(y.pavimento), 'pt-BR', { numeric: true })
                )
            })(),
      }))

    // Abertura do indireto por categoria, mesma logica: planejado rateado
    // (mes_desembolso > 0 no mes; = 0 pela obra inteira) e truncado na semana;
    // realizado somado dos lancamentos com codigo de indireto ate a semana.
    const realizadoIndiretoPorEap = {}
    const lancamentosIndiretoPorEap = {}
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
        if (!lancamentosIndiretoPorEap[eap]) lancamentosIndiretoPorEap[eap] = []
        lancamentosIndiretoPorEap[eap].push({
          semana: w,
          data: dataDoLancamento(l) ? iso10(dataDoLancamento(l)) : null,
          competencia: l.competencia || null,
          fornecedor: l.fornecedor || '',
          historico: l.historico || '',
          valor: r2(num(l.valor)),
        })
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
        const plan = alvo.length ? (valor * somaDias(alvo.filter((w) => semanasAte.has(w)))) / somaDias(alvo) : 0
        const real = realizadoIndiretoPorEap[it.cod_eap] || 0
        return {
          cod_eap: it.cod_eap,
          categoria: it.categoria || it.cod_eap || 'Sem categoria',
          mes_desembolso: Number.isFinite(m) ? m : null,
          planejado: r2(plan),
          planejado_total: r2(valor),
          realizado: r2(real),
          lancamentos: (lancamentosIndiretoPorEap[it.cod_eap] || []).sort((a, b) =>
            String(a.data || '').localeCompare(String(b.data || ''))
          ),
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
      return (somaDias(alvo.filter((w) => semanasAte.has(w))) / somaDias(alvo)) * 100
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

    // -----------------------------------------------------------------------
    // Memoria de calculo do valor agregado (so com ?memoria=1).
    //   A  item a item: ultimo percentual medido x custo total do item
    //   B  locacao: incorrido acumulado ate a semana, limitado ao orcado do item
    //   C  funcionarios: o planejado da curva ate a semana (tempo decorrido)
    // A soma da parcela A e conferida contra o bcwp_a_custo da view: se a view
    // calcular diferente, a diferenca aparece em vez de sumir.
    // -----------------------------------------------------------------------
    let memoriaAgregado = null
    if (req.query.memoria) {
      const pontoMem = curva.find((x) => x.semana === semanaAtual) || curva[curva.length - 1]
      const pagoAteSemana = {}
      pagoEapPorSemana.forEach((bucket, w) => {
        if (w > semanaAtual) return
        Object.keys(bucket).forEach((k) => (pagoAteSemana[k] = (pagoAteSemana[k] || 0) + bucket[k]))
      })
      const itensA = []
      orcamento.forEach((it) => {
        if (!it.entra_evm) return
        const g = parseInt(it.grupo_numero, 10)
        const regra = regraAgregado(it.cod_eap)
        const perc = percAgregado(it.cod_eap, semanaAtual)
        const snap = percPorSemana.get(semanaAtual) || { semana: {} }
        const custo = num(it.preco_total)
        itensA.push({
          encerrado: !!encerradoPorEap[it.cod_eap],
          regra,
          herda_de: regra === 'herda' ? paresResolvidos[it.cod_eap] : null,
          grupo: g,
          grupo_nome: it.grupo_nome || it.macrogrupo || ('Grupo ' + g),
          cod_eap: it.cod_eap,
          descricao: it.descricao || '',
          pavimento: it.pavimento || null,
          custo_total: r2(custo),
          perc_fisico: r2(perc),
          medido_na_semana: regra === 'medido' ? snap.semana[it.cod_eap] || null : null,
          material: MATERIAL_AGREGADO.has(it.cod_eap),
          agregado: r2(
            MATERIAL_AGREGADO.has(it.cod_eap) && custoPorEap[it.cod_eap] > 0
              ? (agregadoItem(it.cod_eap, semanaAtual) * custo) / custoPorEap[it.cod_eap]
              : (custo * perc) / 100
          ),
        })
      })
      itensA.sort(
        (x, y) =>
          x.grupo - y.grupo ||
          String(x.cod_eap).localeCompare(String(y.cod_eap), 'pt-BR', { numeric: true }) ||
          String(x.pavimento || '').localeCompare(String(y.pavimento || ''), 'pt-BR', { numeric: true })
      )
      const somaA = itensA.reduce((t, i) => t + i.agregado, 0)

      const incorridoAte = {}
      incorridoBPorSemana.forEach((bucket, w) => {
        if (w > semanaAtual) return
        Object.keys(bucket).forEach((eap) => (incorridoAte[eap] = (incorridoAte[eap] || 0) + bucket[eap]))
      })
      const itensB = orcamento
        .filter((it) => Number(it.grupo_numero) === 17)
        .map((it) => {
          const incorrido = incorridoAte[it.cod_eap] || 0
          const teto = tetoPorEap[it.cod_eap] != null ? tetoPorEap[it.cod_eap] : incorrido
          return {
            cod_eap: it.cod_eap,
            descricao: it.descricao || '',
            custo_total: r2(num(it.preco_total)),
            incorrido: r2(incorrido),
            teto: r2(teto),
            agregado: r2(Math.min(incorrido, teto)),
          }
        })
      // Varias linhas do grupo 17 podem ter o mesmo codigo: o incorrido e o
      // teto sao por codigo, entao a linha repetida nao soma de novo.
      const vistosB = new Set()
      const itensBUnicos = itensB.filter((i) => (vistosB.has(i.cod_eap) ? false : vistosB.add(i.cod_eap)))

      memoriaAgregado = {
        semana: semanaAtual,
        data_fim: pontoMem.data_fim,
        parcela_a: {
          criterio: 'percentual do ultimo retrato x custo total do item',
          itens: itensA,
          soma: r2(somaA),
          // A soma tem que bater com o card (mesmo calculo). A view do banco
          // fica so como referencia: a diferenca e o efeito das regras.
          dashboard: pontoMem.bcwp_a_custo,
          saldo_agregado: pontoMem.bcwp_a_saldo,
          aguardando_pagamento: pontoMem.aguardando_pagamento,
          // Pago e agregado por codigo (varias linhas por pavimento somam num
          // codigo so; o pagamento e lancado por codigo).
          por_codigo: Object.fromEntries(
            Object.keys(custoPorEap).map((eap) => {
              const ag = agregadoItem(eap, semanaAtual)
              const pago = pagoAteSemana[eap] || 0
              const enc = !!encerradoPorEap[eap]
              return [eap, { agregado: r2(ag), pago: r2(pago), encerrado: enc,
                saldo: r2((enc ? ag : Math.min(ag, pago)) - pago),
                aguardando: r2(enc ? 0 : Math.max(ag - pago, 0)) }]
            })
          ),
          diferenca_vs_dashboard: pontoMem.bcwp_a_custo == null ? null : r2(somaA - pontoMem.bcwp_a_custo),
          view_banco: bcwpViewCusto.has(semanaAtual) ? r2(bcwpViewCusto.get(semanaAtual)) : null,
        },
        parcela_b: {
          criterio: 'custo incorrido ate a semana, limitado ao orcado do item',
          itens: itensBUnicos,
          soma: r2(itensBUnicos.reduce((t, i) => t + i.agregado, 0)),
          curva: pontoMem.bcwp_b,
        },
        parcela_c: {
          criterio: 'tempo decorrido: planejado da curva ate a semana',
          orcado: r2(totais.c),
          agregado: pontoMem.bcwp_c,
        },
        total: pontoMem.bcwp_a_custo == null ? null : r2(pontoMem.bcwp_a_custo + pontoMem.bcwp_b + pontoMem.bcwp_c),
      }
    }

    const somaGruposPlan = grupos.reduce((t, g) => t + g.planejado, 0)
    const somaGruposReal = grupos.reduce((t, g) => t + g.realizado, 0)

    // -----------------------------------------------------------------------
    // 5. KPIs da semana selecionada
    // -----------------------------------------------------------------------
    const ponto = curva.find((x) => x.semana === semanaAtual) || curva[curva.length - 1]

    const spi = (bcwp, bcws) => (bcws > 0 && bcwp != null ? bcwp / bcws : null)
    const cpiDe = (bcwp, acwp) => (acwp > 0 && bcwp != null ? bcwp / acwp : null)
    const cvDe = (bcwp, acwp) => (bcwp != null ? r2(bcwp - acwp) : null)
    // O saldo pelo avanco usa sempre a parcela A por custo (percentual x custo
    // do item), independente de BASE_PARCELA_A: e a definicao em reais que os
    // diretores pediram — alvenaria de 10 mil a 50% deveria ter custado 5 mil.
    const bcwpACusto = ponto.bcwp_a_custo
    const bcwpCustoTotal = bcwpACusto == null ? null : bcwpACusto + ponto.bcwp_b + ponto.bcwp_c

    // -----------------------------------------------------------------------
    // 5a. Projecao do custo direto no termino, na ultima semana medida.
    // Agregado e realizado precisam estar na mesma data: projetar na semana
    // corrente com o fisico parado na ultima medicao compara duas semanas de
    // gasto a mais contra o mesmo servico executado.
    // -----------------------------------------------------------------------
    const semanaRef = Math.min(semanaAtual, ultimaSemanaComAvanco || semanaAtual)
    const ref = curva.find((x) => x.semana === semanaRef) || ponto
    const agregadoRef = ref.bcwp_a_custo == null ? null : ref.bcwp_a_custo + ref.bcwp_b + ref.bcwp_c
    const orcadoDireto = totais.total
    const indiretoCalendario = indiretos
      .filter((it) => parseInt(it.mes_desembolso, 10) === 0 && !INDIRETO_FORA_DO_CALENDARIO.has(it.cod_eap))
      .reduce((t, it) => t + num(it.valor_total), 0)
    const custoCalendarioTotal = totais.b + totais.c + indiretoCalendario
    // Duracao da obra em semanas de 7 dias (a contagem de semanas do calendario
    // muda com as semanas partidas; o prazo em dias, nao).
    const duracaoSemanas = totalDias / 7 || TOTAL_SEMANAS
    const custoPorSemana = custoCalendarioTotal / duracaoSemanas

    let projecao = null
    // IPC (decisao out/26) = agregado do direto / (realizado do direto + a
    // pagar do direto). Substitui a regra de custo encerrado. IDP pelo avanco
    // fisico em Hh, as duas pontas na semana de referencia (igual a tela).
    const comprometidoRef = ref.acwp + aPagarDireto
    if (agregadoRef != null && agregadoRef > 0 && comprometidoRef > 0 && ref.avanco_plan_hh > 0 && ref.avanco_real_hh != null) {
      const idc = agregadoRef / comprometidoRef
      const idp = ref.avanco_real_hh / ref.avanco_plan_hh
      // Adiantamento nao barateia a obra: no pessimista o IDP fica ate 1.
      const idpPess = Math.min(idp, 1)
      // Falta = o que ainda nao foi executado, a preco de orcamento.
      const falta = orcadoDireto - agregadoRef
      const duracao = duracaoSemanas
      // Se o ritmo atual se mantiver, a obra dura duracao / IDP. Obra
      // adiantada (IDP > 1) nao gera credito de calendario: fica em zero.
      const semanasExtras = Math.max(duracao / idp - duracao, 0)
      const otimista = comprometidoRef + falta / idc
      const custoAtraso = custoPorSemana * semanasExtras
      projecao = {
        semana_referencia: semanaRef,
        orcado: r2(orcadoDireto),
        agregado: r2(agregadoRef),
        realizado: r2(ref.acwp),
        a_pagar: r2(aPagarDireto),
        planejado: r2(ref.bcws),
        falta: r2(falta),
        idc: r3(idc),
        idp: r3(idp),
        otimista: r2(otimista),
        provavel: r2(otimista + custoAtraso),
        pessimista: r2(comprometidoRef + falta / (idc * idpPess)),
        semanas_extras: r2(semanasExtras),
        duracao_semanas: r2(duracao),
        custo_calendario_semana: r2(custoPorSemana),
        custo_atraso: r2(custoAtraso),
        calendario: {
          locacao_b: r2(totais.b),
          funcionarios_c: r2(totais.c),
          indireto: r2(indiretoCalendario),
          indireto_itens: indiretos
            .filter((it) => parseInt(it.mes_desembolso, 10) === 0 && !INDIRETO_FORA_DO_CALENDARIO.has(it.cod_eap))
            .map((it) => ({ cod_eap: it.cod_eap, categoria: it.categoria, valor: r2(num(it.valor_total)) })),
        },
      }
    }

    // -----------------------------------------------------------------------
    // 5b. IPC do mes (decisao out/26): mensal, cortado no ULTIMO DIA do mes do
    // fechamento, por data e nao por semana.
    //   avanco: ultimo retrato de cada item lancado ate o corte (dia de BH)
    //   custo: realizado do direto pago ate o corte + a pagar do fechamento
    //   material: pago ate o corte + a pagar, limitado ao orcado (regra acima)
    //   B: locacao paga ate o corte, com teto; C: planejado da curva no corte
    // O planejado no corte e interpolado por dias dentro da semana (com o
    // calendario alinhado ao mes, o corte e sempre o fim de uma semana).
    // -----------------------------------------------------------------------
    const diaBH = (ts) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date(ts))
    const fimDoMes = (mes) => {
      const [fy, fm] = mes.split('-').map(Number)
      return new Date(Date.UTC(fy, fm, 0)).toISOString().slice(0, 10)
    }
    const calcIpcMes = (mes, apPorEap, apDireto) => {
      const corte = fimDoMes(mes)
      const percCorte = {}
      retratosOrd
        .filter((r) => r.d && diaBH(r.d) <= corte)
        .forEach((r) => (percCorte[r.eap] = r.perc))
      // Fracao da obra decorrida no corte e planejado interpolado
      const iFim = semanasOrdenadas.findIndex((w) => plan.get(w).data_fim >= corte)
      const wFim = iFim >= 0 ? semanasOrdenadas[iFim] : ultimaSemana
      const wAnt = iFim > 0 ? semanasOrdenadas[iFim - 1] : null
      const inicioW = plan.get(wFim).data_inicio
      const diasW = Math.round((Date.parse(plan.get(wFim).data_fim) - Date.parse(inicioW)) / 864e5) + 1
      const diasAte = Math.round((Date.parse(corte) - Date.parse(inicioW)) / 864e5) + 1
      const fr = Math.min(Math.max(diasAte / diasW, 0), 1)
      const interp = (campo) => {
        const a = wAnt ? plan.get(wAnt)[campo] : 0
        return a + (plan.get(wFim)[campo] - a) * fr
      }
      const diasObraCorte = (wAnt ? diasAcum.get(wAnt) : 0) + diasDe(wFim) * fr
      const percItemCorte = (eap) => {
        const regra = regraAgregado(eap)
        if (regra === 'tempo') return (Math.min(diasObraCorte, totalDias) / totalDias) * 100
        if (regra === 'herda') {
          const pares = paresResolvidos[eap]
          const peso = pares.reduce((t, c) => t + (custoPorEap[c] || 0), 0)
          return peso > 0 ? pares.reduce((t, c) => t + (custoPorEap[c] || 0) * (percCorte[c] || 0), 0) / peso : 0
        }
        return percCorte[eap] || 0
      }
      const pagoCorte = {}
      let realizadoDireto = 0
      lancamentos
        .filter((l) => l.status === 'Normal')
        .forEach((l) => {
          const eap = l.codigo_eap || ''
          if (ehIndireto(eap)) return
          const dt = dataDoLancamento(l)
          const d = dt ? iso10(dt) : `${String(l.competencia || '').slice(0, 7)}-01`
          if (d > corte) return
          realizadoDireto += num(l.valor)
          pagoCorte[eap] = (pagoCorte[eap] || 0) + num(l.valor)
        })
      let agA = 0
      const linhasMaterial = []
      Object.keys(custoPorEap).forEach((eap) => {
        const orc = custoPorEap[eap]
        const heranca = (orc * percItemCorte(eap)) / 100
        if (!MATERIAL_AGREGADO.has(eap)) return (agA += heranca)
        const pago = pagoCorte[eap] || 0
        const aPagar = apPorEap[eap] || 0
        const ag = Math.max(heranca, Math.min(pago + aPagar, orc))
        agA += ag
        linhasMaterial.push({
          cod_eap: eap,
          descricao: descPorEap[eap],
          orcado: r2(orc),
          avanco_servico: r2(percItemCorte(eap)),
          heranca: r2(heranca),
          pago: r2(pago),
          a_pagar: r2(aPagar),
          perc_orcado: orc > 0 ? r2(((pago + aPagar) / orc) * 100) : null,
          agregado: r2(ag),
          material_comprado: Math.min(pago + aPagar, orc) > heranca + 0.005,
          eficiencia: pago + aPagar > 0 ? r3(ag / (pago + aPagar)) : null,
        })
      })
      const agB = Object.keys(tetoPorEap).reduce(
        (t, eap) => t + Math.min(pagoCorte[eap] || 0, tetoPorEap[eap]),
        0
      )
      const agC = interp('c')
      const hhReal = orcamento.reduce(
        (t, it) => (it.entra_evm ? t + (num(it.hh) * (percCorte[it.cod_eap] || 0)) / 100 : t),
        0
      )
      const avancoReal = totalHhEvm > 0 ? (hhReal / totalHhEvm) * 100 : null
      const avancoPlan = interp('perc_hh')
      const agregadoTotal = agA + agB + agC
      const comprometido = realizadoDireto + apDireto
      return {
        mes,
        data_corte: corte,
        semana_do_corte: wFim,
        fracao_da_semana: r3(fr),
        avanco_fisico_planejado: r2(avancoPlan),
        avanco_fisico_realizado: avancoReal == null ? null : r2(avancoReal),
        idp: avancoPlan > 0 && avancoReal != null ? r3(avancoReal / avancoPlan) : null,
        agregado: r2(agregadoTotal),
        agregado_a: r2(agA),
        agregado_b: r2(agB),
        agregado_c: r2(agC),
        realizado_direto: r2(realizadoDireto),
        a_pagar_direto: r2(apDireto),
        ipc: comprometido > 0 ? r3(agregadoTotal / comprometido) : null,
        linhas_material: linhasMaterial.sort((a, b) =>
          String(a.cod_eap).localeCompare(String(b.cod_eap), 'pt-BR', { numeric: true })
        ),
      }
    }
    // Ultimo fechamento de contas a pagar (o card e a conferencia usam este)
    const ipcFechamento = contas.disponivel && contas.fechamento ? calcIpcMes(contas.fechamento, aPagarPorEap, aPagarDireto) : null

    // IPC mostrado na semana selecionada (decisao out/26): na semana de
    // fechamento (a que termina no ultimo dia do mes), o IPC daquele mes; nas
    // semanas do meio, o do ultimo mes fechado ("IPC de <mes>"). So vale mes
    // com contas a pagar carregado: sem ele, fica o fechamento anterior mais
    // recente. Antes do primeiro fechamento com contas a pagar, o IPC sai sem
    // o a pagar e com aviso.
    let ipcMes = null
    {
      const fimSel = plan.get(semanaAtual) ? plan.get(semanaAtual).data_fim : null
      if (fimSel) {
        const mesSel = fimSel.slice(0, 7)
        const semanaDeFechamento = fimSel === fimDoMes(mesSel)
        const [sy, sm] = mesSel.split('-').map(Number)
        const mesAnterior = new Date(Date.UTC(sy, sm - 2, 1)).toISOString().slice(0, 7)
        const alvo = semanaDeFechamento ? mesSel : mesAnterior
        const fechamentos = contas.disponivel ? await listarFechamentos(supabase, obra_id) : []
        const fech = fechamentos.filter((f) => f <= alvo).pop() || null
        // Primeiro mes da obra = o da primeira semana do mes 1 (jul/2026)
        const s1 = semanasOrdenadas.find((w) => plan.get(w).mes === 1)
        const inicioObra = s1 ? plan.get(s1).data_fim.slice(0, 7) : inicioDaObra ? inicioDaObra.slice(0, 7) : null
        let calc = null
        if (inicioObra && alvo < inicioObra) calc = null
        else if (fech === contas.fechamento) calc = ipcFechamento
        else if (fech) {
          const c = await carregarContasAPagar(supabase, obra_id, fech)
          const rc = resumirContas(c.linhas)
          calc = calcIpcMes(fech, rc.por_eap_direto, rc.totais.ipc_direto)
        } else calc = calcIpcMes(alvo, {}, 0)
        if (calc) {
          const { linhas_material, ...resto } = calc
          ipcMes = {
            ...resto,
            semana_de_fechamento: semanaDeFechamento && calc.mes === mesSel,
            sem_contas_a_pagar: !fech,
          }
        }
      }
    }

    const kpis = {
      ipc_fechamento: ipcFechamento,
      ipc_mes: ipcMes,
      semana: ponto.semana,
      data_fim: ponto.data_fim,
      bcws: ponto.bcws,
      bcwp: ponto.bcwp,
      acwp: ponto.acwp,
      spi: r3(spi(ponto.bcwp, ponto.bcws)),
      // IPC com o a pagar do direto no denominador (decisao out/26)
      cpi: ponto.acwp + aPagarDireto > 0 && ponto.bcwp != null ? r3(ponto.bcwp / (ponto.acwp + aPagarDireto)) : null,
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
          acwp: ponto.acwp_a,
          cpi: r3(cpiDe(bcwpACusto, ponto.acwp_a)),
          cv: cvDe(bcwpACusto, ponto.acwp_a),
        },
        b: {
          criterio: 'custo incorrido limitado ao planejado',
          bcws: ponto.bcws_b,
          bcwp: ponto.bcwp_b,
          spi: r3(spi(ponto.bcwp_b, ponto.bcws_b)),
          acwp: ponto.acwp_b,
          cpi: r3(cpiDe(ponto.bcwp_b, ponto.acwp_b)),
          cv: cvDe(ponto.bcwp_b, ponto.acwp_b),
        },
        c: {
          criterio: 'tempo decorrido',
          bcws: ponto.bcws_c,
          bcwp: ponto.bcwp_c,
          spi: r3(spi(ponto.bcwp_c, ponto.bcws_c)),
          acwp: ponto.acwp_c,
          cpi: r3(cpiDe(ponto.bcwp_c, ponto.acwp_c)),
          cv: cvDe(ponto.bcwp_c, ponto.acwp_c),
        },
        nao_classificado: { acwp: ponto.acwp_nao_classificado },
      },
      projecao,
      // Saldo proporcional ao avanco = BCWP (por custo) - ACWP. Em reais as
      // parcelas somam sem distorcao; a diluicao de B e C so afeta o indice.
      saldo_avanco: {
        bcwp: bcwpCustoTotal == null ? null : r2(bcwpCustoTotal),
        acwp: ponto.acwp,
        cv: cvDe(bcwpCustoTotal, ponto.acwp),
        cpi: r3(cpiDe(bcwpCustoTotal, ponto.acwp)),
        nao_executado: bcwpCustoTotal == null ? null : r2(ponto.bcws - bcwpCustoTotal),
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
      calendario: cal.semanas.length
        ? { fonte: 'calendario_semanas', semanas: cal.semanas.length, dias: totalDias }
        : { fonte: 'extrapolado da view', semana: ancora.semana, data_fim: ancora.data_fim },
      inicio_da_obra: inicioDaObra,
      base_parcela_a: BASE_PARCELA_A,
      grupos_planejado_soma: r2(somaGruposPlan),
      hh_realizado_dos_grupos: r2(hhRealDosGrupos),
      indiretos_planejado_soma: r2(somaIndiretoPlan),
      indiretos_realizado_soma: r2(somaIndiretoReal),
      indireto_realizado_sem_categoria: r2(realizadoIndiretoSemCategoria),
      grupos_realizado_soma: r2(somaGruposReal),
      // Deve dar zero: o ACWP por parcela fecha com o ACWP total.
      acwp_parcelas_vs_total: r2(
        ponto.acwp_a + ponto.acwp_b + ponto.acwp_c + ponto.acwp_nao_classificado - ponto.acwp
      ),
      acwp_nao_classificado_por_eap: Object.fromEntries(
        Object.entries(eapsNaoClassificados).map(([k, v]) => [k, r2(v)])
      ),
      eap_em_mais_de_uma_parcela: Array.from(eapEmMaisDeUmaParcela),
      agregado_por_tempo: Array.from(AGREGADO_POR_TEMPO),
      planejado_por_tempo_corrigido: correcaoPlanejadoTempo,
      agregado_herda: paresResolvidos,
      agregado_material: Array.from(MATERIAL_AGREGADO).sort(),
      agregado_pares_nao_encontrados: paresNaoEncontrados,
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
      // A pagar do ultimo fechamento: o direto entra no IPC, o indireto no
      // saldo do indireto. Fora do custo realizado.
      contas_a_pagar: resumoContas
        ? {
            disponivel: true,
            fechamento: contas.fechamento,
            vencimentos_a_partir_de: contas.fechamento,
            direto: resumoContas.totais.ipc_direto,
            indireto: resumoContas.totais.a_pagar_indireto,
            previsto_sem_nf: resumoContas.totais.previsto_sem_nf,
            pendente: resumoContas.totais.pendente,
            total: resumoContas.totais.total,
          }
        : { disponivel: false, motivo: contas.motivo, direto: 0, indireto: 0 },
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
      memoria_agregado: memoriaAgregado,
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
