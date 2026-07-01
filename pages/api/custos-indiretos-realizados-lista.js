// pages/api/custos-indiretos-realizados-lista.js
import { supabase } from '../../lib/supabase'
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = 'flats_pampulha'
  try {
    const [lancRes, planRes] = await Promise.all([
      supabase.from('custos_lancamentos').select('*').eq('obra_id', obra_id).like('codigo_eap', '18.%').eq('status', 'Normal').order('data_emissao', { ascending: false }),
      supabase.from('custos_indiretos_planejados').select('categoria, valor_total, mes_desembolso').eq('obra_id', obra_id)
    ])
    if (lancRes.error) throw new Error(lancRes.error.message)
    if (planRes.error) throw new Error(planRes.error.message)
    const lancamentos = lancRes.data || []
    const planejados = planRes.data || []
    const totalRealizado = lancamentos.reduce((s, l) => s + parseFloat(l.valor || 0), 0)
    const totalPlanejado = planejados.reduce((s, p) => s + parseFloat(p.valor_total || 0), 0)
    return res.status(200).json({ lancamentos, planejados, totalRealizado, totalPlanejado, quantidade: lancamentos.length })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
