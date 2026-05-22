import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = 'flats_pampulha'
  const { resumo, competencia } = req.query

  try {
    // Listar competências disponíveis
    if (resumo === 'competencias') {
      const { data, error } = await supabase
        .from('custos_lancamentos')
        .select('competencia')
        .eq('obra_id', obra_id)
        .eq('status', 'Normal')
        .order('competencia')

      if (error) throw new Error(error.message)

      const unicas = [...new Set(data.map(d => d.competencia))].sort()
      return res.status(200).json(unicas)
    }

    // Resumo por grupo de custo
    if (resumo === 'grupo') {
      const query = supabase
        .from('custos_lancamentos')
        .select('competencia, grupo_custo, valor, status')
        .eq('obra_id', obra_id)

      if (competencia) query.eq('competencia', competencia)

      const { data, error } = await query
      if (error) throw new Error(error.message)

      const agrupado = {}
      data.filter(d => d.status === 'Normal').forEach(d => {
        const key = `${d.competencia}_${d.grupo_custo}`
        if (!agrupado[key]) {
          agrupado[key] = { competencia: d.competencia, grupo_custo: d.grupo_custo, total_normal: 0 }
        }
        agrupado[key].total_normal += parseFloat(d.valor || 0)
      })

      return res.status(200).json(Object.values(agrupado))
    }

    // Lançamentos detalhados por competência
    const query = supabase
      .from('custos_lancamentos')
      .select('*')
      .eq('obra_id', obra_id)
      .order('data_emissao', { ascending: false })

    if (competencia) query.eq('competencia', competencia)

    const { data, error } = await query
    if (error) throw new Error(error.message)

    const normal = data.filter(d => d.status === 'Normal')
    const total_valor = normal.reduce((sum, d) => sum + parseFloat(d.valor || 0), 0)

    return res.status(200).json({
      lancamentos: data,
      meta: {
        total_normal: normal.length,
        total_valor,
        competencia: competencia || 'todas'
      }
    })

  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}