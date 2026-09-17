// pages/api/avanco-lancamento.js
//
// Inclusao, edicao e exclusao de medicao de avanco fisico.
//
// percentual_realizado e ACUMULADO: "o item esta em X%". E assim que a
// v_avanco_semanal_realizado calcula (perc_ff / 100 x custo_item). Nao e
// incremento — a variacao que a tela mostra e calculada na exibicao.
//
// A semana e derivada da data escolhida pelo usuario, nunca de now(): o
// lancamento pode registrar medicao de uma semana anterior.
import { supabase } from '../../lib/supabase'

const iso10 = (v) => String(v || '').slice(0, 10)

async function contexto(obra_id, dataISO, codigo_eap) {
  const [semanaRes, itemRes] = await Promise.all([
    supabase
      .from('calendario_semanas')
      .select('semana_numero, mes_numero, data_inicio, data_fim')
      .eq('obra_id', obra_id)
      .lte('data_inicio', dataISO)
      .gte('data_fim', dataISO)
      .limit(1),
    supabase
      .from('orcamento_planejado')
      .select('cod_eap, descricao, grupo_numero, pavimento, hh')
      .eq('obra_id', obra_id)
      .eq('cod_eap', codigo_eap)
      .limit(1),
  ])

  if (semanaRes.error) throw new Error(`calendario_semanas: ${semanaRes.error.message}`)
  if (itemRes.error) throw new Error(`orcamento_planejado: ${itemRes.error.message}`)

  const semana = semanaRes.data && semanaRes.data[0]
  if (!semana) {
    // Nao afirmar que a data esta fora do cronograma: a consulta tambem volta
    // vazia quando a tabela nao e legivel pela chave em uso (RLS sem policy).
    const { count } = await supabase
      .from('calendario_semanas')
      .select('semana_numero', { count: 'exact', head: true })
      .eq('obra_id', obra_id)
    if (!count) {
      throw new Error(
        'calendario_semanas nao retornou nenhuma linha para esta obra — verifique a policy de leitura'
      )
    }
    throw new Error(`a data ${dataISO} nao cai em nenhuma das ${count} semanas do cronograma`)
  }
  const item = (itemRes.data && itemRes.data[0]) || null
  return { semana, item }
}

export default async function handler(req, res) {
  const obra_id = req.body?.obra_id || req.query?.obra_id || 'flats_pampulha'

  try {
    if (req.method === 'POST' || req.method === 'PUT') {
      const { id, codigo_eap, percentual, data } = req.body || {}

      if (!codigo_eap) return res.status(400).json({ error: 'codigo_eap é obrigatório' })
      const perc = parseFloat(percentual)
      if (!Number.isFinite(perc) || perc < 0 || perc > 100) {
        return res.status(400).json({ error: 'percentual deve estar entre 0 e 100' })
      }
      const dataISO = iso10(data)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
        return res.status(400).json({ error: 'data inválida' })
      }

      const { semana, item } = await contexto(obra_id, dataISO, codigo_eap)
      const hh = item ? parseFloat(item.hh) || 0 : 0

      // Meio-dia em UTC: guardar meia-noite faria a data voltar um dia em
      // UTC-3 na hora de reler.
      const registro = {
        obra_id,
        codigo_eap,
        percentual_realizado: perc,
        data_lancamento: `${dataISO}T12:00:00Z`,
        semana_numero: semana.semana_numero,
        mes_numero: semana.mes_numero,
        competencia: `${dataISO.slice(0, 7)}-01`,
        pavimento: item?.pavimento || null,
        atividade_nome: item?.descricao || null,
        grupo_num: item?.grupo_numero ?? null,
        hh_planejado: hh || null,
        hh_realizado: hh ? parseFloat(((hh * perc) / 100).toFixed(2)) : null,
      }

      const resposta = id
        ? await supabase.from('avanco_fisico_historico').update(registro).eq('id', id).select()
        : await supabase.from('avanco_fisico_historico').insert(registro).select()

      if (resposta.error) throw new Error(resposta.error.message)
      return res.status(200).json({ ok: true, registro: resposta.data?.[0] || null })
    }

    if (req.method === 'DELETE') {
      const id = req.body?.id || req.query?.id
      if (!id) return res.status(400).json({ error: 'id é obrigatório' })
      const { error } = await supabase.from('avanco_fisico_historico').delete().eq('id', id)
      if (error) throw new Error(error.message)
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Erro no lançamento de avanço:', error)
    return res.status(500).json({ error: 'Não foi possível salvar', message: error.message })
  }
}
