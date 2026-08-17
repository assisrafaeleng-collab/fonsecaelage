// pages/api/orcamento-detalhado.js
// Reescrita: lê 100% do Supabase (não usa mais public/dados.json)

import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 20

  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate')

  try {
    const { data: itens, error: errItens } = await supabase
      .from('orcamento_planejado')
      .select('preco_total, mes_inicio, mes_fim')
      .eq('obra_id', obra_id)

    if (errItens) throw new Error(errItens.message)

    let custos_diretos = 0
    ;(itens || []).forEach(r => {
      const a = r.mes_inicio || 1
      const b = r.mes_fim || 1
      const c = parseFloat(r.preco_total) || 0
      const numMeses = Math.max(b - a + 1, 1)
      const custoMensal = c / numMeses

      if (mesLimite >= 20) {
        custos_diretos += c
      } else {
        for (let m = a; m <= b; m++) {
          if (m <= mesLimite) custos_diretos += custoMensal
        }
      }
    })

    const { data: indiretos, error } = await supabase
      .from('custos_indiretos_planejados')
      .select('categoria, valor_total, mes_desembolso')
      .eq('obra_id', obra_id)
    if (error) throw new Error(error.message)

    let custos_indiretos = 0
    const categorias = (indiretos || []).map(item => {
      const mes = item.mes_desembolso || 0
      let valor = 0
      if (mes === 0) valor = parseFloat(item.valor_total || 0) * (mesLimite / 20)
      else if (mes <= mesLimite) valor = parseFloat(item.valor_total || 0)
      custos_indiretos += valor
      return {
        nome: item.categoria,
        valor,
        valor_total: parseFloat(item.valor_total || 0),
        mes_desembolso: mes
      }
    })

    const total = custos_diretos + custos_indiretos

    return res.status(200).json({
      custos_diretos,
      custos_indiretos,
      total,
      categorias,
      mes_limite: mesLimite,
      periodo_label: mesLimite === 20 ? 'Orçamento completo (20 meses)' : 'Acumulado até M' + mesLimite,
      obra_id
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
