import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = 'flats_pampulha'

  try {
    const { data, error } = await supabase
      .from('custos_indiretos_planejados')
      .select('categoria, valor_total')
      .eq('obra_id', obra_id)

    if (error) throw new Error(error.message)

    const total = data.reduce((sum, item) => sum + parseFloat(item.valor_total || 0), 0)
    const categorias = data.map((item) => ({
      nome: item.categoria,
      valor: parseFloat(item.valor_total || 0),
      percentual: total > 0 ? (parseFloat(item.valor_total || 0) / total) * 100 : 0
    }))

    return res.status(200).json({ categorias, total, obra_id })
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}
