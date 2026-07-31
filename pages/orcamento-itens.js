// pages/api/orcamento-itens.js
// Substitui a leitura do public/dados.json.
// Retorna os itens do orçamento planejado no MESMO formato compacto
// que a página /custos-diretos-planejados espera: {g,n,p,i,d,q,c,h,a,b}
//
// NOVO: com ?fisico=1 exclui os itens que NAO fazem parte do avanco fisico
// (itens "Apenas Material" e o 1.1.X). Sem o parametro, retorna tudo (financeiro).

import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const soFisico = req.query.fisico === '1' || req.query.fisico === 'true'
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate')

  try {
    const { data, error } = await supabase
      .from('orcamento_planejado')
      .select('cod_eap, pavimento, grupo_numero, grupo_nome, descricao, quantidade, preco_total, hh, mes_inicio, mes_fim')
      .eq('obra_id', obra_id)

    if (error) throw new Error(error.message)

    let itens = (data || []).map(r => ({
      g: r.grupo_numero,
      n: r.grupo_nome,
      p: r.pavimento,
      i: r.cod_eap,
      d: r.descricao,
      q: parseFloat(r.quantidade) || 0,
      c: parseFloat(r.preco_total) || 0,
      h: parseFloat(r.hh) || 0,
      a: r.mes_inicio,
      b: r.mes_fim,
    }))

    // Contexto FISICO: remove itens que nao entram no avanco fisico.
    // IMPORTANTE: usar "(apenas material)" COM PARENTESES — assim pega so os
    // itens de material puro (Material Forma / Aco) e NAO os concretos que
    // por acaso tem "- Apenas Material" no texto (esses tem Hh e sao fisicos).
    if (soFisico) {
      itens = itens.filter(x => {
        const desc = (x.d || '').toLowerCase()
        if (desc.includes('(apenas material)')) return false   // Material Forma / Aco puro
        if (x.g === 1 && x.i === '1.1.6') return false          // Limpeza periodica (nao é atividade fisica)
        return true
      })
    }

    itens.sort((a, b) => {
      if (a.g !== b.g) return a.g - b.g
      return a.i.localeCompare(b.i, undefined, { numeric: true, sensitivity: 'base' })
    })

    return res.status(200).json(itens)
  } catch (err) {
    console.error('Erro em /api/orcamento-itens:', err)
    return res.status(500).json({ error: 'Erro ao buscar itens', message: err.message })
  }
}
