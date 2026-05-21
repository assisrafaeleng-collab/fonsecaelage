// pages/api/custos-indiretos-realizados-lista.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'

  try {
    const { data, error } = await supabase
      .from('custos_lancamentos')
      .select('*')
      .eq('obra_id', obra_id)
      .order('data_emissao', { ascending: false })

    if (error) throw new Error(`Erro ao buscar custos: ${error.message}`)

    // Filtrar INDIRETOS (grupos 1, 2, 3, 4)
    const indiretos = data.filter(item => {
      const numeroGrupo = parseInt(item.grupo_custo?.charAt(0))
      return numeroGrupo >= 1 && numeroGrupo <= 4
    })

    const total = indiretos.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0)

    return res.status(200).json({
      lancamentos: indiretos,
      total,
      quantidade: indiretos.length,
      obra_id
    })

  } catch (error) {
    console.error('Erro na API custos-indiretos-realizados-lista:', error)
    return res.status(500).json({ 
      error: 'Erro ao buscar custos indiretos realizados',
      message: error.message 
    })
  }
}