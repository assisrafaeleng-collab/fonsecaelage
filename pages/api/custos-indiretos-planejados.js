// pages/api/custos-indiretos-planejados.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'

  try {
    const { data, error } = await supabase
      .from('custos_indiretos_planejados')
      .select('categoria, valor_total')
      .eq('obra_id', obra_id)
      .order('valor_total', { ascending: false })

    if (error) throw new Error(`Erro ao buscar custos indiretos: ${error.message}`)

    const categorias = data
      .filter(item => item.categoria && item.categoria.trim() !== '')
      .map(item => ({
        nome: item.categoria,
        valor: parseFloat(item.valor_total || 0),
        percentual: 0
      }))

    const total = categorias.reduce((sum, c) => sum + c.valor, 0)

    categorias.forEach(c => {
      c.percentual = total > 0 ? (c.valor / total) * 100 : 0
    })

    return res.status(200).json({
      categorias,
      total,
      obra_id
    })

  } catch (error) {
    console.error('Erro na API custos-indiretos-planejados:', error)
    return res.status(500).json({ 
      error: 'Erro ao buscar custos indiretos planejados',
      message: error.message 
    })
  }
}