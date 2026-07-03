import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 20  // 20 meses

  try {
    const [finPlanejadaRes, fisPlanejadaRes, custosRes, horasRes, avancoRealRes, indiretosPlanoRes, diretosPlanoRes] = await Promise.all([
      supabase.from('v_curva_s_financeira_planejada').select('*').eq('obra_id', obra_id).order('mes_numero'),
      supabase.from('v_curva_s_fisica_planejada').select('*').eq('obra_id', obra_id).order('mes_numero'),
      supabase.from('custos_lancamentos').select('competencia, valor, status, grupo_custo, codigo_eap').eq('obra_id', obra_id).order('competencia'),
      supabase.from('cronograma_horas_planejado').select('grupo_nome, horas_totais').eq('obra_id', obra_id),
      supabase.from('avanco_fisico_realizado').select('mes_numero, competencia, atividade_nome, percentual_realizado, hh_planejado, hh_realizado').eq('obra_id', obra_id).lte('mes_numero', mesLimite).order('mes_numero'),
      supabase.from('custos_indiretos_planejados').select('valor_total').eq('obra_id', obra_id),
      supabase.from('orcamento_planejado').select('preco_total').eq('obra_id', obra_id),
    ])

    if (finPlanejadaRes.error) throw new Error(finPlanejadaRes.error.message)
    if (fisPlanejadaRes.error) throw new Error(fisPlanejadaRes.error.message)
    if (custosRes.error) throw new Error(custosRes.error.message)
    if (horasRes.error) throw new Error(horasRes.error.message)
    if (avancoRealRes.error) throw new Error(avancoRealRes.error.message)

    const finPlanejada = finPlanejadaRes.data || []
    const fisPlanejada = fisPlanejadaRes.data || []
    const custosRealizados = custosRes.data || []
    const horasData = horasRes.data || []
    const avancoRealData = avancoRealRes.data || []

    // Obra: Jul/2026 = M1
    const dataInicio = '2026-07-01'
    const dataLimite = new Date(dataInicio)
    dataLimite.setMonth(dataLimite.getMonth() + (mesLimite - 1))
    const dataLimiteStr = dataLimite.toISOString().slice(0, 10)

    const MESES_PT = { janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 }
    function normalizaCompetencia(comp) {
      if (!comp) return null
      if (comp.match(/^\d{4}-\d{2}/)) return comp.slice(0, 7) + '-01'
      const m = comp.match(/^([a-záéíóúãõç]+)\/(\d{4})$/i)
      if (m) {
        const mes = MESES_PT[m[1].toLowerCase()]
        if (mes) return `${m[2]}-${String(mes).padStart(2,'0')}-01`
      }
      return comp
    }

    const custosAgrupados = {}
    const custosDiretosAgrupados = {}
    const custosIndiretosAgrupados = {}

    custosRealizados
      .filter(c => c.status === 'Normal' && normalizaCompetencia(c.competencia) <= dataLimiteStr)
      .forEach(c => {
        const comp = normalizaCompetencia(c.competencia)
        const eap = c.codigo_eap || ''
        const isIndireto = eap.startsWith('18.')
        const valor = parseFloat(c.valor)
        if (!custosAgrupados[comp]) custosAgrupados[comp] = 0
        custosAgrupados[comp] += valor
        if (!isIndireto) {
          if (!custosDiretosAgrupados[comp]) custosDiretosAgrupados[comp] = 0
          custosDiretosAgrupados[comp] += valor
        } else {
          if (!custosIndiretosAgrupados[comp]) custosIndiretosAgrupados[comp] = 0
          custosIndiretosAgrupados[comp] += valor
        }
      })

    const finRealizada = []
    let acumuladoFin = 0, acumuladoDireto = 0, acumuladoIndireto = 0
    Object.keys(custosAgrupados).sort().forEach((comp, idx) => {
      acumuladoFin += custosAgrupados[comp]
      acumuladoDireto += custosDiretosAgrupados[comp] || 0
      acumuladoIndireto += custosIndiretosAgrupados[comp] || 0
      finRealizada.push({
        mes_numero: idx + 1,
        competencia: comp,
        valor_mensal: custosAgrupados[comp],
        valor_acumulado: acumuladoFin,
        valor_direto: acumuladoDireto,
        valor_indireto: acumuladoIndireto
      })
    })

    const totalHoras = horasData.reduce((sum, h) => sum + parseFloat(h.horas_totais || 0), 0)
    const pesosPorGrupo = {}
    horasData.forEach(h => {
      pesosPorGrupo[h.grupo_nome] = parseFloat(h.horas_totais || 0) / totalHoras
    })

    const avancoRealPorMes = {}
    avancoRealData.forEach(item => {
      if (!avancoRealPorMes[item.mes_numero]) {
        avancoRealPorMes[item.mes_numero] = { itens: [], competencia: item.competencia }
      }
      avancoRealPorMes[item.mes_numero].itens.push(item)
    })

    const totalHhPlanejado = horasData.reduce((s,h) => s + parseFloat(h.horas_totais||0), 0) || 29155.7
    const fisRealizada = Object.entries(avancoRealPorMes).map(([mes, val]) => {
      const hhReal = val.itens.reduce((s,i) => s + parseFloat(i.hh_realizado||0), 0)
      return {
        mes_numero: parseInt(mes),
        competencia: val.competencia,
        percentual_acumulado: Math.min(hhReal / totalHhPlanejado, 1)
      }
    }).sort((a, b) => a.mes_numero - b.mes_numero)

    let maxAcumulado = 0
    fisRealizada.forEach(item => {
      maxAcumulado = Math.max(maxAcumulado, item.percentual_acumulado)
      item.percentual_acumulado = maxAcumulado
    })

    const totalIndiretos = (indiretosPlanoRes.data || []).reduce((sum, i) => sum + parseFloat(i.valor_total || 0), 0)
    const totalDiretos = (diretosPlanoRes.data || []).reduce((sum, i) => sum + parseFloat(i.preco_total || 0), 0)
    const orcamentoTotal = totalDiretos + totalIndiretos

    const acwp = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_acumulado : 0
    const custoDiretoReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_direto : 0
    const custoIndiretoReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_indireto : 0
    const avancoFisicoReal = fisRealizada.length > 0 ? fisRealizada[fisRealizada.length - 1].percentual_acumulado * 100 : 0

    const mesRefBCWS = fisRealizada.length > 0
      ? Math.min(fisRealizada[fisRealizada.length - 1].mes_numero, mesLimite)
      : mesLimite
    const finPlanMesAtual = finPlanejada.find(f => f.mes_numero === mesRefBCWS) || finPlanejada[finPlanejada.length - 1]
    const fisPlanMesAtual = fisPlanejada.find(f => f.mes_numero === mesRefBCWS) || fisPlanejada[fisPlanejada.length - 1]

    const bcws = fisPlanMesAtual ? fisPlanMesAtual.percentual_acumulado * totalDiretos : 0
    const avancoFisicoPlano = fisPlanMesAtual ? fisPlanMesAtual.percentual_acumulado * 100 : 0
    const bcwp = (avancoFisicoReal / 100) * totalDiretos

    // ACWP para EVM: apenas custos DIRETOS realizados (codigo_eap que nao comeca com 18.)
    const todoslancamentos = custosRes.data || []
    const acwpProducao = todoslancamentos
      .filter(l => l.status === 'Normal' && !(l.codigo_eap || '').startsWith('18.'))
      .reduce((s,l) => s + parseFloat(l.valor||0), 0)
    const cpi = acwpProducao > 0 ? bcwp / acwpProducao : 1
    const spi = bcws > 0 ? bcwp / bcws : 1
    const eac = cpi > 0 ? totalDiretos / cpi : totalDiretos
    const saldoReal = totalDiretos - eac
    const desvioFinanceiro = acwpProducao - bcws
    const desvioFinanceiroPerc = bcws > 0 ? (desvioFinanceiro / bcws) * 100 : 0
    const cv = bcwp - acwpProducao
    const sv = bcwp - bcws

    const mesAtual = Math.max(finRealizada.length, fisRealizada.length, 1)
    const velocidadeAtual = avancoFisicoReal > 0 ? avancoFisicoReal / mesAtual : 0
    // Prazo projetado via SPI (cenario realista: media entre planejado e projetado pelo SPI)
    const PRAZO_PLAN = 20
    const prazoProjSPI = spi > 0.05 ? Math.min(PRAZO_PLAN / spi, 60) : PRAZO_PLAN
    const prazoRealista = (PRAZO_PLAN + Math.max(prazoProjSPI, PRAZO_PLAN)) / 2
    const mesesRestantes = Math.max(prazoRealista - mesAtual, 0)
    const dataProjetadaConclusao = new Date(2026, 6 + Math.ceil(prazoRealista) - 1, 1)
    const dataPlanejadaConclusao = new Date('2028-02-28')
    const diffDias = Math.round((dataProjetadaConclusao - dataPlanejadaConclusao) / (1000 * 60 * 60 * 24))

    const kpis = {
      orcamento_total: orcamentoTotal,
      custo_realizado: acwp,
      custo_direto_realizado: custoDiretoReal,
      custo_indireto_realizado: custoIndiretoReal,
      avanco_fisico_realizado: avancoFisicoReal,
      avanco_fisico_planejado: avancoFisicoPlano,
      bcwp: parseFloat(bcwp.toFixed(2)),
      bcws: parseFloat(bcws.toFixed(2)),
      acwp: parseFloat(acwp.toFixed(2)),
      acwp_producao: parseFloat(acwpProducao.toFixed(2)),
      cpi: parseFloat(cpi.toFixed(3)),
      spi: parseFloat(spi.toFixed(3)),
      cv: parseFloat(cv.toFixed(2)),
      sv: parseFloat(sv.toFixed(2)),
      eac: parseFloat(eac.toFixed(2)),
      saldo_real: parseFloat(saldoReal.toFixed(2)),
      desvio_financeiro: desvioFinanceiro,
      desvio_financeiro_perc: parseFloat(desvioFinanceiroPerc.toFixed(2)),
      desvio_fisico: parseFloat((avancoFisicoReal - avancoFisicoPlano).toFixed(2)),
      projecao_custo_final: eac,
      saldo_orcamento: totalDiretos - acwpProducao,
      mes_atual: mesAtual,
      projecao_data_conclusao: dataProjetadaConclusao.toISOString().slice(0, 10),
      desvio_prazo_dias: diffDias,
      meses_restantes: parseFloat(mesesRestantes.toFixed(1)),
      velocidade_atual: parseFloat(velocidadeAtual.toFixed(2))
    }

    const fisRealPorAnoMes = {}
    fisRealizada.forEach(f => {
      const anoMes = f.competencia ? f.competencia.slice(0, 7) : null
      if (anoMes) fisRealPorAnoMes[anoMes] = f.percentual_acumulado * 100
    })

    const ultimaAnoMesFisReal = fisRealizada.length > 0
      ? fisRealizada[fisRealizada.length - 1].competencia?.slice(0, 7)
      : null
    const ultimoMesFinReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].mes_numero : 0

    // Indiretos recorrentes que compoem a curva financeira (funcao do tempo)
    // Adm local 23500 + Locacoes/Funcionarios ~40632 + Contabeis 1459 + IPTU 463
    const RECORRENTE_MENSAL_PLAN = 23500 + 1459 + 463 + (356776/20) + (455860/20)
    const meses = []
    let ultimoFisRealConhecido = null
    for (let i = 1; i <= 20; i++) {
      const finPlan = finPlanejada.find(f => f.mes_numero === i)
      const fisPlan = fisPlanejada.find(f => f.mes_numero === i)
      const finReal = i <= mesLimite ? finRealizada.find(f => f.mes_numero === i) : null
      const anoMesDoMes = finPlan?.competencia ? finPlan.competencia.slice(0, 7) : null
      const fisRealValor = anoMesDoMes != null ? (fisRealPorAnoMes[anoMesDoMes] ?? null) : null
      const fisRealFinal = (i <= mesLimite && ultimaAnoMesFisReal && anoMesDoMes && anoMesDoMes <= ultimaAnoMesFisReal)
        ? (fisRealValor !== null ? fisRealValor : ultimoFisRealConhecido)
        : null
      meses.push({
        mes_numero: i,
        competencia: finPlan ? finPlan.competencia : null,
        financeiro_planejado: fisPlan ? (fisPlan.percentual_acumulado * totalDiretos + RECORRENTE_MENSAL_PLAN * i) : null,
        financeiro_realizado: (i <= mesLimite && i <= ultimoMesFinReal && finReal) ? (finReal.valor_direto != null ? finReal.valor_direto + RECORRENTE_MENSAL_PLAN * i : finReal.valor_acumulado) : null,
        fisico_planejado: fisPlan ? fisPlan.percentual_acumulado * 100 : null,
        fisico_realizado: fisRealFinal,
      })
      if (fisRealFinal !== null) ultimoFisRealConhecido = fisRealFinal
    }

    return res.status(200).json({
      kpis,
      curvas: {
        financeiro_planejado: finPlanejada,
        financeiro_realizado: finRealizada,
        fisico_planejado: fisPlanejada,
        fisico_realizado: fisRealizada
      },
      meses_alinhados: meses,
      metadata: { obra_id, total_meses_planejado: 20, total_meses_com_dados: mesAtual, mes_limite: mesLimite }
    })

  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error)
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}