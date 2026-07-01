import { supabase } from '../../lib/supabase'
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 20
  try {
    const { data, error } = await supabase
      .from('custos_indiretos_planejados')
      .select('categoria, valor_total, mes_desembolso')
      .eq('obra_id', obra_id)
    if (error) throw new Error(error.message)

    // Filtrar e calcular proporcional ao periodo
    const categorias = (data || []).map(item => {
      const mes = item.mes_desembolso || 0
      let valor = 0
      if (mes === 0) valor = parseFloat(item.valor_total || 0) * (mesLimite / 20)
      else if (mes <= mesLimite) valor = parseFloat(item.valor_total || 0)
      return {
        categoria: item.categoria,
        valor_total: valor,
        valor_original: parseFloat(item.valor_total || 0),
        mes_desembolso: mes,
        no_periodo: valor > 0
      }
    }).filter(c => c.valor_total > 0)

    const total = categorias.reduce((s, c) => s + c.valor_total, 0)
    const totalGeral = data.reduce((s, c) => s + parseFloat(c.valor_total || 0), 0)

    return res.status(200).json({
      categorias,
      total,
      totalGeral,
      quantidade: categorias.length,
      mes_limite: mesLimite,
      periodo_label: mesLimite === 20 ? 'Todos os 20 meses' : 'Acumulado até M' + mesLimite
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}