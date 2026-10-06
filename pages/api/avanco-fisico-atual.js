// pages/api/avanco-fisico-atual.js
// Foto do avanco fisico realizado no fim do mes: ultimo % de cada item,
// lido de avanco_fisico_historico (mesma regra da pagina semanal).
import { supabase } from '../../lib/supabase'
import { carregarRetratos, fotoAteMes } from '../../lib/avanco-historico'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = req.query.obra_id || 'flats_pampulha'
  const mes = parseInt(req.query.mes, 10) || 20

  try {
    const retratos = await carregarRetratos(supabase, obra_id)
    return res.status(200).json({ data: fotoAteMes(retratos, mes) })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
