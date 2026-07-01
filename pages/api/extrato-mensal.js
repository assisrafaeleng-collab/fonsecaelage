import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = 'flats_pampulha'
  const mes = parseInt(req.query.mes) || 1

  try {
    const { data: indiretos, error } = await supabase
      .from('custos_indiretos_planejados')
      .select('categoria, valor_total, mes_desembolso')
      .eq('obra_id', obra_id)
    if (error) throw new Error(error.message)

    // Indiretos do mes
    const indiretosDoMes = (indiretos || []).map(item => {
      const md = item.mes_desembolso || 0
      let valor = 0
      if (md === 0) valor = parseFloat(item.valor_total || 0) / 20
      else if (md === mes) valor = parseFloat(item.valor_total || 0)
      return { categoria: item.categoria, valor, mes_desembolso: md }
    }).filter(i => i.valor > 0)

    const totalIndiretos = indiretosDoMes.reduce((s, i) => s + i.valor, 0)

    return res.status(200).json({ indiretosDoMes, totalIndiretos, mes })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}