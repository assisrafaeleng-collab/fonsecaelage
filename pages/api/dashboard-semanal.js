import { supabase } from '../../lib/supabase'
import { calcularPainelSemanal } from '../../lib/painel-semanal'

// /api/dashboard-semanal — EVM semanal das Flats Pampulha. O calculo fica em
// lib/painel-semanal.js (o mesmo que o dashboard mensal usa).
//   ?semana=N   semana selecionada (sem ela, a corrente)
//   ?memoria=1  inclui a memoria de calculo do valor agregado
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const dados = await calcularPainelSemanal(supabase, {
      obra_id: req.query.obra_id || 'flats_pampulha',
      semana: req.query.semana ? parseInt(req.query.semana, 10) : null,
      memoria: !!req.query.memoria,
    })
    return res.status(200).json(dados)
  } catch (error) {
    console.error('Erro no dashboard semanal:', error)
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}
