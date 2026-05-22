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
      .select('atividade_nome, percentual_mensal, mes_numero')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)

    if (error) throw new Error(error.message)

    const agrupado = {}
    data.forEach((item) => {
      const nome = item.atividade_nome
      agrupado[nome] = (agrupado[nome] || 0) + parseFloat(item.percentual_mensal || 0)
    })

    const grupos = Object.entries(agrupado).map(([nome, avanco]) => {
      const perc = avanco * 100
      return {
        nome,
        avanço: perc,
        status: perc >= 100 ? 'Concluído' : perc > 0 ? 'Em andamento' : 'Não iniciado'
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
