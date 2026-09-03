import { supabase } from '../../lib/supabase'
import { normalizeCompetencia } from '../../lib/competencia'
import { getHHPlanejadoAcumulado, getTotalPlanejadoHH } from '../../lib/cronograma-hh'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 20  // 20 meses

  try {
    const [
      finPlanejadaRes,
      fisPlanejadaRes,
      custosRes,
      horasRes,
      avancoRealRes,
      indiretosPlanoRes,
      diretosPlanoRes,
      orcamentoPlanejadoRes
    ] = await Promise.all([
      supabase.from('v_curva_s_financeira_planejada').select('*').eq('obra_id', obra_id).order('mes_numero'),
      supabase.from('v_curva_s_fisica_planejada').select('*').eq('obra_id', obra_id).order('mes_numero'),
      supabase.from('custos_lancamentos').select('competencia, data_emissao, valor, status, grupo_custo, codigo_eap').eq('obra_id', obra_id).order('data_emissao'),
      supabase.from('cronograma_horas_planejado').select('grupo_nome, horas_totais').eq('obra_id', obra_id),
      supabase.from('avanco_fisico_realizado').select('mes_numero, competencia, atividade_nome, percentual_realizado, hh_planejado, hh_realizado, codigo_eap, pavimento').eq('obra_id', obra_id).lte('mes_numero', mesLimite).order('mes_numero'),
      supabase.from('custos_indiretos_planejados').select('valor_total').eq('obra_id', obra_id),
      supabase.from('orcamento_planejado').select('preco_total, grupo_numero, cod_eap, hh, mes_inicio, mes_fim').eq('obra_id', obra_id),
      supabase.from('orcamento_planejado').select('hh, mes_inicio, mes_fim').eq('obra_id', obra_id),
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

    const custosAgrupados = {}
    const custosDiretosAgrupados = {}
    const custosIndiretosAgrupados = {}
    // Custo realmente lançado por item da EAP (acumulado até o mês limite).
    // Usado para dar avanço físico aos itens sem Hh (ex.: locação de equipamentos, grupo 17),
    // já que para eles o valor efetivamente gasto é o melhor proxy de "quanto já foi executado".
    const custoRealizadoPorEap = {}

    custosRealizados
      .filter(c => c.status === 'Normal')
      .forEach(c => {
        const comp = normalizeCompetencia(c.competencia, c.data_emissao)
        if (!comp) return

        const compDate = `${comp}-01`
        if (compDate > dataLimiteStr) return

        const eap = c.codigo_eap || ''
        const isIndireto = eap.startsWith('19.')
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
        if (eap) {
          if (!custoRealizadoPorEap[eap]) custoRealizadoPorEap[eap] = 0
          custoRealizadoPorEap[eap] += valor
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

    const orcamentoPlanejado = orcamentoPlanejadoRes.data || []
    const totalProjectHh = getTotalPlanejadoHH() || orcamentoPlanejado.reduce((sum, item) => sum + (parseFloat(item.hh || 0) || 0), 0)

    const ultimoRealizadoPorItem = new Map()
    avancoRealData.forEach(item => {
      const key = item.codigo_eap || `${item.atividade_nome || 'atividade'}|${item.pavimento || ''}`
      const atual = ultimoRealizadoPorItem.get(key)
      const novo = {
        ...item,
        hh_realizado: parseFloat(item.hh_realizado || 0),
        hh_planejado: parseFloat(item.hh_planejado || 0),
        mes_numero: parseInt(item.mes_numero || 0)
      }
      if (!atual || novo.mes_numero > atual.mes_numero || (novo.mes_numero === atual.mes_numero && novo.hh_realizado > atual.hh_realizado)) {
        ultimoRealizadoPorItem.set(key, novo)
      }
    })

    const hhRealizadoAcumulado = Array.from(ultimoRealizadoPorItem.values())
      .reduce((sum, item) => sum + (item.hh_realizado || 0), 0)

    // Hh realizado acumulado, respeitando o mes do filtro
    const hhRealizadoAteFiltro = Array.from(ultimoRealizadoPorItem.values())
      .filter(item => (item.mes_numero || 0) <= mesLimite)
      .reduce((sum, item) => sum + (item.hh_realizado || 0), 0)

    const hhPlanejadoAcumulado = getHHPlanejadoAcumulado(mesLimite)

    const fisRealizada = Object.entries(avancoRealPorMes).map(([mes, val]) => {
      const hhReal = val.itens.reduce((s, i) => s + parseFloat(i.hh_realizado || 0), 0)
      return {
        mes_numero: parseInt(mes),
        competencia: val.competencia,
        percentual_acumulado: totalProjectHh > 0 ? Math.min(hhReal / totalProjectHh, 1) : 0
      }
    }).sort((a, b) => a.mes_numero - b.mes_numero)

    let maxAcumulado = 0
    fisRealizada.forEach(item => {
      maxAcumulado = Math.max(maxAcumulado, item.percentual_acumulado)
      item.percentual_acumulado = maxAcumulado
    })

    const itensOrcamentoDireto = diretosPlanoRes.data || []
    const totalIndiretos = (indiretosPlanoRes.data || []).reduce((sum, i) => sum + parseFloat(i.valor_total || 0), 0)
    const totalDiretos = itensOrcamentoDireto.reduce((sum, i) => sum + parseFloat(i.preco_total || 0), 0)
    const orcamentoTotal = totalDiretos + totalIndiretos

    const toPercent = (value) => {
      const n = Number(value ?? 0)
      if (!Number.isFinite(n)) return 0
      return n > 1 ? n : n * 100
    }

    const toFraction = (value) => {
      const n = Number(value ?? 0)
      if (!Number.isFinite(n)) return 0
      return n > 1 ? n / 100 : n
    }

    // Itens sem Hh: nunca aparecem na tela de avanço físico (que é 100% guiada por Hh),
    // então ficavam travados em 0% de avanço para sempre, puxando o desvio físico pra baixo.
    const itensGrupo17 = itensOrcamentoDireto.filter(i => Number(i.grupo_numero) === 17)
    const itensGrupo18 = itensOrcamentoDireto.filter(i => Number(i.grupo_numero) === 18)
    const custoGrupo17 = itensGrupo17.reduce((s, i) => s + parseFloat(i.preco_total || 0), 0)
    const custoGrupo18 = itensGrupo18.reduce((s, i) => s + parseFloat(i.preco_total || 0), 0)
    const totalDiretosHH = totalDiretos - custoGrupo17 - custoGrupo18

    const acwp = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_acumulado : 0
    const custoDiretoReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_direto : 0
    const custoIndiretoReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].valor_indireto : 0
    // Realizado tambem na base Hh, acumulado ate o mes do filtro
    const avancoFisicoRealHH = totalProjectHh > 0
      ? (hhRealizadoAteFiltro / totalProjectHh) * 100
      : 0

    const mesRefBCWS = fisRealizada.length > 0
      ? Math.min(fisRealizada[fisRealizada.length - 1].mes_numero, mesLimite)
      : mesLimite
    const finPlanMesAtual = finPlanejada.find(f => f.mes_numero === mesRefBCWS) || finPlanejada[finPlanejada.length - 1]
    const fisPlanMesAtual = fisPlanejada.find(f => f.mes_numero === mesRefBCWS) || fisPlanejada[fisPlanejada.length - 1]

    const bcws = fisPlanMesAtual ? fisPlanMesAtual.percentual_acumulado * totalDiretos : 0
    // Card de Avanço Físico Planejado: base hora-homem (mesma da Curva S)
    const avancoFisicoPlano = totalProjectHh > 0
      ? (hhPlanejadoAcumulado / totalProjectHh) * 100
      : 0

    const bcwpEquipamentos = itensGrupo17.reduce((soma, item) => {
      const realizado = custoRealizadoPorEap[item.cod_eap] || 0
      const planejado = parseFloat(item.preco_total || 0)
      return soma + Math.min(realizado, planejado)
    }, 0)

    const bcwpFuncionarioDireto = itensGrupo18.reduce((soma, item) => {
      const inicio = item.mes_inicio || 1
      const fim = item.mes_fim || mesLimite
      const duracao = Math.max(fim - inicio + 1, 1)
      const decorridos = Math.min(Math.max(mesRefBCWS - inicio + 1, 0), duracao)
      const fracaoTempo = decorridos / duracao
      return soma + fracaoTempo * parseFloat(item.preco_total || 0)
    }, 0)

    const bcwpHH = (avancoFisicoRealHH / 100) * totalDiretosHH
    const bcwp = bcwpHH + bcwpEquipamentos + bcwpFuncionarioDireto
    const avancoFisicoReal = totalDiretos > 0 ? (bcwp / totalDiretos) * 100 : 0

    // ACWP para EVM: apenas custos DIRETOS realizados (codigo_eap que nao comeca com 19.)
    const todoslancamentos = custosRes.data || []
    const acwpProducao = todoslancamentos
      .filter(l => l.status === 'Normal' && !(l.codigo_eap || '').startsWith('19.'))
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

    // EAC Total: obra completa (direto + indiretos + custo do atraso no cenario realista)
    const _spiRealista = spi > 0.05 ? (spi + 1) / 2 : 1
    const _prazoRealista = Math.min((20 / Math.min(_spiRealista, 1)) * 1.15, 60)
    const _atrasoRealista = Math.max(0, _prazoRealista - 20)
    const _recorrenteMensal = 66054 // adm + locacoes + funcionarios + contabeis + iptu
    const _custoAtrasoRealista = _atrasoRealista * _recorrenteMensal * 1.12 // + 12% taxa ADM
    const eacTotal = eac + totalIndiretos + _custoAtrasoRealista

    const kpis = {
      orcamento_total: orcamentoTotal,
      custo_direto_total: parseFloat(totalDiretos.toFixed(2)),
      custo_indireto_total: parseFloat(totalIndiretos.toFixed(2)),
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
      eac_total: parseFloat(eacTotal.toFixed(2)),
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
      if (anoMes) fisRealPorAnoMes[anoMes] = toPercent(f.percentual_acumulado)
    })

    const ultimaAnoMesFisReal = fisRealizada.length > 0
      ? fisRealizada[fisRealizada.length - 1].competencia?.slice(0, 7)
      : null
    const ultimoMesFinReal = finRealizada.length > 0 ? finRealizada[finRealizada.length - 1].mes_numero : 0

    // Indiretos recorrentes que compoem a curva financeira (funcao do tempo)
    // Adm local 23500 + Locacoes/Funcionarios ~40632 + Contabeis 1459 + IPTU 463
    const RECORRENTE_MENSAL_PLAN = 23500 + 1459 + 463 + (356776/20) + (455860/20)
    const meses = []
    for (let i = 1; i <= 20; i++) {
      const finPlan = finPlanejada.find(f => f.mes_numero === i)
      const finReal = i <= mesLimite ? finRealizada.find(f => f.mes_numero === i) : null

      const hhPlanejadoAcumMes = orcamentoPlanejado.reduce((sum, item) => {
        const hh = parseFloat(item.hh || 0) || 0
        if (hh <= 0) return sum
        const mesInicio = parseInt(item.mes_inicio || 1)
        const mesFim = parseInt(item.mes_fim || mesInicio)
        const totalMeses = Math.max(1, mesFim - mesInicio + 1)
        const mesesAtivos = Math.max(0, Math.min(i, mesFim) - mesInicio + 1)
        return sum + hh * (mesesAtivos / totalMeses)
      }, 0)

      const hhRealizadoAcumMes = Array.from(ultimoRealizadoPorItem.values()).reduce((sum, item) => {
        if ((parseInt(item.mes_numero || 0) || 0) <= i) return sum + (parseFloat(item.hh_realizado || 0) || 0)
        return sum
      }, 0)

      meses.push({
        mes_numero: i,
        competencia: finPlan ? finPlan.competencia : null,
        financeiro_planejado: finPlan ? (toFraction(toPercent(finPlan.percentual_acumulado)) * totalDiretos) : null,
        financeiro_realizado: (i <= mesLimite && i <= ultimoMesFinReal && finReal) ? (finReal.valor_direto != null ? finReal.valor_direto : finReal.valor_acumulado) : null,
        fisico_planejado: totalProjectHh > 0 ? (hhPlanejadoAcumMes / totalProjectHh) * 100 : null,
        fisico_realizado: totalProjectHh > 0 ? (hhRealizadoAcumMes / totalProjectHh) * 100 : null,
      })
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
