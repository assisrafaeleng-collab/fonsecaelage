// pages/api/avanco-fisico-resumo.js
// Retorna a soma acumulada (do historico) de TODOS os itens de uma vez.
// Usado pela tela para mostrar o acumulado de cada item sem chamar item por item.
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = req.query.obra_id || 'flats_pampulha'

  const { data, error } = await supabase
    .from('avanco_fisico_historico')
    .select('codigo_eap, pavimento, percentual_realizado')
    .eq('obra_id', obra_id)
  if (error) return res.status(500).json({ error: error.message })

  // soma por item (codigo_eap|pavimento), travando em 100
  const somas = {}
  ;(data || []).forEach(r => {
    const key = r.codigo_eap + '|' + r.pavimento
    somas[key] = (somas[key] || 0) + (parseFloat(r.percentual_realizado) || 0)
  })
  const acumulados = {}
  Object.keys(somas).forEach(k => { acumulados[k] = Math.min(100, somas[k]) })

  return res.status(200).json({ acumulados })
}
