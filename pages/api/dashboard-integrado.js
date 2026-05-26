// pages/api/dashboard-integrado.js
//
// API MESTRE que retorna TUDO para o dashboard COM FILTRO DE PERÍODO

import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 18

  try {
    // ========================================================================
    // 1. CURVA S FINANCEIRA PLANEJADA
    // ========================================================================
    const { data: finPlanejada, error: errFinPlan } = await supabase
      .from('v_curva_s_financeira_planejada')
      .select('*')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('mes_numero')

    if (errFinPlan) throw new Error(`Erro financeiro planejado: ${errFinPlan.message}`)

    // ========================================================================
    // 2. CURVA S FÍSICA PLANEJADA
    // ========================================================================
    const { data: fisPlanejada, error: errFisPlan } = await supabase
      .from('v_curva_s_fisica_planejada')
      .select('*')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('mes_numero')

    if (errFisPlan) throw new Error(`Erro físico planejado: ${errFisPlan.message}`)

    // ========================================================================
    // 3. CUSTOS REALIZADOS - SEPARANDO DIRETOS E INDIRETOS
    // ========================================================================
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

    const custosAgrupados = {}
    const custosDiretosAgrupados = {}
    const custosIndiretosAgrupados = {}

    custosRealizados
      .filter(c => c.status === 'Normal' && c.competencia <= dataLimiteStr)
      .forEach(c => {
        const comp = c.competencia
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
    let acumuladoFin = 0
    let acumuladoDireto = 0
    let acumuladoIndireto = 0

    Object.keys(custosAgrupados)
      .sort()
      .forEach((comp, idx) => {
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

    // ========================================================================
    // 4. AVANÇO FÍSICO REALIZADO (média ponderada pelo valor orçado)
    // ========================================================================
    const { data: pesosData, error: errPesos } = await supabase
      .from('cronograma_fisico_planejado')
      .select('atividade_nome, valor_orcado')
      .eq('obra_id', obra_id)

    if (errPesos) throw new Error(`Erro pesos: ${errPesos.message}`)

    const pesosPorAtividade = {}
    pesosData.forEach(item => {
      pesosPorAtividade[item.atividade_nome] = parseFloat(item.valor_orcado || 0)
    })
    const totalOrcado = Object.values(pesosPorAtividade).reduce((sum, v) => sum + v, 0)

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
        const peso = totalOrcado > 0 ? pesosPorAtividade[item.atividade_nome] / totalOrcado : 0
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

    // ========================================================================
    // 5. CALCULAR KPIs
    // ========================================================================
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

    const custoRealTotal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_acumulado : 0
    const custoDiretoReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_direto : 0
    const custoIndiretoReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_indireto : 0
    const avisoFisicoTotal = fisRealizada.length > 0 ? fisRealizada[fisRealizada.length - 1].percentual_acumulado * 100 : 0

    const mesAtual = Math.max(finRealizada.length, fisRealizada.length, 1)

    const finPlanMesAtual = finPlanejada.find(f => f.mes_numero === mesLimite) || finPlanejada[finPlanejada.length - 1]
    const fisPlanMesAtual = fisPlanejada.find(f => f.mes_numero === mesLimite) || fisPlanejada[fisPlanejada.length - 1]

    const valorPlanejado = finPlanMesAtual ? finPlanMesAtual.valor_acumulado : 0
    const percPlanejado = fisPlanMesAtual ? fisPlanMesAtual.percentual_acumulado * 100 : 0

    const cpi = custoRealTotal > 0 ? valorPlanejado / custoRealTotal : 0
    const spi = percPlanejado > 0 ? avisoFisicoTotal / percPlanejado : 0

    const desvioFinanceiro = custoRealTotal - valorPlanejado
    const desvioFisico = avisoFisicoTotal - percPlanejado
    const desvioFinanceiroPerc = valorPlanejado > 0 ? (desvioFinanceiro / valorPlanejado) * 100 : 0

    const projecaoCustoFinal = avisoFisicoTotal > 0
      ? (custoRealTotal / (avisoFisicoTotal / 100))
      : custoRealTotal

    // PROJEÇÃO DE PRAZO
    const mesesDecorridos = Math.max(fisRealizada.length, 1)
    const velocidadeAtual = avisoFisicoTotal > 0 ? avisoFisicoTotal / mesesDecorridos : 0
    const fisicoPendente = Math.max(100 - avisoFisicoTotal, 0)
    const mesesRestantes = velocidadeAtual > 0 ? fisicoPendente / velocidadeAtual : 0

    const dataInicioObra = new Date('2025-04-01')
    const dataProjetadaConclusao = new Date(2025, 3 + mesesDecorridos + Math.ceil(mesesRestantes), 1)
    const dataPlanejadaConclusao = new Date('2026-09-30')
    const diffDias = Math.round((dataProjetadaConclusao - dataPlanejadaConclusao) / (1000 * 60 * 60 * 24))

    const kpis = {
      orcamento_total: orcamentoTotal,
      custo_realizado: custoRealTotal,
      custo_direto_realizado: custoDiretoReal,
      custo_indireto_realizado: custoIndiretoReal,
      avanco_fisico_realizado: avisoFisicoTotal,
      avanco_fisico_planejado: percPlanejado,
      cpi: parseFloat(cpi.toFixed(2)),
      spi: parseFloat(spi.toFixed(2)),
      desvio_financeiro: desvioFinanceiro,
      desvio_financeiro_perc: parseFloat(desvioFinanceiroPerc.toFixed(2)),
      desvio_fisico: parseFloat(desvioFisico.toFixed(2)),
      projecao_custo_final: projecaoCustoFinal,
      saldo_orcamento: orcamentoTotal - custoRealTotal,
      mes_atual: mesAtual,
      projecao_data_conclusao: dataProjetadaConclusao.toISOString().slice(0, 10),
      desvio_prazo_dias: diffDias,
      meses_restantes: parseFloat(mesesRestantes.toFixed(1)),
      velocidade_atual: parseFloat(velocidadeAtual.toFixed(2))
    }

    // ========================================================================
    // 6. PREPARAR DADOS PARA O GRÁFICO
    // ========================================================================

    // Mapa competencia → percentual acumulado para o físico realizado
    // O físico realizado usa competencia própria (ex: 2025-08-01) que pode não
    // coincidir com o mes_numero do planejado financeiro — alinhamos pela data.
    const fisRealPorCompetencia = {}
    fisRealizada.forEach(f => {
      fisRealPorCompetencia[f.competencia] = f.percentual_acumulado * 100
    })

    // Último mês que tem custo financeiro realizado lançado
    const ultimoMesFinReal = finRealizada.length > 0
      ? finRealizada[finRealizada.length - 1].mes_numero
      : 0

    // Última competencia com físico realizado lançado
    const ultimaCompFisReal = fisRealizada.length > 0
      ? fisRealizada[fisRealizada.length - 1].competencia
      : null

    const meses = []
    for (let i = 1; i <= mesLimite; i++) {
      const finPlan = finPlanejada.find(f => f.mes_numero === i)
      const fisPlan = fisPlanejada.find(f => f.mes_numero === i)
      const finReal = finRealizada.find(f => f.mes_numero === i)

      // Usa a competencia do mês do gráfico para buscar o físico realizado pela data
      const compDoMes = finPlan ? finPlan.competencia : null
      const fisRealValor = compDoMes != null ? (fisRealPorCompetencia[compDoMes] ?? null) : null

      // Só mostra físico realizado até a última competencia lançada
      const fisRealFinal = (ultimaCompFisReal && compDoMes && compDoMes <= ultimaCompFisReal)
        ? fisRealValor
        : null

      meses.push({
        mes_numero: i,
        competencia: compDoMes,
        financeiro_planejado: finPlan ? finPlan.valor_acumulado : null,
        // Financeiro realizado: só até o último mês com lançamento real
        financeiro_realizado: i <= ultimoMesFinReal && finReal
          ? finReal.valor_acumulado
          : null,
        fisico_planejado: fisPlan ? fisPlan.percentual_acumulado * 100 : null,
        // Físico realizado: alinhado pela competencia (data), para no mês lançado
        fisico_realizado: fisRealFinal,
      })
    }

    // ========================================================================
    // 7. RETORNAR TUDO ESTRUTURADO
    // ========================================================================
    return res.status(200).json({
      kpis,
      curvas: {
        financeiro_planejado: finPlanejada,
        financeiro_realizado: finRealizada,
        fisico_planejado: fisPlanejada,
        fisico_realizado: fisRealizada
      },
      meses_alinhados: meses,
      metadata: {
        obra_id,
        total_meses_planejado: 18,
        total_meses_com_dados: mesAtual,
        mes_limite: mesLimite
      }
    })

  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error)
    return res.status(500).json({
      error: 'Erro ao buscar dados',
      message: error.message
    })
  }
}