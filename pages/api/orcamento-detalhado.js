// pages/api/orcamento-detalhado.js
//
// API que retorna orçamento planejado agrupado por grupo de custo

import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'

  try {
    // ========================================================================
    // 1. BUSCAR CUSTOS INDIRETOS
    // ========================================================================
    const { data: indiretos, error: errInd } = await supabase
      .from('custos_indiretos_planejados')
      .select('*')
      .eq('obra_id', obra_id)

    if (errInd) throw new Error(`Erro custos indiretos: ${errInd.message}`)

    const totalIndiretos = indiretos.reduce((sum, c) => sum + parseFloat(c.valor_total), 0)

    // ========================================================================
    // 2. BUSCAR CUSTOS DIRETOS (CRONOGRAMA FINANCEIRO)
    // ========================================================================
    const { data: diretos, error: errDir } = await supabase
      .from('cronograma_financeiro_planejado')
      .select('grupo_custo, valor_mensal')
      .eq('obra_id', obra_id)

    if (errDir) throw new Error(`Erro custos diretos: ${errDir.message}`)

    // Agrupar por macrogrupo
    const gruposDiretos = {}
    diretos.forEach(item => {
      const grupo = item.grupo_custo
      if (!gruposDiretos[grupo]) {
        gruposDiretos[grupo] = 0
      }
      gruposDiretos[grupo] += parseFloat(item.valor_mensal)
    })

    // ========================================================================
    // 3. MONTAR ARRAY DE GRUPOS
    // ========================================================================
    const grupos = []

    // Adicionar custos indiretos
    indiretos.forEach(item => {
      grupos.push({
        nome: item.descricao,
        valor: parseFloat(item.valor_total),
        tipo: 'Indireto',
        icone: getIcone(item.descricao)
      })
    })

    // Adicionar custos diretos
    Object.entries(gruposDiretos).forEach(([nome, valor]) => {
      grupos.push({
        nome,
        valor,
        tipo: 'Direto',
        icone: getIcone(nome)
      })
    })

    // Ordenar por valor (maior primeiro)
    grupos.sort((a, b) => b.valor - a.valor)

    const totalDiretos = Object.values(gruposDiretos).reduce((sum, v) => sum + v, 0)
    const total = totalDiretos + totalIndiretos

    // ========================================================================
    // 4. RETORNAR
    // ========================================================================
    return res.status(200).json({
      grupos,
      total,
      custos_diretos: totalDiretos,
      custos_indiretos: totalIndiretos,
      obra_id
    })

  } catch (error) {
    console.error('Erro ao buscar orçamento:', error)
    return res.status(500).json({ 
      error: 'Erro ao buscar orçamento',
      message: error.message 
    })
  }
}

// Função auxiliar para ícones
function getIcone(nome) {
  const icones = {
    'Terreno': '🏗️',
    'Projetos e Consultorias': '📐',
    'Aprovações e Licenças': '📋',
    'Jurídico': '⚖️',
    'Taxas e Emolumentos': '💳',
    'Contingências': '🛡️',
    'Infraestrutura': '🔧',
    'Superestrutura': '🏗️',
    'Alvenaria e Vedações': '🧱',
    'Revestimentos': '🎨',
    'Esquadrias': '🪟',
    'Cobertura': '🏠',
    'Instalações Hidrossanitárias': '💧',
    'Instalações Elétricas': '⚡',
    'Instalações Especiais': '🔌',
    'Elevadores': '🛗',
    'Acabamentos': '✨',
    'Pintura': '🖌️',
    'Áreas Comuns': '🏛️',
    'Paisagismo': '🌳',
    'Limpeza e Entrega': '🧹'
  }
  
  return icones[nome] || '📦'
}
