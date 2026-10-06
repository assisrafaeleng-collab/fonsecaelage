// Avanço físico em hora-homem: horas executadas ÷ horas orçadas (decisão
// out/26). Nunca ponderado por valor.
//
// Mesmas fontes e mesma conta da página semanal (/api/dashboard-semanal):
//   realizado  = hh_acumulado da v_avanco_semanal_realizado ÷ Hh orçado da
//                parcela de produção (orcamento_planejado com entra_evm)
//   planejado  = perc_hh_acum da curva_s_semanal_planejada
// Assim o card do dashboard mensal e o da semanal mostram o mesmo número.

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

const addDias = (iso, n) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10)
}

export async function carregarAvancoHh(supabase, obra_id) {
  const [curvaRes, viewRes, orcRes] = await Promise.all([
    supabase.from('curva_s_semanal_planejada').select('semana_numero, mes_numero, perc_hh_acum').eq('obra_id', obra_id),
    supabase.from('v_avanco_semanal_realizado').select('semana_numero, hh_acumulado, data_fim').eq('obra_id', obra_id),
    supabase.from('orcamento_planejado').select('hh, entra_evm').eq('obra_id', obra_id),
  ])
  for (const [nome, r] of [['curva_s_semanal_planejada', curvaRes], ['v_avanco_semanal_realizado', viewRes], ['orcamento_planejado', orcRes]]) {
    if (r.error) throw new Error(`${nome}: ${r.error.message}`)
  }
  const hhTotal = (orcRes.data || []).reduce((t, it) => (it.entra_evm ? t + num(it.hh) : t), 0)
  if (hhTotal <= 0) throw new Error('orcamento_planejado: soma de hh com entra_evm = 0')

  const real = new Map()
  const dataFim = new Map()
  ;(viewRes.data || []).forEach((r) => {
    const s = parseInt(r.semana_numero, 10)
    if (!Number.isFinite(s)) return
    real.set(s, num(r.hh_acumulado))
    if (r.data_fim) dataFim.set(s, String(r.data_fim).slice(0, 10))
  })
  const semanas = (curvaRes.data || [])
    .map((r) => ({ semana: parseInt(r.semana_numero, 10), mes: parseInt(r.mes_numero, 10) || null, plan: num(r.perc_hh_acum) }))
    .filter((r) => Number.isFinite(r.semana))
    .sort((a, b) => a.semana - b.semana)

  // Calendario: data da view; sem ela, extrapola 7 dias a partir da semana
  // mais antiga com data (mesma ancora da semanal).
  const comData = semanas.map((x) => x.semana).filter((s) => dataFim.has(s))
  const ancora = comData.length ? { semana: comData[0], data_fim: dataFim.get(comData[0]) } : null
  semanas.forEach((x) => {
    x.data_fim = dataFim.get(x.semana) || (ancora ? addDias(ancora.data_fim, (x.semana - ancora.semana) * 7) : null)
    x.hh = real.has(x.semana) ? real.get(x.semana) : null
    x.real = x.hh == null ? null : (x.hh / hhTotal) * 100
  })

  const hojeISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const corrente = semanas.find((x) => x.data_fim && x.data_fim >= hojeISO) || semanas[semanas.length - 1]
  const semanaCorrente = corrente ? corrente.semana : 1
  // Ultima semana em que as horas executadas cresceram (ultima medicao)
  let ultimaMedida = 0
  let anterior = null
  semanas.forEach((x) => {
    if (x.hh == null || x.semana > semanaCorrente) return
    if (anterior == null || x.hh > anterior + 0.005) ultimaMedida = x.semana
    anterior = x.hh
  })
  return { hhTotal, semanas, semanaCorrente, mesCorrente: corrente ? corrente.mes : 1, ultimaMedida }
}

// Avanço no fim do mês m do projeto. Planejado e realizado na MESMA semana,
// como na semanal: o fim do mês, sem passar da última medição (depois dela o
// realizado só repete o último valor e o planejado continuaria andando).
export function avancoNoMes(av, m) {
  const doMes = av.semanas.filter((x) => x.mes != null && x.mes <= m)
  const ultima = doMes.length ? doMes[doMes.length - 1].semana : av.semanas[0].semana
  const s = Math.min(ultima, av.semanaCorrente, av.ultimaMedida || av.semanaCorrente)
  const ponto = av.semanas.find((x) => x.semana === s)
  return {
    semana: s,
    planejado: ponto ? ponto.plan : 0,
    realizado: ponto && ponto.real != null ? ponto.real : 0,
    hh_executado: ponto && ponto.hh != null ? ponto.hh : 0,
    hh_total: av.hhTotal,
  }
}

// Curva mensal: planejado no fim de cada mês; realizado só até o mês corrente.
export function curvaMensalHh(av, meses = 20) {
  const out = []
  for (let m = 1; m <= meses; m++) {
    const doMes = av.semanas.filter((x) => x.mes === m)
    const fim = doMes.length ? doMes[doMes.length - 1] : null
    const temReal = m <= av.mesCorrente
    out.push({
      mes_numero: m,
      planejado: fim ? fim.plan : null,
      realizado: temReal ? avancoNoMes(av, m).realizado : null,
    })
  }
  return out
}
