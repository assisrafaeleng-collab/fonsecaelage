// Avanco fisico realizado a partir de avanco_fisico_historico.
//
// percentual_realizado e ACUMULADO ("o item esta em X%"). O realizado de um
// item ate um mes e o ULTIMO retrato dele ate o fim do mes: mesma ordem da
// pagina semanal (semana, data_lancamento, id), entao item revisado para
// baixo cai, e as duas telas mostram o mesmo numero.

const CAMPOS =
  'id, codigo_eap, pavimento, atividade_nome, grupo_num, percentual_realizado, hh_planejado, ' +
  'semana_numero, mes_numero, data_lancamento'

export async function carregarRetratos(supabase, obra_id) {
  const { data, error } = await supabase
    .from('avanco_fisico_historico')
    .select(CAMPOS)
    .eq('obra_id', obra_id)
    .not('semana_numero', 'is', null)
  if (error) throw new Error(`avanco_fisico_historico: ${error.message}`)
  return (data || [])
    .filter((r) => r.codigo_eap && Number.isFinite(parseInt(r.mes_numero, 10)))
    .sort(
      (a, b) =>
        parseInt(a.semana_numero, 10) - parseInt(b.semana_numero, 10) ||
        String(a.data_lancamento || '').localeCompare(String(b.data_lancamento || '')) ||
        String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true })
    )
}

// Competencia (AAAA-MM-01) do mes do projeto: M1 = jul/2026.
export function competenciaDoMes(mes) {
  const abs = 6 + (mes - 1)
  return `${2026 + Math.floor(abs / 12)}-${String((abs % 12) + 1).padStart(2, '0')}-01`
}

export function ultimoMesMedido(retratos) {
  return retratos.reduce((max, r) => Math.max(max, parseInt(r.mes_numero, 10) || 0), 0)
}

// Foto do avanco no fim do mes: um registro por codigo_eap, com o ultimo %.
// hhPorEap (opcional) da o Hh do item quando o retrato nao trouxe.
export function fotoAteMes(retratos, mes, hhPorEap = {}) {
  const ultimo = {}
  retratos.forEach((r) => {
    if ((parseInt(r.mes_numero, 10) || 0) > mes) return
    ultimo[r.codigo_eap] = r
  })
  return Object.values(ultimo).map((r) => {
    const perc = parseFloat(r.percentual_realizado) || 0
    const hh = parseFloat(r.hh_planejado) || hhPorEap[r.codigo_eap] || 0
    return {
      codigo_eap: r.codigo_eap,
      pavimento: r.pavimento,
      atividade_nome: r.atividade_nome,
      grupo_num: r.grupo_num,
      mes_numero: mes,
      competencia: competenciaDoMes(mes),
      percentual_realizado: perc,
      hh_planejado: hh,
      hh_realizado: (hh * perc) / 100,
    }
  })
}
