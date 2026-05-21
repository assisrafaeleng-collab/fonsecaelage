import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = 'flats_pampulha'

  try {
    const { data: lancamentos, error: errLancamentos } = await supabase
      .from('custos_lancamentos')
      .select('*')
      .eq('obra_id', obra_id)
      .in('grupo_custo', ['5. Locações', '6. Canteiro de Obras', '7. Mão de Obra', '8. Ferramentas'])
      .eq('status', 'Normal')
      .order('data_emissao', { ascending: false })

    if (errLancamentos) {
      throw new Error(`Erro ao buscar lançamentos: ${errLancamentos.message}`)
    }

    const total = lancamentos.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0)

    return res.status(200).json({
      lancamentos,
      total,
      quantidade: lancamentos.length,
      obra_id
    })

  } catch (error) {
    console.error('Erro na API:', error)
    return res.status(500).json({
      error: 'Erro ao buscar dados',
      message: error.message
    })
  }
}