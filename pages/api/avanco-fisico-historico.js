// pages/api/avanco-fisico-historico.js
// Lê e exclui os incrementos do histórico de avanço físico (memória de cálculo)
import { supabase } from '../../lib/supabase'

const DATA_INICIO = new Date('2026-07-01T00:00:00Z')
function calcSemana(dataLanc) {
  const d = dataLanc ? new Date(dataLanc) : new Date()
  const diffDias = Math.floor((d - DATA_INICIO) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.floor(diffDias / 7) + 1)
}

export default async function handler(req, res) {
  const obra_id = req.query.obra_id || 'flats_pampulha'

  // GET: lista os lançamentos (incrementos) de um item específico
  // Uso: /api/avanco-fisico-historico?codigo_eap=3.1.1&pavimento=1º
  if (req.method === 'GET') {
    const { codigo_eap, pavimento } = req.query
    if (!codigo_eap) return res.status(400).json({ error: 'codigo_eap obrigatorio' })

    let query = supabase
      .from('avanco_fisico_historico')
      .select('id, codigo_eap, pavimento, percentual_realizado, semana_numero, mes_numero, data_lancamento')
      .eq('obra_id', obra_id)
      .eq('codigo_eap', codigo_eap)
      .order('data_lancamento', { ascending: true })

    if (pavimento) query = query.eq('pavimento', pavimento)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // soma dos incrementos (travada em 100)
    const soma = (data || []).reduce((s, r) => s + (parseFloat(r.percentual_realizado) || 0), 0)
    const acumulado = Math.min(100, soma)

    return res.status(200).json({
      data: data || [],
      soma,
      acumulado,
      count: (data || []).length
    })
  }

  // PUT: altera a data de um lançamento específico
  // Uso: /api/avanco-fisico-historico?id=uuid-do-lancamento
  if (req.method === 'PUT') {
    const { id } = req.query
    const { data_lancamento } = req.body || {}

    if (!id) return res.status(400).json({ error: 'id obrigatorio' })
    if (!data_lancamento) return res.status(400).json({ error: 'data_lancamento obrigatoria' })

    const data = new Date(data_lancamento)
    if (Number.isNaN(data.getTime())) return res.status(400).json({ error: 'data_lancamento inválida' })

    const semana = calcSemana(data)

    const { error } = await supabase
      .from('avanco_fisico_historico')
      .update({ data_lancamento, semana_numero: semana })
      .eq('id', id)
      .eq('obra_id', obra_id)

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ success: true, data_lancamento, semana_numero: semana })
  }

  // DELETE: exclui um lançamento específico pelo id (a lixeirinha)
  // Uso: /api/avanco-fisico-historico?id=uuid-do-lancamento
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id obrigatorio' })

    // pega o registro antes de apagar (para saber qual item recalcular)
    const { data: reg, error: e1 } = await supabase
      .from('avanco_fisico_historico')
      .select('codigo_eap, pavimento, mes_numero')
      .eq('id', id)
      .eq('obra_id', obra_id)
      .single()
    if (e1) return res.status(500).json({ error: e1.message })

    const { error: e2 } = await supabase
      .from('avanco_fisico_historico')
      .delete()
      .eq('id', id)
      .eq('obra_id', obra_id)
    if (e2) return res.status(500).json({ error: e2.message })

    // recalcula o acumulado do item a partir do que sobrou
    const { data: restantes, error: e3 } = await supabase
      .from('avanco_fisico_historico')
      .select('percentual_realizado, hh_planejado')
      .eq('obra_id', obra_id)
      .eq('codigo_eap', reg.codigo_eap)
      .eq('pavimento', reg.pavimento)
    if (e3) return res.status(500).json({ error: e3.message })

    const soma = (restantes || []).reduce((s, r) => s + (parseFloat(r.percentual_realizado) || 0), 0)
    const acumulado = Math.min(100, soma)
    const hh_plan = restantes && restantes[0] ? parseFloat(restantes[0].hh_planejado) || 0 : 0
    const hh_real = hh_plan * (acumulado / 100)

    // atualiza a "foto atual" na tabela principal (espelho do acumulado)
    if (restantes && restantes.length > 0) {
      await supabase.from('avanco_fisico_realizado')
        .update({ percentual_realizado: acumulado, hh_realizado: hh_real })
        .eq('obra_id', obra_id)
        .eq('codigo_eap', reg.codigo_eap)
        .eq('pavimento', reg.pavimento)
        .eq('mes_numero', reg.mes_numero)
    } else {
      // se nao sobrou nenhum incremento, remove a foto atual do mes
      await supabase.from('avanco_fisico_realizado')
        .delete()
        .eq('obra_id', obra_id)
        .eq('codigo_eap', reg.codigo_eap)
        .eq('pavimento', reg.pavimento)
        .eq('mes_numero', reg.mes_numero)
    }

    return res.status(200).json({ success: true, acumulado, restantes: (restantes || []).length })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
