import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 18

  try {
    const { data, error } = await supabase
      .from('cronograma_financeiro_planejado')
      .select('macrogrupo_nome, valor_mensal')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)

    if (error) throw new Error(error.message)

    const agrupado = {}
    data.forEach((item) => {
      const nome = item.macrogrupo_nome
      agrupado[nome] = (agrupado[nome] || 0) + parseFloat(item.valor_mensal || 0)
    })

    const total = Object.values(agrupado).reduce((sum, v) => sum + v, 0)
    const grupos = Object.entries(agrupado).map(([nome, valor]) => ({
      nome,
      valor,
      percentual: total > 0 ? (valor / total) * 100 : 0
    }))

    return res.status(200).json({ grupos, total, mes_limite: mesLimite, obra_id })
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}
