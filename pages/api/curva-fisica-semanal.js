// pages/api/curva-fisica-semanal.js
// Curva fisica SEMANAL. Sem ?mes= retorna as 80 semanas.
// Com ?mes=N retorna só as ~4 semanas daquele mes (zoom), com resumo do desvio.
import { supabase } from '../../lib/supabase'

const mesDaSemana = (s) => Math.floor((s - 1) / 4) + 1

const toPercent = (value) => {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return 0
  return n > 1 ? n : n * 100
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesFiltro = req.query.mes ? parseInt(req.query.mes) : null

  try {
    const [planRes, histRes, horasRes] = await Promise.all([
      supabase.from('cronograma_fisico_semanal')
        .select('semana_numero, hh_semana, percentual_acumulado')
        .eq('obra_id', obra_id).order('semana_numero'),
      supabase.from('avanco_fisico_historico')
        .select('semana_numero, hh_realizado').eq('obra_id', obra_id),
      supabase.from('cronograma_horas_planejado')
        .select('horas_totais').eq('obra_id', obra_id),
    ])
    if (planRes.error) throw new Error(planRes.error.message)
    if (histRes.error) throw new Error(histRes.error.message)

    const planejado = planRes.data || []
    const historico = histRes.data || []
    const totalHh = (horasRes.data || []).reduce((s, h) => s + parseFloat(h.horas_totais || 0), 0) || 30246.84

    // hh realizado por semana
    const realPorSemana = {}
    historico.forEach(h => {
      const s = parseInt(h.semana_numero) || 1
      realPorSemana[s] = (realPorSemana[s] || 0) + (parseFloat(h.hh_realizado) || 0)
    })
    const semanasComReal = Object.keys(realPorSemana).map(Number)
    const ultimaSemanaReal = semanasComReal.length ? Math.max(...semanasComReal) : 0

    // monta as 80 semanas com plan e real ACUMULADOS (base para tudo)
    let acumRealHh = 0
    const todas = []
    for (let s = 1; s <= 80; s++) {
      const p = planejado.find(x => x.semana_numero === s)
      acumRealHh += realPorSemana[s] || 0
      const realPct = totalHh > 0 ? Math.min(100, (acumRealHh / totalHh) * 100) : 0
      todas.push({
        semana: s,
        mes: mesDaSemana(s),
        semana_do_mes: ((s - 1) % 4) + 1,
        planejado: p ? toPercent(p.percentual_acumulado) : null,
        realizado: s <= ultimaSemanaReal ? parseFloat(realPct.toFixed(2)) : null,
      })
    }

    // sem filtro: devolve as 80 (visao geral)
    if (!mesFiltro) {
      return res.status(200).json({ modo: 'geral', semanas: todas, total_hh_planejado: +totalHh.toFixed(2), ultima_semana_realizada: ultimaSemanaReal, obra_id })
    }

    // com filtro: so as semanas do mes, e mostra o AVANCO DENTRO DO MES
    // (acumulado da semana - acumulado do fim do mes anterior)
    const fimMesAnterior = todas.find(t => t.semana === (mesFiltro - 1) * 4) || { planejado: 0, realizado: 0 }
    const basePlan = fimMesAnterior.planejado || 0
    const baseReal = fimMesAnterior.realizado || 0

    const doMes = todas.filter(t => t.mes === mesFiltro).map(t => ({
      semana: t.semana,
      semana_do_mes: t.semana_do_mes,
      // avanco relativo ao inicio do mes
      planejado: t.planejado != null ? +(t.planejado - basePlan).toFixed(2) : null,
      realizado: t.realizado != null ? +(t.realizado - baseReal).toFixed(2) : null,
      planejado_acum: t.planejado,
      realizado_acum: t.realizado,
    }))

    // resumo do mes (ultima semana com dado no mes)
    const comReal = doMes.filter(x => x.realizado != null)
    const ult = comReal.length ? comReal[comReal.length - 1] : null
    const ultPlan = doMes[doMes.length - 1]
    const realizadoMes = ult ? ult.realizado : 0
    const planejadoMes = ultPlan ? ultPlan.planejado : 0
    const desvioMes = +(realizadoMes - planejadoMes).toFixed(2)
    // semana critica = maior gap negativo dentro do mes
    let critica = null, piorGap = 0
    doMes.forEach(x => {
      if (x.realizado != null && x.planejado != null) {
        const gap = x.realizado - x.planejado
        if (gap < piorGap) { piorGap = gap; critica = x.semana_do_mes }
      }
    })

    return res.status(200).json({
      modo: 'mes', mes: mesFiltro, semanas: doMes,
      resumo: { realizado: realizadoMes, planejado: planejadoMes, desvio: desvioMes, semana_critica: critica },
      total_hh_planejado: +totalHh.toFixed(2), ultima_semana_realizada: ultimaSemanaReal, obra_id
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
