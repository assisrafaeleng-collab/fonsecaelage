// pages/api/orcamento-itens.js
// Substitui a leitura do public/dados.json.
// Retorna os itens do orçamento planejado no MESMO formato compacto
// que a página /custos-diretos-planejados espera: {g,n,p,i,d,q,c,h,a,b}
//
// NOVO: com ?fisico=1 exclui os itens que NAO fazem parte do avanco fisico
// (itens "Apenas Material" e o 1.1.X). Sem o parametro, retorna tudo (financeiro).

import { supabase } from '../../lib/supabase'
import { getPlanejadoHhByItem, getPlanejadoHhBySubgrupo, getCurvaItem } from '../../lib/cronograma-hh'

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

    // Soma do Hh do orcamento por grupo — base do rateio do total da matriz
    // Soma do Hh por subgrupo (grupo.pavimento) — base do rateio fino
    const hhOrcamentoPorSub = {}
    const chaveSub = (cod) => String(cod || "").split(".").slice(0, 2).join(".")
    ;(data || []).forEach(r => {
      const k = chaveSub(r.cod_eap)
      hhOrcamentoPorSub[k] = (hhOrcamentoPorSub[k] || 0) + (parseFloat(r.hh) || 0)
    })

    const hhOrcamentoPorGrupo = {}
    ;(data || []).forEach(r => {
      const g = r.grupo_numero
      hhOrcamentoPorGrupo[g] = (hhOrcamentoPorGrupo[g] || 0) + (parseFloat(r.hh) || 0)
    })

    let itens = (data || []).map(r => {
      // Subgrupo tem prioridade: da a janela real do pavimento
      const matrizSub = getPlanejadoHhBySubgrupo(r.cod_eap)
      const matrizItem = getCurvaItem(r.cod_eap, r.descricao)
      const matriz = getPlanejadoHhByItem({
        grupo_nome: r.grupo_nome,
        grupo: r.grupo_nome,
        atividade: r.descricao,
        descricao: r.descricao,
        hh: r.hh,
        mes_inicio: r.mes_inicio,
        mes_fim: r.mes_fim,
      })
      const matrizUsada = matrizSub || matriz
      const somaBase = matrizSub ? (hhOrcamentoPorSub[chaveSub(r.cod_eap)] || 0) : (hhOrcamentoPorGrupo[r.grupo_numero] || 0)
      const totalMatriz = matrizUsada.reduce((sum, value) => sum + (Number(value) || 0), 0)
      const curvaJanela = matrizItem || matrizUsada
      const mesesComValor = curvaJanela.map((value, idx) => ({ idx: idx + 1, value: Number(value) || 0 })).filter(x => x.value > 0)

      return {
        g: r.grupo_numero,
        n: r.grupo_nome,
        p: r.pavimento,
        i: r.cod_eap,
        d: r.descricao,
        q: parseFloat(r.quantidade) || 0,
        c: parseFloat(r.preco_total) || 0,
        h: (totalMatriz > 0 && somaBase > 0)
          ? (parseFloat(r.hh) || 0) * (totalMatriz / somaBase)
          : (parseFloat(r.hh) || 0),
        a: mesesComValor[0]?.idx || r.mes_inicio || 1,
        b: mesesComValor[mesesComValor.length - 1]?.idx || r.mes_fim || r.mes_inicio || 1,
      }
    })

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
