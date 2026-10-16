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

// Ordem em que as medições valem: semana, data da medição e, no empate (duas
// medições do mesmo item no mesmo dia), a ÚLTIMA GRAVADA (gravado_em, decisão
// de 16/10/2026; supabase/avanco/2-gravado-em.sql). Sem gravado_em (registro
// antigo ou coluna ainda não criada) fica antes, na ordem da consulta.
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0)
export const ordemDaMedicao = (a, b) =>
  (parseInt(a.semana_numero, 10) || 0) - (parseInt(b.semana_numero, 10) || 0) ||
  cmp(String(a.data_lancamento || ''), String(b.data_lancamento || '')) ||
  cmp(String(a.gravado_em || ''), String(b.gravado_em || ''))

// Retratos (medições) com a chave da linha, na ordem em que valem
// (ordemDaMedicao). O último até a semana é o percentual da linha.
export function ordenarRetratos(retratos, chave) {
  return (retratos || [])
    .filter((r) => Number.isFinite(parseInt(r.semana_numero, 10)))
    .slice()
    .sort(ordemDaMedicao)
    .map((r) => ({
      eap: chave(r.codigo_eap, r.pavimento),
      codigo: r.codigo_eap,
      pavimento: r.pavimento || null,
      w: parseInt(r.semana_numero, 10),
      d: String(r.data_lancamento || ''),
      id: r.id || 0,
      perc: num(r.percentual_realizado),
    }))
}

// Última medição de cada linha (chave da linha) até a data `ate` (AAAA-MM-DD,
// inclusive; sem ela, todas): a mesma regra do painel semanal.
// Devolve { chave: registro original }.
export function ultimaMedicaoPorLinha(retratos, chave, ate = null) {
  const out = {}
  ;(retratos || [])
    .filter((r) => !ate || String(r.data_lancamento || '').slice(0, 10) <= ate)
    .slice()
    .sort(ordemDaMedicao)
    .forEach((r) => (out[chave(r.codigo_eap, r.pavimento)] = r))
  return out
}

export const CAMPOS_MEDICAO = 'id, codigo_eap, pavimento, percentual_realizado, semana_numero, data_lancamento'
let temGravadoEm = null // descoberto na primeira leitura (coluna criada pelo 2-gravado-em.sql)
const semColuna = (e) => /gravado_em/.test(String(e && e.message)) && /does not exist|could not find|schema cache/i.test(String(e && e.message))

// Lê avanco_fisico_historico INTEIRO, em páginas de 1000 (o Supabase corta a
// consulta em 1000 linhas sem avisar), já na ordem em que as medições valem.
// opcoes: campos (select), comSemana (só registros com semana_numero, padrão
// true), filtro (q) => q com filtros extras. Devolve { data, error } como o
// Supabase, para entrar nos Promise.all que já existem.
export async function carregarMedicoes(supabase, obra_id, opcoes = {}) {
  const { campos = CAMPOS_MEDICAO, comSemana = true, filtro = null } = opcoes
  const ler = async (sel) => {
    const linhas = []
    for (let de = 0; ; de += 1000) {
      let q = supabase.from('avanco_fisico_historico').select(sel).eq('obra_id', obra_id)
      if (comSemana) q = q.not('semana_numero', 'is', null)
      if (filtro) q = filtro(q)
      // Mesma ordem da consulta de antes (semana, data): no empate do mesmo dia
      // sem gravado_em (medições antigas) vale a ordem em que o banco devolve,
      // que é a que o painel sempre usou — o sort abaixo é estável
      const r = await q.order('semana_numero').order('data_lancamento').range(de, de + 999)
      if (r.error) return { data: null, error: r.error }
      linhas.push(...(r.data || []))
      if (!r.data || r.data.length < 1000) break
    }
    return { data: linhas.sort(ordemDaMedicao), error: null }
  }
  if (temGravadoEm !== false) {
    const r = await ler(`${campos}, gravado_em`)
    if (!r.error) {
      temGravadoEm = true
      return r
    }
    if (!semColuna(r.error)) return r
    temGravadoEm = false
  }
  return ler(campos)
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
