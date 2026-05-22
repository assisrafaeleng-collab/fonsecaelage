import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 18

  try {
    const { data, error } = await supabase
      .from('cronograma_fisico_planejado')
      .select('macrogrupo_nome, fisico_planejado, mes_numero')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)

    if (error) throw new Error(error.message)

    const agrupado = {}
    data.forEach((item) => {
      const nome = item.macrogrupo_nome
      if (!agrupado[nome] || item.mes_numero > agrupado[nome].mes_numero) {
        agrupado[nome] = item
      }
    })

    const grupos = Object.entries(agrupado).map(([nome, item]) => {
      const avanco = parseFloat(item.fisico_planejado || 0)
      return {
        nome,
        avanço: avanco,
        status: avanco >= 100 ? 'Concluído' : avanco > 0 ? 'Em andamento' : 'Não iniciado'
      }
    })

    const avancoMedio = grupos.length > 0
      ? grupos.reduce((sum, g) => sum + g.avanço, 0) / grupos.length
      : 0

    return res.status(200).json({ grupos, avancoMedio, mes_limite: mesLimite, obra_id })
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}
