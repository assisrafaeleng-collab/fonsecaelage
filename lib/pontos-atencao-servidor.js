// Painel "Pontos de atenção" no SERVIDOR: lê o banco e entrega as entradas para a conta pura (lib/pontos-atencao.js).
// Reaproveita o painel semanal (lib/painel-semanal.js) para o % de cada linha, o pago e o a pagar por linha, o
// vínculo material → serviço (herda_de) e a curva (adiantamento e desembolso previsto) — sem lógica paralela.
// Tabelas de planejamento (supabase/planejamento/1 e 2): sem elas o painel segue com tudo "pendente" e avisa
// "configure as tabelas". Só leitura; a chave secreta fica aqui no servidor.
import { calcularPainelSemanal } from './painel-semanal'
import { carregarCalendario } from './calendario'
import { carregarContasAPagar } from './contas-a-pagar'
import { chavesDeMedicao, carregarMedicoes } from './medicao-linha'
import { montarPontosAtencao } from './pontos-atencao'

if (typeof window !== 'undefined') {
  throw new Error('lib/pontos-atencao-servidor.js é só para o servidor (pages/api).')
}

export const OBRA_ID = 'flats_pampulha'
const naoExiste = (e) => /does not exist|could not find the table|schema cache|column .* does not exist/i.test(String(e && e.message))
const iso10 = (v) => String(v || '').slice(0, 10)

const BASE_IX = 'cod_eap, pavimento, unidade, regra, hh_por_unidade, duracao_dias, origem, hh_cronograma, hh_cpu, hh_cpu_oficial, conferir, tipo_equipe, equipes_cronograma, aguarda_medicao, observacao'
const EDICAO_IX = ', equipes_definidas, equipe_oficiais, equipe_ajudantes, equipe_funcao, editado_por, editado_em'

// Lê uma tabela de planejamento; null = tabela (ou coluna) ainda não criada
async function ler(supabase, tabela, campos) {
  const r = await supabase.from(tabela).select(campos).eq('obra_id', OBRA_ID)
  if (r.error) {
    if (naoExiste(r.error)) return null
    throw new Error(`${tabela}: ${r.error.message}`)
  }
  return r.data || []
}

async function lerIndices(supabase) {
  const com = await ler(supabase, 'indice_produtividade', BASE_IX + EDICAO_IX)
  if (com) return { linhas: com, edicao: true }
  return { linhas: await ler(supabase, 'indice_produtividade', BASE_IX), edicao: false }
}

// Entradas da conta (também usadas pelo teste por script, ?entradas=1 só em desenvolvimento)
export async function carregarEntradas(supabase, semana) {
  const painel = await calcularPainelSemanal(supabase, { obra_id: OBRA_ID, semana, memoria: true })
  const S = painel.semana_atual
  const [orc, ret, ind, cal, contas, ixs, eqs, prz, jor, fer, hist] = await Promise.all([
    supabase.from('orcamento_planejado')
      .select('cod_eap, pavimento, descricao, grupo_numero, grupo_nome, quantidade, hh, preco_total, entra_evm, mes_inicio, mes_fim')
      .eq('obra_id', OBRA_ID),
    carregarMedicoes(supabase, OBRA_ID),
    supabase.from('custos_indiretos_planejados').select('cod_eap, categoria, valor_total, mes_desembolso').eq('obra_id', OBRA_ID),
    carregarCalendario(supabase, OBRA_ID),
    carregarContasAPagar(supabase, OBRA_ID),
    lerIndices(supabase),
    ler(supabase, 'equipe_padrao', 'tipo, nome, composicao, oficiais, ajudantes, funcao_oficial'),
    lerPrazos(supabase),
    ler(supabase, 'obra_jornada', 'horas_dia, dias_semana'),
    ler(supabase, 'obra_feriados', 'data, descricao, abrangencia, a_confirmar'),
    ler(supabase, 'planejamento_historico', 'cod_eap, pavimento, campo, valor_anterior, valor_novo, editado_por, editado_em'),
  ])
  for (const [nome, r] of [['orcamento_planejado', orc], ['avanco_fisico_historico', ret], ['custos_indiretos_planejados', ind]]) {
    if (r.error) throw new Error(`${nome}: ${r.error.message}`)
  }
  const semanas = cal.semanas
  const fimS = (semanas.find((s) => s.semana === S) || semanas[semanas.length - 1]).data_fim
  const dataDaSemana = new Map(semanas.map((s) => [s.semana, s.data_fim]))

  // memória do valor agregado (parcela A): % da linha, pago e a pagar da linha, herda_de
  const mem = new Map((painel.memoria_agregado.parcela_a.itens || []).map((i) => [`${i.cod_eap}|${i.pavimento || ''}`, i]))
  // medições por linha (código + pavimento quando o código se repete), até a semana
  const med = chavesDeMedicao(orc.data || [])
  const medicoesDe = {}
  ;(ret.data || []).forEach((r) => {
    const w = parseInt(r.semana_numero, 10)
    if (!(w <= S)) return
    const k = med.chave(r.codigo_eap, r.pavimento)
    ;(medicoesDe[k] = medicoesDe[k] || []).push({ data: iso10(r.data_lancamento) || dataDaSemana.get(w) || null, semana: w,
      percentual: Number(r.percentual_realizado) || 0 })
  })
  const linhas = (orc.data || []).map((o) => {
    const m = mem.get(`${o.cod_eap}|${o.pavimento || ''}`)
    return {
      cod_eap: o.cod_eap, pavimento: o.pavimento || null, descricao: o.descricao || '',
      grupo_numero: parseInt(o.grupo_numero, 10), grupo_nome: o.grupo_nome || '', quantidade: Number(o.quantidade) || 0,
      hh: Number(o.hh) || 0, preco_total: Number(o.preco_total) || 0, entra_evm: !!o.entra_evm,
      mes_inicio: o.mes_inicio, mes_fim: o.mes_fim,
      perc_real: m ? Number(m.perc_fisico) || 0 : 0, pago: m ? Number(m.pago_linha) || 0 : 0,
      a_pagar: m ? Number(m.a_pagar_linha) || 0 : 0, herda_de: m && m.herda_de ? m.herda_de : null,
      medicoes: o.cod_eap ? medicoesDe[med.chave(o.cod_eap, o.pavimento)] || [] : [],
    }
  })
  const indices = {}
  ;(ixs.linhas || []).forEach((i) => { indices[`${i.cod_eap}|${i.pavimento || ''}`] = i })
  const equipes = {}
  ;(eqs || []).forEach((e) => { equipes[e.tipo] = e })
  const jornada = jor && jor.length ? { horas_dia: Number(jor[0].horas_dia), dias_semana: (jor[0].dias_semana || []).map(Number) } : null
  return {
    semana: S, data_fim: fimS, linhas, semanas, indices, equipes, prazos: prz || [], jornada,
    feriados: (fer || []).map((f) => iso10(f.data)).sort(),
    feriados_lista: fer || [],
    curva: (painel.curva || []).map((c) => ({ semana: c.semana, data_inicio: c.data_inicio, data_fim: c.data_fim,
      avanco_plan_hh: c.avanco_plan_hh, avanco_real_hh: c.avanco_real_hh, financeiro_planejado: c.financeiro_planejado })),
    ultimaMedicao: Math.min(S, painel.ultima_semana_com_avanco || S),
    contas: contas.disponivel ? contas.linhas : [], contas_fechamento: contas.disponivel ? contas.fechamento : null,
    indiretos: ind.data || [], historico: hist || [],
    configurado: { indices: ixs.linhas != null, equipes: eqs != null, prazos: prz != null, jornada: !!jornada,
      feriados: !!(fer && fer.length), edicao: !!(ixs.edicao && hist != null), contas: contas.disponivel },
  }
}

async function lerPrazos(supabase) {
  const com = await ler(supabase, 'insumo_prazo_entrega', 'cod_eap, pavimento, categoria, regra, antecedencia_dias, antecedencia_meses, observacao, editado_por, editado_em')
  if (com) return com
  return ler(supabase, 'insumo_prazo_entrega', 'cod_eap, pavimento, categoria, regra, antecedencia_dias, antecedencia_meses, observacao')
}

// Painel pronto para a tela: a conta pura + histórico de edições por linha + avisos
export async function montarPainelPontos(supabase, semana) {
  const e = await carregarEntradas(supabase, semana)
  const out = montarPontosAtencao(e)
  const porLinha = {}
  e.historico.slice().sort((a, b) => String(b.editado_em).localeCompare(String(a.editado_em)))
    .forEach((h) => (porLinha[`${h.cod_eap}|${h.pavimento || ''}`] = porLinha[`${h.cod_eap}|${h.pavimento || ''}`] || []).push(h))
  out.atividades.forEach((a) => { a.historico = porLinha[a.chave] || [] })
  out.compras.forEach((c) => { c.historico = porLinha[`${c.cod_eap}|`] || [] })
  out.feriados_lista = e.feriados_lista
  out.contas_fechamento = e.contas_fechamento
  return out
}
