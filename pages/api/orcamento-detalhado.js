import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 20

  try {
    const [diretosRes, indiretosRes, gruposDiretosRes, gruposIndiretosRes] = await Promise.all([
      supabase.from('cronograma_financeiro_planejado').select('valor_mensal').eq('obra_id', obra_id).lte('mes_numero', mesLimite),
      supabase.from('custos_indiretos_planejados').select('categoria, valor_total, mes_desembolso').eq('obra_id', obra_id),
      supabase.from('orcamento_planejado').select('grupo_custo, preco_total, tipo').eq('obra_id', obra_id),
      supabase.from('custos_indiretos_planejados').select('categoria, valor_total').eq('obra_id', obra_id),
    ])

    if (diretosRes.error) throw new Error(diretosRes.error.message)
    if (indiretosRes.error) throw new Error(indiretosRes.error.message)

    // Custos diretos acumulados até o mês
    const custos_diretos = (diretosRes.data || []).reduce((s, i) => s + parseFloat(i.valor_mensal || 0), 0)

    // Custos indiretos proporcionais ao período
    let custos_indiretos = 0
    const categorias = [];
    (indiretosRes.data || []).forEach(item => {
      const mes = item.mes_desembolso || 0
      let valor = 0
      if (mes === 0) valor = parseFloat(item.valor_total || 0) * (mesLimite / 20)
      else if (mes <= mesLimite) valor = parseFloat(item.valor_total || 0)
      custos_indiretos += valor
      categorias.push({ nome: item.categoria, valor, valor_total: parseFloat(item.valor_total || 0), mes_desembolso: mes })
    })

    // Grupos diretos para detalhamento
    const gruposMap = {}
    const ICONES = { 'Esquadrias': '🪟', 'Pintura': '🖌️' }
    ;(gruposDiretosRes.data || []).forEach(item => {
      if (!gruposMap[item.grupo_custo]) gruposMap[item.grupo_custo] = 0
      gruposMap[item.grupo_custo] += parseFloat(item.preco_total || 0)
    })
    const gruposDiretos = Object.entries(gruposMap)
      .map(([nome, valor]) => ({ nome, valor, tipo: 'Direto', icone: ICONES[nome] || '📦' }))
      .sort((a, b) => b.valor - a.valor)

    const gruposIndiretos = (gruposIndiretosRes.data || [])
      .map(item => ({ nome: item.categoria, valor: parseFloat(item.valor_total || 0), tipo: 'Indireto', icone: '📦' }))
      .sort((a, b) => b.valor - a.valor)

    const total = custos_diretos + custos_indiretos
    const periodoLabel = mesLimite === 20 ? 'Orçamento completo (20 meses)' : `Orçamento acumulado até M${mesLimite}`

    return res.status(200).json({
      custos_diretos,
      custos_indiretos,
      total,
      categorias,
      gruposDiretos,
      gruposIndiretos,
      mes_limite: mesLimite,
      periodo_label: periodoLabel,
      obra_id
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}