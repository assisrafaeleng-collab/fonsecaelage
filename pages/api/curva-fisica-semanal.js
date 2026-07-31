// pages/api/curva-fisica-semanal.js
// Retorna a curva fisica SEMANAL: planejado (tabela) + realizado (historico somado por semana)
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = req.query.obra_id || 'flats_pampulha'

  try {
    const [planRes, histRes, horasRes] = await Promise.all([
      supabase.from('cronograma_fisico_semanal')
        .select('semana_numero, hh_semana, percentual_acumulado')
        .eq('obra_id', obra_id).order('semana_numero'),
      supabase.from('avanco_fisico_historico')
        .select('semana_numero, hh_realizado')
        .eq('obra_id', obra_id),
      supabase.from('cronograma_horas_planejado')
        .select('horas_totais').eq('obra_id', obra_id),
    ])

    if (planRes.error) throw new Error(planRes.error.message)
    if (histRes.error) throw new Error(histRes.error.message)

    const planejado = planRes.data || []
    const historico = histRes.data || []

    // Hh total planejado (denominador do realizado)
    const totalHh = (horasRes.data || []).reduce((s, h) => s + parseFloat(h.horas_totais || 0), 0) || 30246.84

    // Soma o hh_realizado por semana
    const realPorSemana = {}
    historico.forEach(h => {
      const sem = parseInt(h.semana_numero) || 1
      realPorSemana[sem] = (realPorSemana[sem] || 0) + (parseFloat(h.hh_realizado) || 0)
    })

    // Ultima semana com lancamento realizado (para nao desenhar linha reta ate a 80)
    const semanasComReal = Object.keys(realPorSemana).map(Number)
    const ultimaSemanaReal = semanasComReal.length ? Math.max(...semanasComReal) : 0

    // Monta as 80 semanas com plan e real acumulados
    let acumRealHh = 0
    const semanas = []
    for (let s = 1; s <= 80; s++) {
      const p = planejado.find(x => x.semana_numero === s)
      acumRealHh += realPorSemana[s] || 0
      const realPct = totalHh > 0 ? Math.min(100, (acumRealHh / totalHh) * 100) : 0
      semanas.push({
        semana: s,
        mes: Math.floor((s - 1) / 4) + 1,
        planejado: p ? parseFloat(p.percentual_acumulado) : null,
        // realizado so ate a ultima semana com lancamento (depois fica null)
        realizado: s <= ultimaSemanaReal ? parseFloat(realPct.toFixed(2)) : null,
      })
    }

    return res.status(200).json({
      semanas,
      total_hh_planejado: parseFloat(totalHh.toFixed(2)),
      ultima_semana_realizada: ultimaSemanaReal,
      obra_id
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
