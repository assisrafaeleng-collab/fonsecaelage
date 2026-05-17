// pages/api/dashboard-integrado.js
//
// API MESTRE que retorna TUDO para o dashboard:
// - 4 curvas (Financeiro Plan/Real + Físico Plan/Real)
// - KPIs calculados (CPI, SPI, desvios)
// - Dados mensais estruturados

import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'

  try {
    // ========================================================================
    // 1. CURVA S FINANCEIRA PLANEJADA
    // ========================================================================
    const { data: finPlanejada, error: errFinPlan } = await supabase
      .from('v_curva_s_financeira_planejada')
      .select('*')
      .eq('obra_id', obra_id)
      .order('mes_numero')

    if (errFinPlan) throw new Error(`Erro financeiro planejado: ${errFinPlan.message}`)

    // ========================================================================
    // 2. CURVA S FÍSICA PLANEJADA
    // ========================================================================
    const { data: fisPlanejada, error: errFisPlan } = await supabase
      .from('v_curva_s_fisica_planejada')
      .select('*')
      .eq('obra_id', obra_id)
      .order('mes_numero')

    if (errFisPlan) throw new Error(`Erro físico planejado: ${errFisPlan.message}`)

    // ========================================================================
    // 3. CUSTOS REALIZADOS (Financeiro Real)
    // ========================================================================
    // Buscar todos os custos agrupados por competência
    const { data: custosRealizados, error: errCustos } = await supabase
      .from('custos_lancamentos')
      .select('competencia, valor, status')
      .eq('obra_id', obra_id)
      .order('competencia')

    if (errCustos) throw new Error(`Erro custos realizados: ${errCustos.message}`)

    // Agrupar por competência e calcular acumulado
    const custosAgrupados = {}
    custosRealizados
      .filter(c => c.status === 'Normal')
      .forEach(c => {
        const comp = c.competencia
        if (!custosAgrupados[comp]) {
          custosAgrupados[comp] = 0
        }
        custosAgrupados[comp] += parseFloat(c.valor)
      })

    // Converter para array ordenado com acumulado
    const finRealizada = []
    let acumuladoFin = 0
    
    Object.keys(custosAgrupados)
      .sort()
      .forEach((comp, idx) => {
        acumuladoFin += custosAgrupados[comp]
        finRealizada.push({
          mes_numero: idx + 1,
          competencia: comp,
          valor_mensal: custosAgrupados[comp],
          valor_acumulado: acumuladoFin
        })
      })

    // ========================================================================
    // 4. AVANÇO FÍSICO REALIZADO
    // ========================================================================
    const { data: atualizacoes, error: errAtual } = await supabase
      .from('atualizacoes_obra')
      .select('*')
      .eq('obra_id', obra_id)
      .order('data')

    if (errAtual) throw new Error(`Erro atualizações: ${errAtual.message}`)

    // Converter para formato de curva acumulada
    const fisRealizada = atualizacoes.map((a, idx) => ({
      mes_numero: idx + 1,
      competencia: a.data,
      percentual_mensal: parseFloat(a.avanco_real) / 100,
      percentual_acumulado: parseFloat(a.avanco_real) / 100
    }))

    // ========================================================================
    // 5. CALCULAR KPIs
    // ========================================================================
    const orcamentoTotal = finPlanejada.length > 0 
      ? finPlanejada[finPlanejada.length - 1].valor_acumulado 
      : 4920564.51

    const custoRealTotal = finRealizada.length > 0
      ? finRealizada[finRealizada.length - 1].valor_acumulado
      : 0

    const avisoFisicoTotal = fisRealizada.length > 0
      ? fisRealizada[fisRealizada.length - 1].percentual_acumulado * 100
      : 0

    // Mês atual baseado no último lançamento
    const mesAtual = Math.max(
      finRealizada.length,
      fisRealizada.length,
      1
    )

    // Buscar valores planejados no mês atual
    const finPlanMesAtual = finPlanejada.find(f => f.mes_numero === mesAtual) || finPlanejada[0]
    const fisPlanMesAtual = fisPlanejada.find(f => f.mes_numero === mesAtual) || fisPlanejada[0]

    const valorPlanejado = finPlanMesAtual ? finPlanMesAtual.valor_acumulado : 0
    const percPlanejado = fisPlanMesAtual ? fisPlanMesAtual.percentual_acumulado * 100 : 0

    // CPI = Valor Planejado / Valor Realizado (quanto maior, melhor)
    const cpi = custoRealTotal > 0 ? valorPlanejado / custoRealTotal : 0

    // SPI = % Executado / % Planejado
    const spi = percPlanejado > 0 ? avisoFisicoTotal / percPlanejado : 0

    // Desvios
    const desvioFinanceiro = custoRealTotal - valorPlanejado
    const desvioFisico = avisoFisicoTotal - percPlanejado
    const desvioFinanceiroPerc = valorPlanejado > 0 
      ? (desvioFinanceiro / valorPlanejado) * 100 
      : 0

    // Projeção de custo final (baseado no ritmo atual)
    const projecaoCustoFinal = avisoFisicoTotal > 0
      ? (custoRealTotal / avisoFisicoTotal) * 100
      : custoRealTotal

    const kpis = {
      orcamento_total: orcamentoTotal,
      custo_realizado: custoRealTotal,
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
    // Criar array de 18 meses com todos os dados alinhados
    const meses = []
    for (let i = 1; i <= 18; i++) {
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
        fisico_realizado: fisReal ? fisReal.percentual_acumulado * 100 : null
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
        ultima_atualizacao: atualizacoes.length > 0 
          ? atualizacoes[atualizacoes.length - 1].data 
          : null
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
