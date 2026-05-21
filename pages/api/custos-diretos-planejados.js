// pages/api/custos-diretos-planejados.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 18

  try {
    const { data, error } = await supabase
      .from('cronograma_financeiro_planejado')
      .select('macrogrupo_nome, valor_mensal, mes_numero')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('macrogrupo_nome')

    if (error) throw new Error(`Erro ao buscar cronograma: ${error.message}`)

    const gruposMap = {}
    data.forEach(item => {
      const grupo = item.macrogrupo_nome
      if (grupo && grupo.trim() !== '') {
        if (!gruposMap[grupo]) {
          gruposMap[grupo] = 0
        }
        gruposMap[grupo] += parseFloat(item.valor_mensal || 0)
      }
    })

    const grupos = Object.entries(gruposMap)
      .map(([nome, valor]) => ({
        nome,
        valor,
        percentual: 0
      }))
      .sort((a, b) => b.valor - a.valor)

    const totalDiretos = grupos.reduce((sum, g) => sum + g.valor, 0)

    grupos.forEach(g => {
      g.percentual = totalDiretos > 0 ? (g.valor / totalDiretos) * 100 : 0
    })

    return res.status(200).json({
      grupos,
      total: totalDiretos,
      mes_limite: mesLimite,
      obra_id
    })

  } catch (error) {
    console.error('Erro na API custos-diretos-planejados:', error)
    return res.status(500).json({ 
      error: 'Erro ao buscar custos diretos planejados',
      message: error.message 
    })
  }
}