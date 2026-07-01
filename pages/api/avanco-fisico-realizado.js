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

    // Deletar lançamentos existentes do mês
    const { error: delError } = await supabase
      .from('avanco_fisico_realizado')
      .delete()
      .eq('obra_id', obra_id)
      .eq('mes_numero', mes)
    if (delError) return res.status(500).json({ error: delError.message })

    // Inserir novos (apenas os com % > 0)
    const toInsert = lancamentos
      .filter(l => l.percentual_realizado > 0)
      .map(l => ({ ...l, obra_id }))

    if (toInsert.length > 0) {
      const { error: insError } = await supabase
        .from('avanco_fisico_realizado')
        .insert(toInsert)
      if (insError) return res.status(500).json({ error: insError.message })
    }

    return res.status(200).json({ success: true, salvos: toInsert.length })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
