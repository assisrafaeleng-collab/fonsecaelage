// Medição de avanço por LINHA do orçamento (decisão out/26).
//
// O mesmo código de EAP repetido em várias linhas do orçamento (o mesmo
// serviço por pavimento: 7.1.7 do 1º ao 6º) é medido por código + pavimento:
// a medição de uma linha não vale para as outras. Código de uma linha só
// continua medido pelo código.
//
// Usado pela página semanal (lib/painel-semanal.js) e pelo dashboard mensal
// (lib/avanco-hh.js): os dois calculam as horas executadas linha a linha
// daqui, com a mesma conta.

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

// chave(eap, pavimento): chave da medição da linha. repetido(eap): o código
// aparece em mais de uma linha do orçamento.
export function chavesDeMedicao(orcamento) {
  const n = {}
  ;(orcamento || []).forEach((it) => {
    if (it.cod_eap) n[it.cod_eap] = (n[it.cod_eap] || 0) + 1
  })
  const repetido = (eap) => (n[eap] || 0) > 1
  const chave = (eap, pavimento) => (repetido(eap) ? `${eap}|${pavimento || ''}` : String(eap))
  // Chaves que existem no orçamento (para achar medição sem linha)
  const validas = new Set((orcamento || []).filter((it) => it.cod_eap).map((it) => chave(it.cod_eap, it.pavimento)))
  return { repetido, chave, validas }
}

// Retratos (medições) com a chave da linha, na ordem em que valem: semana,
// data do lançamento. O último até a semana é o percentual da linha.
export function ordenarRetratos(retratos, chave) {
  return (retratos || [])
    .map((r) => ({
      eap: chave(r.codigo_eap, r.pavimento),
      codigo: r.codigo_eap,
      pavimento: r.pavimento || null,
      w: parseInt(r.semana_numero, 10),
      d: String(r.data_lancamento || ''),
      id: r.id || 0,
      perc: num(r.percentual_realizado),
    }))
    .filter((r) => Number.isFinite(r.w))
    // Empate de semana e data: fica a ordem da consulta (sort estável)
    .sort((a, b) => a.w - b.w || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0))
}

// Horas executadas acumuladas por semana: soma, nas linhas da produção
// (entra_evm), de hh da linha × último percentual medido da linha até a
// semana. semanas: números das semanas em ordem crescente.
export function hhExecutadoPorSemana(orcamento, retratosOrd, semanas, chave) {
  const hhPorChave = {}
  ;(orcamento || []).forEach((it) => {
    if (!it.entra_evm || !it.cod_eap) return
    const k = chave(it.cod_eap, it.pavimento)
    hhPorChave[k] = (hhPorChave[k] || 0) + num(it.hh)
  })
  const perc = {}
  let total = 0
  let i = 0
  const out = new Map()
  semanas.forEach((w) => {
    while (i < retratosOrd.length && retratosOrd[i].w <= w) {
      const r = retratosOrd[i]
      const hh = hhPorChave[r.eap] || 0
      total += (hh * (r.perc - (perc[r.eap] || 0))) / 100
      perc[r.eap] = r.perc
      i += 1
    }
    out.set(w, total)
  })
  return out
}
