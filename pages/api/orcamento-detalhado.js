// pages/api/orcamento-detalhado.js
//
// API que retorna orçamento planejado agrupado por grupo de custo
// COM FILTRO DE PERÍODO

import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 18 // Padrão: todos os 18 meses

  try {
    // ========================================================================
    // 1. BUSCAR CUSTOS INDIRETOS (sempre inclui todos)
    // ========================================================================
    const { data: indiretos, error: errInd } = await supabase
      .from('custos_indiretos_planejados')
      .select('*')
      .eq('obra_id', obra_id)

    if (errInd) throw new Error(`Erro custos indiretos: ${errInd.message}`)

    const totalIndiretos = indiretos.reduce((sum, c) => sum + parseFloat(c.valor_total), 0)

    // ========================================================================
    // 2. BUSCAR CUSTOS DIRETOS (CRONOGRAMA FINANCEIRO) - FILTRADO POR MÊS
    // ========================================================================
    const { data: diretos, error: errDir } = await supabase
      .from('cronograma_financeiro_planejado')
      .select('macrogrupo_nome, valor_mensal, mes_numero')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite) // Apenas até o mês selecionado

    if (errDir) throw new Error(`Erro custos diretos: ${errDir.message}`)

    // Agrupar por macrogrupo (filtrar nulos)
    const gruposDiretos = {}
    diretos.forEach(item => {
      const grupo = item.macrogrupo_nome

      // Ignorar se for null, undefined ou vazio
      if (!grupo || grupo.trim() === '') {
        return
      }

      if (!gruposDiretos[grupo]) {
        gruposDiretos[grupo] = 0
      }
      gruposDiretos[grupo] += parseFloat(item.valor_mensal)
    })

    // ========================================================================
    // 3. MONTAR ARRAY DE GRUPOS
    // ========================================================================
    const grupos = []

    // Adicionar custos indiretos (filtrar nulos)
    indiretos.forEach(item => {
      const descricao = item.descricao
      
      // Ignorar se for null, undefined ou vazio
      if (!descricao || descricao.trim() === '') {
        return
      }
      
      grupos.push({
        nome: descricao,
        valor: parseFloat(item.valor_total),
        tipo: 'Indireto',
        icone: getIcone(descricao)
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

    // Label do período
    const periodoLabel = mesLimite === 18 
      ? 'Orçamento completo (18 meses)'
      : `Orçamento acumulado até M${mesLimite}`

    // ========================================================================
    // 4. RETORNAR
    // ========================================================================
    return res.status(200).json({
      grupos,
      total,
      custos_diretos: totalDiretos,
      custos_indiretos: totalIndiretos,
      mes_limite: mesLimite,
      periodo_label: periodoLabel,
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
