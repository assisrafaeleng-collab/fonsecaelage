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

  // POST agora recebe INCREMENTOS (nao mais o total).
  // Cada lancamento traz "incremento" (%). Grava no historico e atualiza a foto
  // com a SOMA de todos os incrementos do item (travada em 100).
  if (req.method === 'POST') {
    const { mes, lancamentos } = req.body
    if (!mes || !lancamentos) return res.status(400).json({ error: 'mes e lancamentos obrigatorios' })

    // Considera apenas itens com incremento > 0
    const incs = lancamentos
      .map(l => ({ ...l, incremento: parseFloat(l.incremento != null ? l.incremento : l.percentual_realizado) || 0 }))
      .filter(l => l.incremento > 0)

    if (incs.length === 0) {
      return res.status(200).json({ success: true, gravados: 0, aviso: 'Nenhum incremento informado' })
    }

    const semana = calcSemana(new Date())
    const erros = []
    const rejeitados = []
    let gravados = 0

    for (const l of incs) {
      const cod = l.codigo_eap
      const pav = l.pavimento

      // 1) soma atual do historico deste item
      const { data: hist, error: e1 } = await supabase
        .from('avanco_fisico_historico')
        .select('percentual_realizado')
        .eq('obra_id', obra_id).eq('codigo_eap', cod).eq('pavimento', pav)
      if (e1) { erros.push(cod + ': ' + e1.message); continue }

      const acumAtual = (hist || []).reduce((s, r) => s + (parseFloat(r.percentual_realizado) || 0), 0)

      // 2) rejeita se ultrapassar 100
      if (acumAtual + l.incremento > 100) {
        rejeitados.push({ codigo_eap: cod, pavimento: pav, acumulado: acumAtual, incremento: l.incremento,
          motivo: `Passaria de 100% (atual ${acumAtual}% + ${l.incremento}%)` })
        continue
      }

      const novoAcum = acumAtual + l.incremento
      const hh_plan = parseFloat(l.hh_planejado) || 0
      const hh_real_acum = hh_plan * (novoAcum / 100)

      // 3) grava o incremento no historico (append-only)
      const { error: e2 } = await supabase.from('avanco_fisico_historico').insert([{
        obra_id, codigo_eap: cod, pavimento: pav, atividade_nome: l.atividade_nome,
        grupo_num: l.grupo_num, mes_numero: l.mes_numero != null ? l.mes_numero : mes,
        competencia: l.competencia, percentual_realizado: l.incremento,
        hh_planejado: hh_plan, hh_realizado: hh_plan * (l.incremento / 100),
        semana_numero: semana,
      }])
      if (e2) { erros.push(cod + ' historico: ' + e2.message); continue }

      // 4) atualiza a "foto atual" com o acumulado somado (upsert manual)
      const { data: fotoExist, error: e3 } = await supabase
        .from('avanco_fisico_realizado')
        .select('id')
        .eq('obra_id', obra_id).eq('codigo_eap', cod).eq('pavimento', pav).eq('mes_numero', mes)
        .maybeSingle()
      if (e3) { erros.push(cod + ' foto: ' + e3.message); continue }

      const fotoData = {
        obra_id, codigo_eap: cod, pavimento: pav, atividade_nome: l.atividade_nome,
        grupo_num: l.grupo_num, mes_numero: mes, competencia: l.competencia,
        percentual_realizado: novoAcum, hh_planejado: hh_plan, hh_realizado: hh_real_acum,
        custo_planejado: l.custo_planejado,
      }

      if (fotoExist) {
        const { error } = await supabase.from('avanco_fisico_realizado')
          .update(fotoData).eq('id', fotoExist.id)
        if (error) erros.push(cod + ' update foto: ' + error.message); else gravados++
      } else {
        const { error } = await supabase.from('avanco_fisico_realizado').insert([fotoData])
        if (error) erros.push(cod + ' insert foto: ' + error.message); else gravados++
      }
    }

    if (erros.length > 0) return res.status(500).json({ error: erros.join('; '), rejeitados })

    return res.status(200).json({ success: true, gravados, rejeitados, semana })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
