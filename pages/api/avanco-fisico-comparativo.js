import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 18

  try {
    // Planejado por atividade acumulado até o mês
    const { data: planejado, error: errPlan } = await supabase
      .from('cronograma_fisico_planejado')
      .select('atividade_nome, percentual_mensal, valor_orcado')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)

    if (errPlan) throw new Error(errPlan.message)

    // Realizado por atividade acumulado até o mês
    const { data: realizado, error: errReal } = await supabase
      .from('avanco_fisico_realizado')
      .select('atividade_nome, percentual_realizado')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)

    if (errReal) throw new Error(errReal.message)

    // Agrupar planejado por atividade
    const planejadoPorAtividade = {}
    planejado.forEach(item => {
      if (!planejadoPorAtividade[item.atividade_nome]) {
        planejadoPorAtividade[item.atividade_nome] = {
          soma: 0,
          valor_orcado: parseFloat(item.valor_orcado || 0)
        }
      }
      planejadoPorAtividade[item.atividade_nome].soma += parseFloat(item.percentual_mensal || 0)
    })

    // Agrupar realizado por atividade (último valor = acumulado)
    const realizadoPorAtividade = {}
    realizado.forEach(item => {
      realizadoPorAtividade[item.atividade_nome] =
        Math.max(
          realizadoPorAtividade[item.atividade_nome] || 0,
          parseFloat(item.percentual_realizado || 0)
        )
    })

    // Montar comparativo
    const atividades = Object.keys(planejadoPorAtividade).map(nome => ({
      nome,
      planejado: Math.min(planejadoPorAtividade[nome].soma * 100, 100),
      realizado: (realizadoPorAtividade[nome] || 0) * 100,
      valor_orcado: planejadoPorAtividade[nome].valor_orcado
    }))

    return res.status(200).json({ atividades, mes_limite: mesLimite, obra_id })

  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}