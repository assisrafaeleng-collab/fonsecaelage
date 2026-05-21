// pages/api/avanco-fisico-planejado.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 18

  try {
    const { data, error } = await supabase
      .from('cronograma_fisico_planejado')
      .select('macrogrupo_nome, fisico_planejado, mes_numero')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('macrogrupo_nome')

    if (error) throw new Error(`Erro ao buscar cronograma físico: ${error.message}`)

    const gruposMap = {}
    data.forEach(item => {
      const grupo = item.macrogrupo_nome
      if (grupo && grupo.trim() !== '') {
        if (!gruposMap[grupo]) {
          gruposMap[grupo] = 0
        }
        const avanço = parseFloat(item.fisico_planejado || 0)
        gruposMap[grupo] = Math.max(gruposMap[grupo], avanço)
      }
    })

    const grupos = Object.entries(gruposMap)
      .map(([nome, avanço]) => ({
        nome,
        avanço: avanço * 100,
        status: avanço >= 1 ? 'Concluído' : avanço >= 0.5 ? 'Em andamento' : 'Não iniciado'
      }))
      .sort((a, b) => b.avanço - a.avanço)

    const avancoMedio = grupos.length > 0 
      ? grupos.reduce((sum, g) => sum + g.avanço, 0) / grupos.length 
      : 0

    return res.status(200).json({
      grupos,
      avancoMedio,
      mes_limite: mesLimite,
      obra_id
    })

  } catch (error) {
    console.error('Erro na API avanco-fisico-planejado:', error)
    return res.status(500).json({ 
      error: 'Erro ao buscar avanço físico planejado',
      message: error.message 
    })
  }
}