// pages/api/avanco-fisico-realizado.js
import { supabase } from '../../lib/supabase'

// Início da obra = 01/07/2026 (M01). Semana 1 = primeira semana de julho/2026.
const DATA_INICIO = new Date('2026-07-01T00:00:00Z')
function calcSemana(dataLanc) {
  const d = dataLanc ? new Date(dataLanc) : new Date()
  const diffDias = Math.floor((d - DATA_INICIO) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.floor(diffDias / 7) + 1)
}

export default async function handler(req, res) {
  const obra_id = req.query.obra_id || 'flats_pampulha'

  if (req.method === 'GET') {
    const mes = parseInt(req.query.mes) || 1
    const { data, error } = await supabase
      .from('avanco_fisico_realizado')
      .select('*')
      .eq('obra_id', obra_id)
      .eq('mes_numero', mes)
      .order('codigo_eap')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }

  if (req.method === 'POST') {
    const { mes, lancamentos } = req.body
    if (!mes || !lancamentos) return res.status(400).json({ error: 'mes e lancamentos obrigatorios' })

    // Buscar existentes do mês
    const { data: existentes, error: fetchErr } = await supabase
      .from('avanco_fisico_realizado')
      .select('id, codigo_eap, pavimento, percentual_realizado')
      .eq('obra_id', obra_id)
      .eq('mes_numero', mes)

    if (fetchErr) return res.status(500).json({ error: fetchErr.message })

    const existMap = {}
    ;(existentes || []).forEach(e => {
      existMap[e.codigo_eap + '|' + e.pavimento] = e
    })

    const toInsert = []
    const toUpdate = []
    const toDeleteIds = []
    const historico = []   // <-- NOVO: linhas append-only p/ curva semanal

    const agora = new Date()
    const semana = calcSemana(agora)

    lancamentos.forEach(l => {
      const key = l.codigo_eap + '|' + l.pavimento
      const exist = existMap[key]
      const pct = parseFloat(l.percentual_realizado) || 0

      if (exist) {
        if (pct > 0 && pct !== exist.percentual_realizado) {
          // Mudou: atualizar (foto atual) + registrar no historico
          toUpdate.push({ id: exist.id, ...l, obra_id })
          historico.push(l)
        } else if (pct === 0) {
          // Zerou: deletar da foto atual (nao registra no historico)
          toDeleteIds.push(exist.id)
        }
        // Se igual, nao faz nada (preserva created_at, nao duplica historico)
        delete existMap[key]
      } else if (pct > 0) {
        // Novo: inserir (foto atual) + registrar no historico
        toInsert.push({ ...l, obra_id })
        historico.push(l)
      }
    })

    let erros = []

    // Inserir novos
    if (toInsert.length > 0) {
      const { error } = await supabase.from('avanco_fisico_realizado').insert(toInsert)
      if (error) erros.push('insert: ' + error.message)
    }

    // Atualizar existentes
    for (const item of toUpdate) {
      const { id, ...rest } = item
      const { error } = await supabase.from('avanco_fisico_realizado').update(rest).eq('id', id)
      if (error) erros.push('update ' + id + ': ' + error.message)
    }

    // Deletar zerados
    if (toDeleteIds.length > 0) {
      const { error } = await supabase.from('avanco_fisico_realizado').delete().in('id', toDeleteIds)
      if (error) erros.push('delete: ' + error.message)
    }

    // NOVO: gravar historico (append-only, nunca update/delete)
    let hist_gravados = 0
    if (historico.length > 0) {
      const linhasHist = historico.map(l => ({
        obra_id,
        codigo_eap: l.codigo_eap,
        pavimento: l.pavimento,
        atividade_nome: l.atividade_nome,
        grupo_num: l.grupo_num,
        mes_numero: l.mes_numero != null ? l.mes_numero : mes,
        competencia: l.competencia,
        percentual_realizado: parseFloat(l.percentual_realizado) || 0,
        hh_planejado: l.hh_planejado,
        hh_realizado: l.hh_realizado,
        semana_numero: semana,
        // data_lancamento usa o default now() do banco
      }))
      const { error } = await supabase.from('avanco_fisico_historico').insert(linhasHist)
      if (error) {
        // Nao quebra o salvamento principal se o historico falhar; apenas reporta
        erros.push('historico: ' + error.message)
      } else {
        hist_gravados = linhasHist.length
      }
    }

    if (erros.length > 0) return res.status(500).json({ error: erros.join('; ') })

    return res.status(200).json({
      success: true,
      inseridos: toInsert.length,
      atualizados: toUpdate.length,
      removidos: toDeleteIds.length,
      historico: hist_gravados,
      semana
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
