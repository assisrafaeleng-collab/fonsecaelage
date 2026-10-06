// Calendario de semanas da obra (tabela calendario_semanas), num lugar so.
//
// Decisao out/26: a semana termina no domingo OU no ultimo dia do mes, entao
// a semana que cruza a virada do mes e partida e as semanas deixam de ter
// sempre 7 dias. Todo rateio por semana (indireto do mes, verba por tempo,
// planejado por item) pesa pelos DIAS da semana, nunca 1/numero de semanas.
// Com o calendario antigo (todas de 7 dias) as contas dao o mesmo de antes.

const iso10 = (v) => String(v || '').slice(0, 10)

export const addDias = (iso, n) => {
  const [y, m, d] = iso10(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  // Date.UTC na entrada e toISOString na saida: sem passar pelo fuso local.
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10)
}

// Dias de a ate b, inclusive (datas 'AAAA-MM-DD').
export const diasEntre = (a, b) => Math.round((Date.parse(iso10(b)) - Date.parse(iso10(a))) / 86400000) + 1

// Le o calendario. Volta { semanas: [{ semana, data_inicio, data_fim, mes, dias }], porSemana: Map }.
// Sem tabela ou sem linhas, volta semanas vazio: quem chama decide o que fazer.
export async function carregarCalendario(supabase, obra_id) {
  const r = await supabase
    .from('calendario_semanas')
    .select('semana_numero, data_inicio, data_fim, mes_numero')
    .eq('obra_id', obra_id)
    .order('semana_numero')
  if (r.error) throw new Error(`calendario_semanas: ${r.error.message}`)
  const semanas = (r.data || [])
    .map((x) => ({
      semana: parseInt(x.semana_numero, 10),
      data_inicio: iso10(x.data_inicio),
      data_fim: iso10(x.data_fim),
      mes: parseInt(x.mes_numero, 10) || null,
    }))
    .filter((x) => Number.isFinite(x.semana) && x.data_inicio && x.data_fim)
    .sort((a, b) => a.semana - b.semana)
  semanas.forEach((x) => (x.dias = diasEntre(x.data_inicio, x.data_fim)))
  return { semanas, porSemana: new Map(semanas.map((x) => [x.semana, x])) }
}

// Semana que contem a data (ou null).
export const semanaDoCalendario = (cal, data) => {
  const d = iso10(data)
  return cal.semanas.find((x) => x.data_inicio <= d && d <= x.data_fim) || null
}
