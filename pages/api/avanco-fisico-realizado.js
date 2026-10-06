// pages/api/avanco-fisico-realizado.js
import { supabase } from '../../lib/supabase'
import { senhaOk } from '../../lib/senha-servidor'

// A semana NAO e calculada aqui. O banco deriva semana_numero a partir de
// data_lancamento, via gatilho tg_semana_avanco (05-avanco-semanal.sql).
// Assim data e semana nunca divergem, nem quando a data e editada depois.

export default async function handler(req, res) {
  if (req.method !== 'GET' && !senhaOk(req, res)) return
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

  // POST desativado (out/26): gravava INCREMENTOS no historico, e a regra
  // atual le cada registro como o % ACUMULADO do item. O lancamento e feito
  // pela pagina semanal (/api/avanco-lancamento).
  if (req.method === 'POST') {
    return res.status(410).json({ error: 'Lançamento desativado: use o Acompanhamento semanal (/semanal).' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
