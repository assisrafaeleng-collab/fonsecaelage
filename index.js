import { supabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('atualizacoes')
      .select('*')
      .order('data', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const body = req.body
    const { data, error } = await supabase
      .from('atualizacoes')
      .insert([{
        data:        body.data,
        semana:      body.semana || null,
        avanco_real: body.avanco_real,
        avanco_plan: body.avanco_plan,
        desvio_dias: body.desvio_dias || 0,
        custo_real:  body.custo_real,
        orcamento:   body.orcamento || 15000,
        projecao:    body.projecao,
        notas:       body.notas || '',
        disciplinas: body.disciplinas || [],
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end('Método não permitido')
}
