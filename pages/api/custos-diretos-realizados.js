// pages/api/custos-diretos-realizados.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 18

  try {
    const { data, error } = await supabase
      .from('atualizacoes_obra')
      .select('atividade_nome, valor_orcado, mes_numero')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('atividade_nome')

    if (error) throw new Error(`Erro ao buscar atualizações: ${error.message}`)

    const atividadesMap = {}
    data.forEach(item => {
      const atividade = item.atividade_nome
      if (atividade && atividade.trim() !== '') {
        if (!atividadesMap[atividade]) {
          atividadesMap[atividade] = 0
        }
        atividadesMap[atividade] += parseFloat(item.valor_orcado || 0)
      }
    })

    const atividades = Object.entries(atividadesMap)
      .map(([nome, valor]) => ({
        nome,
        valor,
        percentual: 0
      }))
      .sort((a, b) => b.valor - a.valor)

    const totalRealizados = atividades.reduce((sum, a) => sum + a.valor, 0)

    atividades.forEach(a => {
      a.percentual = totalRealizados > 0 ? (a.valor / totalRealizados) * 100 : 0
    })

    return res.status(200).json({
      atividades,
      total: totalRealizados,
      mes_limite: mesLimite,
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