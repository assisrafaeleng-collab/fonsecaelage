// pages/api/avanco-fisico-historico.js
// Lê e exclui os incrementos do histórico de avanço físico (memória de cálculo)
import { supabase } from '../../lib/supabase'
import { senhaOk } from '../../lib/senha-servidor'
import { carregarCalendario, semanaDoCalendario } from '../../lib/calendario'
import { carregarMedicoes, ultimaMedicaoPorLinha } from '../../lib/medicao-linha'

export default async function handler(req, res) {
  if (req.method !== 'GET' && !senhaOk(req, res)) return
  const obra_id = req.query.obra_id || 'flats_pampulha'

  // GET: lista as medições de um item, na ordem em que valem, e o acumulado = a ÚLTIMA medição da linha até a
  // data (percentual_realizado é ACUMULADO, não incremento; mesma regra do painel semanal, lib/medicao-linha.js).
  // Antes esta rota somava as medições (decisão de 16/10/2026).
  // Uso: /api/avanco-fisico-historico?codigo_eap=3.1.1&pavimento=1º[&ate=AAAA-MM-DD]
  if (req.method === 'GET') {
    const { codigo_eap, pavimento } = req.query
    if (!codigo_eap) return res.status(400).json({ error: 'codigo_eap obrigatorio' })
    const ate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.ate || '') ? req.query.ate : null

    const { data, error } = await carregarMedicoes(supabase, obra_id, {
      campos: 'id, codigo_eap, pavimento, percentual_realizado, semana_numero, mes_numero, data_lancamento',
      comSemana: false,
      filtro: (q) => (pavimento ? q.eq('codigo_eap', codigo_eap).eq('pavimento', pavimento) : q.eq('codigo_eap', codigo_eap)),
    })
    if (error) return res.status(500).json({ error: error.message })

    // Código repetido por pavimento sem ?pavimento=: uma linha por pavimento (sem somar nem misturar)
    const porLinha = ultimaMedicaoPorLinha(data, (eap, pav) => `${eap}|${pav || ''}`, ate)
    const ultimas = Object.values(porLinha)
    const acumulado = ultimas.length === 1 ? parseFloat(ultimas[0].percentual_realizado) || 0 : null

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      data: data || [],
      ate,
      acumulado,
      por_pavimento: Object.fromEntries(ultimas.map((r) => [r.pavimento || '', parseFloat(r.percentual_realizado) || 0])),
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

    // Semana e mes pelo calendario da obra (o mesmo do lancamento de avanco)
    const cal = await carregarCalendario(supabase, obra_id)
    const sem = semanaDoCalendario(cal, data_lancamento)
    if (!sem) return res.status(400).json({ error: 'data_lancamento fora do calendário de semanas da obra' })
    const semana = sem.semana

    const { error } = await supabase
      .from('avanco_fisico_historico')
      .update({ data_lancamento, semana_numero: semana, mes_numero: sem.mes })
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
