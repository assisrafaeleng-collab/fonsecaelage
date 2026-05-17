// pages/api/custos/index.js
//
// GET  — retorna lançamentos com filtros opcionais
//        query: obra_id, competencia, grupo_custo, fase_obra
//        + agregados: ?resumo=grupo | ?resumo=fase | ?resumo=competencias

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const {
    obra_id     = 'flats_pampulha',
    competencia,
    grupo_custo,
    fase_obra,
    resumo,       // 'grupo' | 'fase' | 'competencias' | undefined
    status,
  } = req.query

  // ── Resumo agregado por GRUPO ────────────────────────────────
  if (resumo === 'grupo') {
    const { data, error } = await supabase
      .from('v_custos_por_grupo')
      .select('*')
      .eq('obra_id', obra_id)
      .order('competencia', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // ── Resumo agregado por FASE ─────────────────────────────────
  if (resumo === 'fase') {
    const { data, error } = await supabase
      .from('v_custos_por_fase')
      .select('*')
      .eq('obra_id', obra_id)
      .order('competencia', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // ── Lista de competências disponíveis ────────────────────────
  if (resumo === 'competencias') {
    const { data, error } = await supabase
      .from('custos_lancamentos')
      .select('competencia')
      .eq('obra_id', obra_id)
      .order('competencia', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    const unique = [...new Set(data.map(r => r.competencia))]
    return res.status(200).json(unique)
  }

  // ── Lançamentos detalhados ───────────────────────────────────
  let query = supabase
    .from('custos_lancamentos')
    .select('*')
    .eq('obra_id', obra_id)
    .order('data_emissao', { ascending: true })

  if (competencia) query = query.like('competencia', `${competencia}%`)
  if (grupo_custo) query = query.eq('grupo_custo', grupo_custo)
  if (fase_obra)   query = query.eq('fase_obra', fase_obra)
  if (status)      query = query.eq('status', status)

  const { data, error } = await query

  if (error) return res.status(500).json({ error: error.message })

  // Calcula totais inline para facilitar o frontend
  const normal = data.filter(r => r.status === 'Normal')
  const meta = {
    total_lancamentos: data.length,
    total_normal:      normal.length,
    total_valor:       normal.reduce((s, r) => s + Number(r.valor), 0),
  }

  return res.status(200).json({ meta, lancamentos: data })
}
