// pages/api/avanco-fisico-realizado.js
import { supabase } from '../../lib/supabase'
export default async function handler(req, res) {
  const obra_id = req.query.obra_id || 'flats_pampulha'
  if (req.method === 'GET') {
    const mes = parseInt(req.query.mes) || 1
    const { data, error } = await supabase
      .from('avanco_fisico_realizado')
      .select('*')
      .eq('obra_id', obra_id)
      .eq('mes_numero', mes)
      .order('codigo_eap')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }
  if (req.method === 'POST') {
    const { mes, lancamentos } = req.body
    if (!mes || !lancamentos) return res.status(400).json({ error: 'mes e lancamentos obrigatorios' })

    // Buscar existentes do mês
    const { data: existentes, error: fetchErr } = await supabase
      .from('avanco_fisico_realizado')
      .select('id, codigo_eap, pavimento, percentual_realizado')
      .eq('obra_id', obra_id)
      .eq('mes_numero', mes)

    if (fetchErr) return res.status(500).json({ error: fetchErr.message })

    const existMap = {}
    ;(existentes || []).forEach(e => {
      existMap[e.codigo_eap + '|' + e.pavimento] = e
    })

    const toInsert = []
    const toUpdate = []
    const toDeleteIds = []

    lancamentos.forEach(l => {
      const key = l.codigo_eap + '|' + l.pavimento
      const exist = existMap[key]
      const pct = parseFloat(l.percentual_realizado) || 0

      if (exist) {
        if (pct > 0 && pct !== exist.percentual_realizado) {
          // Mudou: atualizar
          toUpdate.push({ id: exist.id, ...l, obra_id })
        } else if (pct === 0) {
          // Zerou: deletar
          toDeleteIds.push(exist.id)
        }
        // Se igual, não faz nada (preserva created_at)
        delete existMap[key]
      } else if (pct > 0) {
        // Novo: inserir
        toInsert.push({ ...l, obra_id })
      }
    })

    let erros = []

    // Inserir novos
    if (toInsert.length > 0) {
      const { error } = await supabase.from('avanco_fisico_realizado').insert(toInsert)
      if (error) erros.push('insert: ' + error.message)
    }

    // Atualizar existentes
    for (const item of toUpdate) {
      const { id, ...rest } = item
      const { error } = await supabase.from('avanco_fisico_realizado').update(rest).eq('id', id)
      if (error) erros.push('update ' + id + ': ' + error.message)
    }

    // Deletar zerados
    if (toDeleteIds.length > 0) {
      const { error } = await supabase.from('avanco_fisico_realizado').delete().in('id', toDeleteIds)
      if (error) erros.push('delete: ' + error.message)
    }

    if (erros.length > 0) return res.status(500).json({ error: erros.join('; ') })

    return res.status(200).json({
      success: true,
      inseridos: toInsert.length,
      atualizados: toUpdate.length,
      removidos: toDeleteIds.length
    })
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
