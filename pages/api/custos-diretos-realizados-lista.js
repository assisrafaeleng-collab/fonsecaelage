import { supabase } from '../../lib/supabase'
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const obra_id = 'flats_pampulha'
  try {
    const { data: lancamentos, error } = await supabase
      .from('custos_lancamentos')
      .select('*')
      .eq('obra_id', obra_id)
      .not('codigo_eap', 'like', '18.%')
      .eq('status', 'Normal')
      .order('data_emissao', { ascending: false })
    if (error) throw new Error(error.message)
    const total = (lancamentos||[]).reduce((s, l) => s + parseFloat(l.valor||0), 0)
    return res.status(200).json({ lancamentos: lancamentos||[], total, quantidade: (lancamentos||[]).length })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}