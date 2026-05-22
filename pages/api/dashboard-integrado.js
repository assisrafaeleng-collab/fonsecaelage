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

    // ========================================================================
    // SEPARAR DIRETOS (5,6,7,8) E INDIRETOS (1,2,3,4)
    // ========================================================================
    const custosAgrupados = {}
    const custosDiretosAgrupados = {}
    const custosIndiretosAgrupados = {}

    custosRealizados
      .filter(c => c.status === 'Normal' && c.competencia <= dataLimiteStr)
      .forEach(c => {
        const comp = c.competencia
        const numeroGrupo = parseInt(c.grupo_custo?.charAt(0))
        const valor = parseFloat(c.valor)

        // Total geral
        if (!custosAgrupados[comp]) {
          custosAgrupados[comp] = 0
        }
        custosAgrupados[comp] += valor

        // Separar diretos (5,6,7,8) e indiretos (1,2,3,4)
        if (numeroGrupo >= 5 && numeroGrupo <= 8) {
          if (!custosDiretosAgrupados[comp]) {
            custosDiretosAgrupados[comp] = 0
          }
          custosDiretosAgrupados[comp] += valor
        } else if (numeroGrupo >= 1 && numeroGrupo <= 4) {
          if (!custosIndiretosAgrupados[comp]) {
            custosIndiretosAgrupados[comp] = 0
          }
          custosIndiretosAgrupados[comp] += valor
        }
      })

    // Converter para arrays com acumulado
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
    // Buscar peso financeiro de cada atividade
    const { data: pesosData, error: errPesos } = await supabase
      .from('cronograma_fisico_planejado')
      .select('atividade_nome, valor_orcado')
      .eq('obra_id', obra_id)

    if (errPesos) throw new Error(`Erro pesos: ${errPesos.message}`)

    // Pegar valor_orcado único por atividade
    const pesosPorAtividade = {}
    pesosData.forEach(item => {
      pesosPorAtividade[item.atividade_nome] = parseFloat(item.valor_orcado || 0)
    })
    const totalOrcado = Object.values(pesosPorAtividade).reduce((sum, v) => sum + v, 0)

    // Buscar lançamentos reais
    const { data: avancoRealData, error: errAvancoReal } = await supabase
      .from('avanco_fisico_realizado')
      .select('mes_numero, competencia, atividade_nome, percentual_realizado')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('mes_numero')

    if (errAvancoReal) throw new Error(`Erro avanço real: ${errAvancoReal.message}`)

    // Agrupar por mês e calcular média ponderada
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

    // Garantir que avanço seja sempre acumulado (nunca diminui)
    let maxAcumulado = 0
    fisRealizada.forEach(item => {
      maxAcumulado = Math.max(maxAcumulado, item.percentual_acumulado)
      item.percentual_acumulado = maxAcumulado
    })

    // ========================================================================
    // 5. CALCULAR KPIs COM SEPARAÇÃO DIRETO/INDIRETO
    // ========================================================================
    // Buscar total indiretos planejados
    const { data: indiretosPlano, error: errIndPlano } = await supabase
      .from('custos_indiretos_planejados')
      .select('valor_total')
      .eq('obra_id', obra_id)
    
    const totalIndiretos = indiretosPlano
      ? indiretosPlano.reduce((sum, i) => sum + parseFloat(i.valor_total || 0), 0)
      : 0

    // Buscar total diretos direto da tabela (mais preciso que a view)
    const { data: diretosPlano } = await supabase
      .from('cronograma_financeiro_planejado')
      .select('valor_mensal')
      .eq('obra_id', obra_id)
    
    const totalDiretos = diretosPlano
      ? diretosPlano.reduce((sum, i) => sum + parseFloat(i.valor_mensal || 0), 0)
      : 0

    const orcamentoTotal = totalDiretos + totalIndiretos

    const custoRealTotal = finRealizada.length > 0
      ? finRealizada[finRealizada.length - 1].valor_acumulado
      : 0

    const custoDiretoReal = finRealizada.length > 0
      ? finRealizada[finRealizada.length - 1].valor_direto
      : 0

    const custoIndiretoReal = finRealizada.length > 0
      ? finRealizada[finRealizada.length - 1].valor_indireto
      : 0

    const avisoFisicoTotal = fisRealizada.length > 0
      ? fisRealizada[fisRealizada.length - 1].percentual_acumulado * 100
      : 0

    const mesAtual = Math.max(
      finRealizada.length,
      fisRealizada.length,
      1
    )

    const finPlanMesAtual = finPlanejada.find(f => f.mes_numero === mesLimite) || finPlanejada[finPlanejada.length - 1]
    const fisPlanMesAtual = fisPlanejada.find(f => f.mes_numero === mesLimite) || fisPlanejada[fisPlanejada.length - 1]

    const valorPlanejado = finPlanMesAtual ? finPlanMesAtual.valor_acumulado : 0
    const percPlanejado = fisPlanMesAtual ? fisPlanMesAtual.percentual_acumulado * 100 : 0

    const cpi = custoRealTotal > 0 ? valorPlanejado / custoRealTotal : 0
    const spi = percPlanejado > 0 ? avisoFisicoTotal / percPlanejado : 0

    const desvioFinanceiro = custoRealTotal - valorPlanejado
    const desvioFisico = avisoFisicoTotal - percPlanejado
    const desvioFinanceiroPerc = valorPlanejado > 0 
      ? (desvioFinanceiro / valorPlanejado) * 100 
      : 0

    const projecaoCustoFinal = avisoFisicoTotal > 0
      ? (custoRealTotal / avisoFisicoTotal) * 100
      : custoRealTotal

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
      mes_atual: mesAtual
    }

    // ========================================================================
    // 6. PREPARAR DADOS PARA O GRÁFICO
    // ========================================================================
    const meses = []
    for (let i = 1; i <= mesLimite; i++) {
      const finPlan = finPlanejada.find(f => f.mes_numero === i)
      const fisPlan = fisPlanejada.find(f => f.mes_numero === i)
      const finReal = finRealizada.find(f => f.mes_numero === i)
      const fisReal = fisRealizada.find(f => f.mes_numero === i)

      meses.push({
        mes_numero: i,
        competencia: finPlan ? finPlan.competencia : null,
        financeiro_planejado: finPlan ? finPlan.valor_acumulado : null,
        financeiro_realizado: finReal ? finReal.valor_acumulado : null,
        fisico_planejado: fisPlan ? fisPlan.percentual_acumulado * 100 : null,
        fisico_realizado: fisReal ? fisReal.percentual_acumulado * 100 : i <= fisRealizada.length ? fisRealizada[fisRealizada.length - 1].percentual_acumulado * 100 : null
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