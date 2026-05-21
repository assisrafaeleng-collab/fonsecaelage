// pages/api/custos-diretos-realizados.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'

  try {
    const { data, error } = await supabase
      .from('custos_lancamentos')
      .select('grupo_custo, valor')
      .eq('obra_id', obra_id)

    if (error) throw new Error(`Erro ao buscar custos: ${error.message}`)

    // Agrupar por grupo_custo e somar valores
    const gruposMap = {}
    data.forEach(item => {
      const grupo = item.grupo_custo
      if (grupo && grupo.trim() !== '') {
        if (!gruposMap[grupo]) {
          gruposMap[grupo] = 0
        }
        gruposMap[grupo] += parseFloat(item.valor || 0)
      }
    })

    const grupos = Object.entries(gruposMap)
      .map(([nome, valor]) => ({
        nome,
        valor,
        percentual: 0
      }))
      .sort((a, b) => b.valor - a.valor)

    const total = grupos.reduce((sum, g) => sum + g.valor, 0)

    grupos.forEach(g => {
      g.percentual = total > 0 ? (g.valor / total) * 100 : 0
    })

    return res.status(200).json({
      grupos,
      total,
      obra_id
    })

  } catch (error) {
    console.error('Erro na API custos-diretos-realizados:', error)
    return res.status(500).json({ 
      error: 'Erro ao buscar custos diretos realizados',
      message: error.message 
    })
  }
}