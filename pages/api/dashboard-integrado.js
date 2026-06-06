import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 18

  try {
    // 1. CURVA S FINANCEIRA PLANEJADA
    const { data: finPlanejada, error: errFinPlan } = await supabase
      .from('v_curva_s_financeira_planejada')
      .select('*')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('mes_numero')
    if (errFinPlan) throw new Error(`Erro financeiro planejado: ${errFinPlan.message}`)

    // 2. CURVA S FÍSICA PLANEJADA
    const { data: fisPlanejada, error: errFisPlan } = await supabase
      .from('v_curva_s_fisica_planejada')
      .select('*')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('mes_numero')
    if (errFisPlan) throw new Error(`Erro físico planejado: ${errFisPlan.message}`)

    // 3. CUSTOS REALIZADOS
    const { data: custosRealizados, error: errCustos } = await supabase
      .from('custos_lancamentos')
      .select('competencia, valor, status, grupo_custo')
      .eq('obra_id', obra_id)
      .order('competencia')
    if (errCustos) throw new Error(`Erro custos realizados: ${errCustos.message}`)

    const dataInicio = '2025-04-01'
    const dataLimite = new Date(dataInicio)
    dataLimite.setMonth(dataLimite.getMonth() + (mesLimite - 1))
    const dataLimiteStr = dataLimite.toISOString().slice(0, 10)

    const MESES_PT = { janeiro:1,fevereiro:2,março:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 }
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
        const numeroGrupo = parseInt(c.grupo_custo?.charAt(0))
        const valor = parseFloat(c.valor)
        if (!custosAgrupados[comp]) custosAgrupados[comp] = 0
        custosAgrupados[comp] += valor
        if (numeroGrupo >= 5 && numeroGrupo <= 8) {
          if (!custosDiretosAgrupados[comp]) custosDiretosAgrupados[comp] = 0
          custosDiretosAgrupados[comp] += valor
        } else if (numeroGrupo >= 1 && numeroGrupo <= 4) {
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

    // 4. AVANÇO FÍSICO REALIZADO — peso por horas planejadas
    const { data: horasData, error: errHoras } = await supabase
      .from('cronograma_horas_planejado')
      .select('grupo_nome, horas_totais')
      .eq('obra_id', obra_id)
    if (errHoras) throw new Error(`Erro horas planejadas: ${errHoras.message}`)

    const totalHoras = horasData.reduce((sum, h) => sum + parseFloat(h.horas_totais || 0), 0)
    const pesosPorGrupo = {}
    horasData.forEach(h => {
      pesosPorGrupo[h.grupo_nome] = parseFloat(h.horas_totais || 0) / totalHoras
    })

    const { data: avancoRealData, error: errAvancoReal } = await supabase
      .from('avanco_fisico_realizado')
      .select('mes_numero, competencia, atividade_nome, percentual_realizado')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('mes_numero')
    if (errAvancoReal) throw new Error(`Erro avanço real: ${errAvancoReal.message}`)

    const avancoRealPorMes = {}
    avancoRealData.forEach(item => {
      if (!avancoRealPorMes[item.mes_numero]) {
        avancoRealPorMes[item.mes_numero] = { itens: [], competencia: item.competencia }
      }
      avancoRealPorMes[item.mes_numero].itens.push(item)
    })

    const fisRealizada = Object.entries(avancoRealPorMes).map(([mes, val]) => {
      let somaPonderada = 0
      val.itens.forEach(item => {
        const peso = pesosPorGrupo[item.atividade_nome] || 0
        somaPonderada += parseFloat(item.percentual_realizado || 0) * peso
      })
      return {
        mes_numero: parseInt(mes),
        competencia: val.competencia,
        percentual_acumulado: Math.min(somaPonderada, 1)
      }
    }).sort((a, b) => a.mes_numero - b.mes_numero)

    let maxAcumulado = 0
    fisRealizada.forEach(item => {
      maxAcumulado = Math.max(maxAcumulado, item.percentual_acumulado)
      item.percentual_acumulado = maxAcumulado
    })

    // 5. KPIs COM EVM COMPLETO
    const { data: indiretosPlano } = await supabase
      .from('custos_indiretos_planejados')
      .select('valor_total')
      .eq('obra_id', obra_id)
    const totalIndiretos = indiretosPlano
      ? indiretosPlano.reduce((sum, i) => sum + parseFloat(i.valor_total || 0), 0)
      : 0

    const { data: diretosPlano } = await supabase
      .from('cronograma_financeiro_planejado')
      .select('valor_mensal')
      .eq('obra_id', obra_id)
    const totalDiretos = diretosPlano
      ? diretosPlano.reduce((sum, i) => sum + parseFloat(i.valor_mensal || 0), 0)
      : 0

    const orcamentoTotal = totalDiretos + totalIndiretos

    // Valores base EVM
    const acwp = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_acumulado : 0
    const custoDiretoReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_direto : 0
    const custoIndiretoReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_indireto : 0

    const avancoFisicoReal = fisRealizada.length > 0 ? fisRealizada[fisRealizada.length - 1].percentual_acumulado * 100 : 0

    const finPlanMesAtual = finPlanejada.find(f => f.mes_numero === mesLimite) || finPlanejada[finPlanejada.length - 1]
    const fisPlanMesAtual = fisPlanejada.find(f => f.mes_numero === mesLimite) || fisPlanejada[fisPlanejada.length - 1]

    const bcws = finPlanMesAtual ? finPlanMesAtual.valor_acumulado : 0
    const avancoFisicoPlano = fisPlanMesAtual ? fisPlanMesAtual.percentual_acumulado * 100 : 0

    // BCWP = % físico realizado × orçamento total (valor agregado real)
    const bcwp = (avancoFisicoReal / 100) * orcamentoTotal

    // Índices EVM
    const cpi = acwp > 0 ? bcwp / acwp : 1
    const spi = bcws > 0 ? bcwp / bcws : 1

    // EAC = projeção de custo final honesta
    const eac = cpi > 0 ? orcamentoTotal / cpi : orcamentoTotal

    // Saldo real = o que vai sobrar (ou faltar) no final
    const saldoReal = orcamentoTotal - eac

    // Desvios
    const desvioFinanceiro = acwp - bcws
    const desvioFinanceiroPerc = bcws > 0 ? (desvioFinanceiro / bcws) * 100 : 0
    const desvioFisico = avancoFisicoReal - avancoFisicoPlano

    // Variâncias EVM
    const cv = bcwp - acwp   // Cost Variance: positivo = economia real
    const sv = bcwp - bcws   // Schedule Variance: positivo = adiantado

    // Projeção de prazo
    const mesAtual = Math.max(finRealizada.length, fisRealizada.length, 1)
    const velocidadeAtual = avancoFisicoReal > 0 ? avancoFisicoReal / mesAtual : 0
    const fisicoPendente = Math.max(100 - avancoFisicoReal, 0)
    const mesesRestantes = velocidadeAtual > 0 ? fisicoPendente / velocidadeAtual : 0

    const dataProjetadaConclusao = new Date(2025, 3 + mesAtual + Math.ceil(mesesRestantes), 1)
    const dataPlanejadaConclusao = new Date('2026-09-30')
    const diffDias = Math.round((dataProjetadaConclusao - dataPlanejadaConclusao) / (1000 * 60 * 60 * 24))

    const kpis = {
      orcamento_total: orcamentoTotal,
      // Custos
      custo_realizado: acwp,
      custo_direto_realizado: custoDiretoReal,
      custo_indireto_realizado: custoIndiretoReal,
      // Avanço físico
      avanco_fisico_realizado: avancoFisicoReal,
      avanco_fisico_planejado: avancoFisicoPlano,
      // EVM
      bcwp: parseFloat(bcwp.toFixed(2)),
      bcws: parseFloat(bcws.toFixed(2)),
      acwp: parseFloat(acwp.toFixed(2)),
      cpi: parseFloat(cpi.toFixed(3)),
      spi: parseFloat(spi.toFixed(3)),
      cv: parseFloat(cv.toFixed(2)),
      sv: parseFloat(sv.toFixed(2)),
      eac: parseFloat(eac.toFixed(2)),
      saldo_real: parseFloat(saldoReal.toFixed(2)),
      // Desvios
      desvio_financeiro: desvioFinanceiro,
      desvio_financeiro_perc: parseFloat(desvioFinanceiroPerc.toFixed(2)),
      desvio_fisico: parseFloat(desvioFisico.toFixed(2)),
      // Prazo
      projecao_custo_final: eac,
      saldo_orcamento: orcamentoTotal - acwp,
      mes_atual: mesAtual,
      projecao_data_conclusao: dataProjetadaConclusao.toISOString().slice(0, 10),
      desvio_prazo_dias: diffDias,
      meses_restantes: parseFloat(mesesRestantes.toFixed(1)),
      velocidade_atual: parseFloat(velocidadeAtual.toFixed(2))
    }

    // 6. PREPARAR DADOS PARA O GRÁFICO
    const fisRealPorAnoMes = {}
    fisRealizada.forEach(f => {
      const anoMes = f.competencia ? f.competencia.slice(0, 7) : null
      if (anoMes) fisRealPorAnoMes[anoMes] = f.percentual_acumulado * 100
    })

    const ultimaAnoMesFisReal = fisRealizada.length > 0
      ? fisRealizada[fisRealizada.length - 1].competencia?.slice(0, 7)
      : null
    const ultimoMesFinReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].mes_numero : 0

    const meses = []
    let ultimoFisRealConhecido = null
    for (let i = 1; i <= mesLimite; i++) {
      const finPlan = finPlanejada.find(f => f.mes_numero === i)
      const fisPlan = fisPlanejada.find(f => f.mes_numero === i)
      const finReal = finRealizada.find(f => f.mes_numero === i)
      const anoMesDoMes = finPlan?.competencia ? finPlan.competencia.slice(0, 7) : null
      const fisRealValor = anoMesDoMes != null ? (fisRealPorAnoMes[anoMesDoMes] ?? null) : null
      const fisRealFinal = (ultimaAnoMesFisReal && anoMesDoMes && anoMesDoMes <= ultimaAnoMesFisReal)
        ? (fisRealValor !== null ? fisRealValor : ultimoFisRealConhecido)
        : null
      meses.push({
        mes_numero: i,
        competencia: finPlan ? finPlan.competencia : null,
        financeiro_planejado: finPlan ? finPlan.valor_acumulado : null,
        financeiro_realizado: i <= ultimoMesFinReal && finReal ? finReal.valor_acumulado : null,
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
      metadata: { obra_id, total_meses_planejado: 18, total_meses_com_dados: mesAtual, mes_limite: mesLimite }
    })

  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error)
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}