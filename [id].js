import { supabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('atualizacoes')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.setHeader('Allow', ['DELETE'])
  res.status(405).end('Método não permitido')
}
