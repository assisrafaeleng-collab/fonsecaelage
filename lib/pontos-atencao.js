// Painel "Pontos de atenção" — próxima semana e próximos 30 dias (cópia adaptada do Sirius 60, pedidos 14B a 14D;
// respostas do Rafael de 13/10/2026). Conta pura: não acessa o banco e não importa nada, para rodar igual no servidor
// (lib/pontos-atencao-servidor.js), na tela (recalcular ao editar) e no teste por script.
//
// REGRA DE OURO: nenhum índice, equipe, prazo ou feriado inventado. Sem dado → "dado pendente" (lista de pendências).
//
// Regras do Flats (CLAUDE.md e respostas da fase 1):
//   Atividade = linha do orçamento (código + pavimento) com horas e entra_evm, grupos 1 a 16. "Apenas material" fica
//     fora das equipes e entra no caixa pelo vínculo (memória do valor agregado, AGREGADO_HERDA de lib/painel-semanal.js).
//   Índice = Hh do OFICIAL por unidade (o mesmo do cronograma e do avanço físico). Capacidade de 1 equipe por dia =
//     nº de OFICIAIS × horas/dia. Serviço por duração: horas = dias × oficiais × horas/dia (1 equipe).
//   Planejado da linha numa data = linear pelos DIAS entre o início da 1ª semana de mes_inicio e o fim da última semana
//     de mes_fim (a mesma janela de percPlanejadoAte, lib/painel-semanal.js). "Hoje" = fim da semana do filtro.
//   Caixa do período = atividades (% a executar × orçado do serviço e dos materiais vinculados, descontado o já
//     comprado além do executado) + contas a pagar com vencimento no período + recorrentes DIRETOS (17 sem a bandeja,
//     18, 1.1.6) e INDIRETOS (mes_desembolso = 0) pelo planejado diluído + indiretos pontuais do período. O contas a
//     pagar do Flats já exclui os recorrentes, por isso eles entram pelo planejado (não falta salário, locação, consumo).

export const PREMISSA = 'caixa pelo valor do serviço executado no período; prazos de pagamento de fornecedores ainda não considerados'

// Fora do painel (Rafael 13/10): aço da estaca, fundação concluída
export const FORA_DO_PAINEL = new Set(['2.1.6'])
// Material sem vínculo no valor agregado que entra no caixa junto com serviços do MESMO pavimento (Rafael 13/10):
// cabeamento com os pontos de elétrica, pelo orçado de cada ponto
export const CAIXA_JUNTO = { '7.1.8': ['7.1.2', '7.1.3', '7.1.4'], '7.1.9': ['7.1.2', '7.1.3', '7.1.4'] }
// Recorrentes DIRETOS (fora do contas a pagar): locação (grupo 17 com entra_evm = false; a bandeja é por entrega),
// funcionários (18) e consumo mensal (1.1.6)
export const ehRecorrenteDireto = (l) =>
  (l.grupo_numero === 17 && !l.entra_evm) || l.grupo_numero === 18 || l.cod_eap === '1.1.6'

const DIA = 864e5
const t = (s) => Date.parse(String(s).slice(0, 10) + 'T00:00:00Z')
const iso = (ms) => new Date(ms).toISOString().slice(0, 10)          // data pura em UTC (sem fuso)
const mais = (s, n) => iso(t(s) + n * DIA)
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100
const chave = (l) => `${l.cod_eap}|${l.pavimento || ''}`
// soma n meses a uma data (dia limitado ao último do mês)
export function somarMeses(s, n) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + n, 1))
  const ult = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  return iso(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(d, ult)))
}

export function diasUteis(de, ate, jornada, feriados) {
  if (!jornada) return null
  const fer = new Set(feriados)
  let n = 0
  for (let x = t(de); x <= t(ate); x += DIA) {
    const dow = new Date(x).getUTCDay()               // 0 = domingo
    if (jornada.dias_semana.includes(dow === 0 ? 7 : dow) && !fer.has(iso(x))) n++
  }
  return n
}

// data do n-ésimo dia útil a partir de "de" (inclusive); n = 0 → null
export function somarDiasUteis(de, n, jornada, feriados) {
  if (!(n > 0) || !jornada) return null
  const fer = new Set(feriados)
  let k = 0
  for (let x = t(de); k < 4000; x += DIA, k++) {
    const dow = new Date(x).getUTCDay()
    if (jornada.dias_semana.includes(dow === 0 ? 7 : dow) && !fer.has(iso(x)) && --n === 0) return iso(x)
  }
  return null
}

// Janela da linha: início da 1ª semana do mes_inicio → fim da última semana do mes_fim (calendario_semanas)
export function janelaDaLinha(l, semanas) {
  const mi = parseInt(l.mes_inicio, 10) || 1
  const mf = parseInt(l.mes_fim, 10) || mi
  const doMes = semanas.filter((s) => s.mes >= mi && s.mes <= mf)
  if (!doMes.length) return null
  return { inicio: doMes[0].data_inicio, fim: doMes[doMes.length - 1].data_fim }
}

// % planejado da linha no fim do dia "data" (linear pelos dias da janela)
export function planejadoNaData(jan, data) {
  if (!jan) return 0
  const ini = t(jan.inicio), fim = t(jan.fim) + DIA, x = t(data) + DIA
  if (x <= ini) return 0
  if (x >= fim) return 100
  return (100 * (x - ini)) / (fim - ini)
}

// Valor de uma janela [inicio, fim] (linear pelos dias) que cai dentro do período [de, ate]
function rateioDias(valor, inicio, fim, de, ate) {
  const a = Math.max(t(inicio), t(de)), b = Math.min(t(fim), t(ate))
  if (b < a) return 0
  return (valor * ((b - a) / DIA + 1)) / ((t(fim) - t(inicio)) / DIA + 1)
}

// Adiantamento — a mesma conta do card da página semanal (pages/semanal.js): semana em que a curva de físico
// planejado atinge o físico realizado da última medição, menos a semana dessa medição. Dias > 0 = adiantado.
// curva: [{ semana, data_inicio, data_fim, avanco_plan_hh, avanco_real_hh }]
export function calcularAdiantamento(curva, semMedida) {
  if (!curva || !curva.length || !semMedida) return null
  const iMed = curva.findIndex((c) => c.semana === semMedida)
  const real = iMed >= 0 ? curva[iMed].avanco_real_hh : null
  if (real == null || !(real > 0)) return null
  const dia = (s) => t(s) / DIA
  for (let i = 0; i < curva.length; i += 1) {
    const pl = curva[i].avanco_plan_hh || 0
    if (pl < real) continue
    const ant = i > 0 ? curva[i - 1] : null
    const plAnt = ant ? ant.avanco_plan_hh || 0 : 0
    const f = pl - plAnt > 1e-9 ? (real - plAnt) / (pl - plAnt) : 1
    const wAnt = ant ? ant.semana : curva[i].semana - 1
    const dAnt = ant ? dia(ant.data_fim) : dia(curva[i].data_inicio) - 1
    const wEq = wAnt + f * (curva[i].semana - wAnt)
    const diaEq = dAnt + f * (dia(curva[i].data_fim) - dAnt)
    return { semanas: wEq - semMedida, dias: Math.round(diaEq - dia(curva[iMed].data_fim)), real, wEq, semMed: semMedida }
  }
  return null
}

// Horas da linha (100%) pelo índice real: duração (dias × oficiais × horas/dia) ou quantidade × índice; null = pendente
export function horasDaLinha({ regra, quantidade, indice, duracaoDias, oficiais, horasDia }) {
  if (regra === 'duracao') return duracaoDias > 0 && oficiais > 0 && horasDia > 0 ? duracaoDias * oficiais * horasDia : null
  return indice != null && indice !== '' && Number(indice) > 0 ? Number(quantidade) * Number(indice) : null
}

// TÉRMINO de uma atividade (igual no servidor e na tela, ao editar):
//   horas que faltam = (100% − concluído) × horas da linha; capacidade/dia de 1 equipe = oficiais × horas/dia
//   data-alvo = fim no cronograma (já passou → hoje + 30 dias)
//   equipes necessárias = horas ÷ (capacidade/dia × dias úteis até a data-alvo) (com fração)
//   sugeridas = coluna "Equipes" do cronograma em Excel (Rafael 13/10); sem ela, as necessárias para cima
//   término com N equipes = hoje + horas ÷ (N × capacidade/dia) dias úteis; cumpre se ≤ fim do cronograma
export function calcularTermino({ base, real, oficiais, equipes, equipesCronograma, fimCrono, hoje, jornada, feriados }) {
  const horas = base == null ? null : (Math.max(100 - (real || 0), 0) / 100) * base
  const capDia = oficiais > 0 && jornada ? oficiais * jornada.horas_dia : null
  const amanha = mais(hoje, 1)
  const alvo = fimCrono && fimCrono > hoje ? fimCrono : mais(hoje, 30)
  const diasAlvo = jornada ? diasUteis(amanha, alvo, jornada, feriados) : null
  const necessarias = horas == null || !capDia ? null : horas <= 0 ? 0 : horas / (capDia * Math.max(diasAlvo, 1))
  const sugeridas = necessarias == null ? null : necessarias === 0 ? 0
    : equipesCronograma > 0 ? Number(equipesCronograma) : Math.max(1, Math.ceil(necessarias - 1e-9))
  const definida = equipes != null && equipes !== ''
  const usadas = definida ? Number(equipes) : sugeridas
  const dias = horas == null || !capDia || !(usadas > 0) ? null : Math.ceil(horas / (usadas * capDia) - 1e-9)
  const termino = dias ? somarDiasUteis(amanha, dias, jornada, feriados) : dias === 0 ? hoje : null
  const cumpre = termino && fimCrono ? termino <= fimCrono : null
  const atrasa = termino && fimCrono && !cumpre ? diasUteis(mais(fimCrono, 1), termino, jornada, feriados) : 0
  return { horas: horas == null ? null : r1(horas), base: base == null ? null : r1(base), capacidade_dia: capDia, alvo,
    dias_ate_alvo: diasAlvo, necessarias: necessarias == null ? null : Math.round(necessarias * 100) / 100,
    sugeridas, sugeridas_origem: equipesCronograma > 0 ? 'cronograma' : 'cálculo', usadas, definida, dias, termino,
    cumpre, atrasa }
}

// Equipes do CAIXA (regra final do Sirius, 09/10): definidas (salvas ou digitadas) → o nº inteiro, o mesmo do término;
// só sugeridas → as necessárias para terminar na data-alvo, com fração (equipe inteira puxaria serviço para agora)
export function equipesDoCaixa(tm) {
  return tm.definida ? tm.usadas : tm.necessarias
}

// RITMO ATUAL: % concluído ÷ dias úteis desde o início real (1ª medição com avanço, quando há mais de uma; senão o
// início planejado) até a última medição. Fim no ritmo = última medição + (100% − concluído) ÷ ritmo, em dias úteis.
// Sem medição: "não iniciada" (e "deveria ter começado em" se o início planejado já passou).
export function ritmoAtual({ real, medicoes = [], inicioPlan, fimCrono, hoje, jornada, feriados }) {
  const ms = medicoes.filter((m) => m.data && m.data <= hoje).sort((a, b) => a.data.localeCompare(b.data))
  if (!ms.length || !(real > 0)) {
    const deveria = inicioPlan && inicioPlan <= hoje ? inicioPlan : null
    return { nao_iniciada: true, deveria_desde: deveria, atrasa: deveria && jornada ? diasUteis(deveria, hoje, jornada, feriados) : 0 }
  }
  const comAvanco = ms.filter((m) => m.percentual > 0)
  const inicio = comAvanco.length > 1 ? comAvanco[0].data : inicioPlan && inicioPlan <= comAvanco[0].data ? inicioPlan : comAvanco[0].data
  const ultima = ms[ms.length - 1].data
  if (real >= 100) return { inicio_real: inicio, ultima, ritmo: null, fim_ritmo: ultima, atrasa: 0, cumpre: true }
  if (!jornada) return { inicio_real: inicio, ultima, ritmo: null, fim_ritmo: null, atrasa: 0, cumpre: null }
  const du = Math.max(diasUteis(inicio, ultima, jornada, feriados), 1)
  const ritmo = real / du                                    // % por dia útil
  const falta = Math.ceil((100 - real) / ritmo - 1e-9)
  const fim = somarDiasUteis(mais(ultima, 1), falta, jornada, feriados)
  const cumpre = fimCrono ? fim <= fimCrono : null
  return { inicio_real: inicio, ultima, ritmo: r2(ritmo), dias_uteis: du, fim_ritmo: fim, cumpre,
    atrasa: fimCrono && !cumpre ? diasUteis(mais(fimCrono, 1), fim, jornada, feriados) : 0 }
}

// % A EXECUTAR NO PERÍODO — o caixa segue o MESMO plano das equipes da coluna de término:
//   (1) com equipes e horas: % = (equipes × oficiais × horas/dia × dias úteis do período) ÷ horas por 1%
//       (horas da linha ÷ 100), limitado ao que falta
//   (2) sem equipe ou sem índice: ritmo do cronograma no período + atraso diluído em 30 dias (fração dos dias úteis do
//       período sobre os dos 30 dias), limitado ao que falta — nunca o atraso inteiro de uma vez
export function pctNoPeriodo({ real, planHoje, planFim, base, oficiais, equipes, diasPeriodo, diasMes, horasDia }) {
  const r = real || 0
  const falta = Math.max(100 - r, 0)
  const nEq = equipes != null && equipes !== '' ? Number(equipes) : null
  if (nEq != null && base > 0 && oficiais > 0 && horasDia > 0 && diasPeriodo != null) {
    const hh = nEq * oficiais * horasDia * diasPeriodo
    const porPct = base / 100
    return { pct: Math.min(falta, hh / porPct), modo: 'equipes', equipes: nEq, oficiais, horas_dia: horasDia,
      dias: diasPeriodo, hh, horas_por_pct: porPct, limitado: hh / porPct > falta }
  }
  const ritmo = Math.max((planFim || 0) - Math.max(planHoje || 0, r), 0)
  const atrasoTotal = Math.max((planHoje || 0) - r, 0)
  // sem jornada não há dias úteis: dilui pelos dias corridos (7 de 30)
  const frac = diasMes > 0 ? Math.min(diasPeriodo / diasMes, 1) : 1
  const atraso = atrasoTotal * frac
  return { pct: Math.min(falta, ritmo + atraso), modo: 'cronograma', ritmo, atraso, atraso_total: atrasoTotal,
    dias: diasPeriodo, dias_mes: diasMes, limitado: ritmo + atraso > falta }
}

// CAIXA DA ATIVIDADE no período = % × orçado do serviço (menos o que a própria linha já tem pago/a pagar além do
// executado) + Σ % × orçado dos materiais vinculados (menos o comprado além do aplicado). Concreto usinado conta
// como material. materiais: [{ orcado, excesso }] já multiplicados pelo peso do vínculo.
export function caixaAtividade({ pct, orcado, excessoProprio = 0, materiais = [], proprioEhMaterial = false }) {
  const proprio = Math.max((pct / 100) * (orcado || 0) - excessoProprio, 0)
  const vinc = materiais.reduce((s, m) => s + Math.max((pct / 100) * m.orcado - m.excesso, 0), 0)
  const mo = proprioEhMaterial ? 0 : proprio
  const material = vinc + (proprioEhMaterial ? proprio : 0)
  return { mo: r2(mo), material: r2(material), total: r2(mo + material) }
}

// linhas: orçamento inteiro com { cod_eap, pavimento, descricao, grupo_numero, grupo_nome, quantidade, hh, preco_total,
//   entra_evm, mes_inicio, mes_fim, perc_real, medicoes: [{data, percentual}], pago, a_pagar, herda_de: [códigos] }
// semanas: calendario_semanas [{ semana, data_inicio, data_fim, mes }]; semana: nº da semana do filtro
// indices: { 'eap|pav': linha de indice_produtividade }; equipes: { tipo: equipe_padrao }; prazos: insumo_prazo_entrega
// jornada: { horas_dia, dias_semana } ou null (pendente); feriados: ['AAAA-MM-DD']
// curva: pontos da curva da semanal [{ semana, data_inicio, data_fim, avanco_plan_hh, avanco_real_hh, financeiro_planejado (acumulado) }]
// contas: contas_a_pagar do fechamento; indiretos: custos_indiretos_planejados
export function montarPontosAtencao({ linhas, semanas, semana, indices = {}, equipes = {}, prazos = [], jornada = null,
  feriados = [], curva = [], ultimaMedicao = null, contas = [], indiretos = [], configurado = {} }) {
  const sem = semanas.find((s) => s.semana === semana) || semanas[semanas.length - 1]
  const hoje = sem.data_fim
  const h1 = { de: mais(hoje, 1), ate: mais(hoje, 7), rotulo: 'Próxima semana' }
  const h2 = { de: mais(hoje, 1), ate: mais(hoje, 30), rotulo: 'Próximos 30 dias' }
  ;[h1, h2].forEach((h) => {
    h.dias_uteis = jornada ? diasUteis(h.de, h.ate, jornada, feriados) : null
    h.dias_corridos = (t(h.ate) - t(h.de)) / DIA + 1
  })
  const diasPer = (h) => (jornada ? h.dias_uteis : h.dias_corridos)
  const pendencias = []
  if (!jornada) pendencias.push({ tipo: 'jornada', linha: 'obra', dado: 'horas/dia e dias da semana (obra_jornada)' })

  const porChave = new Map(linhas.map((l) => [chave(l), l]))
  const servicos = linhas.filter((l) => l.entra_evm && Number(l.hh) > 0 && l.grupo_numero <= 16 && !FORA_DO_PAINEL.has(l.cod_eap))
  // vínculos material → serviço: herda_de (valor agregado) e CAIXA_JUNTO (cabeamento), peso pelo orçado dos serviços
  const materiaisDe = {}
  linhas.forEach((m) => {
    const cods = m.herda_de && m.herda_de.length ? m.herda_de : CAIXA_JUNTO[m.cod_eap] || null
    if (!cods || Number(m.hh) > 0) return
    const mesmoPav = !!CAIXA_JUNTO[m.cod_eap] && !(m.herda_de && m.herda_de.length)
    let alvo = servicos.filter((s) => cods.includes(s.cod_eap) && (!mesmoPav || s.pavimento === m.pavimento))
    if (!mesmoPav && alvo.some((s) => s.pavimento === m.pavimento)) alvo = alvo.filter((s) => s.pavimento === m.pavimento)
    const soma = alvo.reduce((s, x) => s + (Number(x.preco_total) || 0), 0)
    if (!alvo.length) return
    const realMat = alvo.reduce((s, x) => s + (soma > 0 ? Number(x.preco_total) / soma : 1 / alvo.length) * (x.perc_real || 0), 0)
    const orc = Number(m.preco_total) || 0
    const comprado = (Number(m.pago) || 0) + (Number(m.a_pagar) || 0)
    const excesso = Math.max(comprado - (orc * realMat) / 100, 0)
    alvo.forEach((s) => {
      const peso = soma > 0 ? Number(s.preco_total) / soma : 1 / alvo.length
      ;(materiaisDe[chave(s)] = materiaisDe[chave(s)] || []).push({ cod_eap: m.cod_eap, pavimento: m.pavimento,
        descricao: m.descricao, orcado: r2(orc * peso), excesso: r2(excesso * peso), comprado: r2(comprado * peso),
        aplicado_pct: r1(realMat) })
    })
  })

  const atividades = []
  servicos.forEach((l) => {
    const k = chave(l)
    const ix = indices[k] || null
    const real = l.perc_real || 0
    if (real >= 100) return
    const jan = janelaDaLinha(l, semanas)
    const pHoje = planejadoNaData(jan, hoje)
    const p1 = planejadoNaData(jan, h1.ate), p2 = planejadoNaData(jan, h2.ate)
    const aguarda = !!(ix && ix.aguarda_medicao)
    const atrasada = !aguarda && real < pHoje - 0.05
    if (!(p2 > pHoje + 1e-6) && !atrasada) return
    const planHojeEf = aguarda ? Math.min(pHoje, real) : pHoje       // aguardando medição: atraso não conta
    // equipe: a informada na tela para a linha ou a padrão do tipo
    const eqLinha = ix && (ix.equipe_oficiais != null || ix.equipe_ajudantes != null)
      ? { oficiais: Number(ix.equipe_oficiais) || 0, ajudantes: Number(ix.equipe_ajudantes) || 0, da_linha: true,
          composicao: `${Number(ix.equipe_oficiais) || 0} ${ix.equipe_funcao || 'oficial'} + ${Number(ix.equipe_ajudantes) || 0} ajudante${Number(ix.equipe_ajudantes) === 1 ? '' : 's'}` }
      : null
    const eqTipo = ix && ix.tipo_equipe && equipes[ix.tipo_equipe] ? equipes[ix.tipo_equipe] : null
    const eq = eqLinha || (eqTipo ? { oficiais: Number(eqTipo.oficiais), ajudantes: Number(eqTipo.ajudantes),
      composicao: eqTipo.composicao, tipo: eqTipo.tipo, nome: eqTipo.nome } : null)
    const regra = ix ? ix.regra : 'indice'
    const indice = ix && ix.hh_por_unidade != null ? Number(ix.hh_por_unidade) : null
    const duracaoDias = ix && ix.duracao_dias != null ? Number(ix.duracao_dias) : null
    const q = Number(l.quantidade) || 0
    const base = horasDaLinha({ regra, quantidade: q, indice, duracaoDias, oficiais: eq ? eq.oficiais : null,
      horasDia: jornada ? jornada.horas_dia : null })
    const linhaTxt = `${l.cod_eap} ${l.pavimento || ''}`.trim()
    if (!ix) pendencias.push({ tipo: 'índice', linha: linhaTxt, dado: 'linha sem cadastro em indice_produtividade' })
    else if (regra === 'duracao' && duracaoDias == null) pendencias.push({ tipo: 'duração', linha: linhaTxt, dado: ix.observacao || 'duração em branco' })
    else if (regra === 'indice' && indice == null) pendencias.push({ tipo: 'índice', linha: linhaTxt, dado: ix.observacao || 'índice em branco' })
    if (!eq) pendencias.push({ tipo: 'equipe', linha: linhaTxt, dado: ix && ix.tipo_equipe ? `equipe "${ix.tipo_equipe}" sem cadastro` : 'linha sem tipo de equipe' })
    const status = atrasada ? 'ATRASADA' : pHoje <= 0 && real <= 0 ? 'A INICIAR' : real > pHoje + 0.05 ? 'ADIANTADA' : 'EM DIA'
    const termino = calcularTermino({ base, real, oficiais: eq ? eq.oficiais : null, equipes: ix ? ix.equipes_definidas : null,
      equipesCronograma: ix ? ix.equipes_cronograma : null, fimCrono: jan ? jan.fim : null, hoje, jornada, feriados })
    // aguardando a medição real (Rafael 13/10): sem "deveria ter começado" nem dias de atraso até a medição
    const ritmo = aguarda && !(real > 0)
      ? { nao_iniciada: true, aguarda_medicao: true, deveria_desde: null, atrasa: 0 }
      : ritmoAtual({ real, medicoes: l.medicoes || [], inicioPlan: jan ? jan.inicio : null, fimCrono: jan ? jan.fim : null,
        hoje, jornada, feriados })
    const orc = Number(l.preco_total) || 0
    const excessoProprio = Math.max((Number(l.pago) || 0) + (Number(l.a_pagar) || 0) - (orc * real) / 100, 0)
    const proprioEhMaterial = /^\s*concreto usinado/i.test(l.descricao || '')
    const mats = materiaisDe[k] || []
    const caixaDe = (h, pFim) => {
      const per = pctNoPeriodo({ real, planHoje: planHojeEf, planFim: pFim, base: termino.base, oficiais: eq ? eq.oficiais : null,
        equipes: equipesDoCaixa(termino), diasPeriodo: diasPer(h), diasMes: diasPer(h2), horasDia: jornada ? jornada.horas_dia : null })
      return { pct: r2(per.pct), detalhe: per, ...caixaAtividade({ pct: per.pct, orcado: orc, excessoProprio, materiais: mats, proprioEhMaterial }) }
    }
    const inicioC = jan ? jan.inicio : null, fimC = jan ? jan.fim : null
    atividades.push({
      chave: k, cod_eap: l.cod_eap, pavimento: l.pavimento, descricao: l.descricao, grupo_num: l.grupo_numero, grupo_nome: l.grupo_nome,
      unidade: String((ix && ix.unidade) || l.unidade || '').trim(), quantidade: q, hh: Number(l.hh), orcado: orc,
      status, atrasada, aguarda_medicao: aguarda, real: r1(real), plan_hoje: r1(pHoje), desvio: r1(real - pHoje),
      plan_fim_semana: r1(p1), plan_fim_mes: r1(p2), inicio_crono: inicioC, fim_crono: fimC,
      // valores sem arredondar para a tela recalcular igual ao servidor (o caixa do site bate ao centavo)
      calc: { real, plan_hoje: planHojeEf, plan_fim_semana: p1, plan_fim_mes: p2 },
      regra, indice, duracao_dias: duracaoDias, indice_origem: ix ? ix.origem : null, hh_cronograma: ix && ix.hh_cronograma != null ? Number(ix.hh_cronograma) : null,
      hh_cpu: ix && ix.hh_cpu != null ? Number(ix.hh_cpu) : null, hh_cpu_oficial: ix && ix.hh_cpu_oficial != null ? Number(ix.hh_cpu_oficial) : null,
      conferir: !!(ix && ix.conferir), observacao: ix ? ix.observacao || null : null, tipo_equipe: ix ? ix.tipo_equipe || null : null,
      equipe: eq, equipes_definidas: ix && ix.equipes_definidas != null ? ix.equipes_definidas : null,
      equipes_cronograma: ix && ix.equipes_cronograma != null ? ix.equipes_cronograma : null,
      editado_por: ix ? ix.editado_por || null : null, editado_em: ix ? ix.editado_em || null : null,
      falta_qtd: r2(((100 - real) / 100) * q), base_horas: termino.base, termino, ritmo,
      excesso_proprio: r2(excessoProprio), proprio_material: proprioEhMaterial, materiais: mats,
      caixa_semana: caixaDe(h1, p1), caixa_mes: caixaDe(h2, p2),
      cronograma_curto: base != null && base > Number(l.hh) * 1.0001
        ? { horas_cronograma: r1(Number(l.hh)), horas_indice: r1(base), excesso_pct: r1((100 * (base - l.hh)) / l.hh) } : null,
      na_semana: atrasada || !!(inicioC && fimC && inicioC <= h1.ate && fimC >= h1.de),
      em_30: atrasada || !!(inicioC && fimC && inicioC <= h2.ate && fimC >= h2.de),
    })
  })
  const ordemSt = { ATRASADA: 0, 'A INICIAR': 1, 'EM DIA': 2, ADIANTADA: 3 }
  atividades.sort((a, b) => ordemSt[a.status] - ordemSt[b.status] || (b.plan_hoje - b.real) - (a.plan_hoje - a.real)
    || String(a.inicio_crono).localeCompare(String(b.inicio_crono)))

  // COMPRAS de prazo longo: a obra toda, pela data PROJETADA (início planejado deslocado pelo adiantamento da obra)
  const adiant = calcularAdiantamento(curva, ultimaMedicao)
  const desloc = adiant ? adiant.dias : 0
  const fimObra = semanas[semanas.length - 1].data_fim
  const compras = prazos.map((p) => {
    const ls = linhas.filter((l) => l.cod_eap === p.cod_eap && (!p.pavimento || l.pavimento === p.pavimento))
    const jans = ls.map((l) => janelaDaLinha(l, semanas)).filter(Boolean).sort((a, b) => a.inicio.localeCompare(b.inicio))
    let planejado = jans.length ? jans[0].inicio : null
    let necessidade = planejado ? mais(planejado, -desloc) : null
    let pedirAte = null
    const meses = p.antecedencia_meses != null ? Number(p.antecedencia_meses) : null
    const dias = p.antecedencia_dias != null ? Number(p.antecedencia_dias) : null
    if (p.regra === 'ultimo_mes') {
      planejado = fimObra.slice(0, 8) + '01'
      necessidade = mais(fimObra, -desloc).slice(0, 8) + '01'
      pedirAte = necessidade
    } else if (necessidade && meses != null) pedirAte = somarMeses(necessidade, -meses)
    else if (necessidade && dias != null) pedirAte = mais(necessidade, -dias)
    const status = !pedirAte ? 'prazo pendente' : pedirAte < h1.de ? 'vencido'
      : pedirAte <= h1.ate ? 'vence na próxima semana' : pedirAte <= h2.ate ? 'vence em 30 dias' : 'no prazo'
    const mesesAte = pedirAte ? Math.round(((t(pedirAte) - t(hoje)) / DIA / 30.44) * 10) / 10 : null
    if (!pedirAte) pendencias.push({ tipo: 'prazo de compra', linha: p.cod_eap, dado: 'antecedência em branco' })
    return { cod_eap: p.cod_eap, pavimento: p.pavimento || null, categoria: p.categoria, regra: p.regra,
      antecedencia_dias: dias, antecedencia_meses: meses, observacao: p.observacao || null,
      descricao: ls.length ? ls[0].descricao : '', planejado, necessidade, pedir_ate: pedirAte, status, meses_ate: mesesAte }
  }).sort((a, b) => String(a.pedir_ate || '9999').localeCompare(String(b.pedir_ate || '9999')))

  // CAIXA além das atividades
  const curvaSemanal = curva.map((c, i) => ({ ...c, valor: (Number(c.financeiro_planejado) || 0) - (i > 0 ? Number(curva[i - 1].financeiro_planejado) || 0 : 0) }))
  const desembolso = (h) => r2(curvaSemanal.reduce((s, c) => s + rateioDias(c.valor, c.data_inicio, c.data_fim, h.de, h.ate), 0))
  const contasNo = (h) => contas.map((c) => ({ ...c, venc: String(c.data_previsao || c.data_vencimento || '').slice(0, 10) }))
    .filter((c) => c.venc && c.venc >= h.de && c.venc <= h.ate)
    .map((c) => ({ fornecedor: c.fornecedor || '', codigo_eap: c.codigo_eap || null, vencimento: c.venc,
      documento: c.num_documento || '', natureza: c.natureza || null, classe: c.classe || null, valor: r2(Number(c.valor) || 0) }))
  const recorrentesNo = (h) => linhas.filter(ehRecorrenteDireto).map((l) => {
    const jan = janelaDaLinha(l, semanas)
    const v = jan ? rateioDias(Number(l.preco_total) || 0, jan.inicio, jan.fim, h.de, h.ate) : 0
    return { codigo_eap: l.cod_eap, descricao: l.descricao, tipo: 'recorrente direto', valor: r2(v) }
  }).filter((x) => x.valor > 0.005)
  const obraIni = semanas[0].data_inicio
  const indiretosNo = (h) => indiretos.map((i) => {
    const m = parseInt(i.mes_desembolso, 10)
    let ini, fim
    if (m === 0) { ini = obraIni; fim = fimObra } else {
      const doMes = semanas.filter((s) => s.mes === m)
      if (!doMes.length) return null
      ini = doMes[0].data_inicio; fim = doMes[doMes.length - 1].data_fim
    }
    return { codigo_eap: i.cod_eap, categoria: i.categoria, tipo: m === 0 ? 'indireto recorrente' : 'indireto pontual',
      valor: r2(rateioDias(Number(i.valor_total) || 0, ini, fim, h.de, h.ate)) }
  }).filter((x) => x && x.valor > 0.005)
  const caixaPeriodo = (h, campo, flag) => {
    const xs = atividades.filter((a) => a[flag])
    const grupos = {}
    xs.forEach((a) => {
      const g = (grupos[a.grupo_num] = grupos[a.grupo_num] || { grupo: a.grupo_num, nome: a.grupo_nome, mo: 0, material: 0, total: 0, atividades: 0 })
      g.mo += a[campo].mo; g.material += a[campo].material; g.total += a[campo].total; g.atividades += 1
    })
    const lista = Object.values(grupos).map((g) => ({ ...g, mo: r2(g.mo), material: r2(g.material), total: r2(g.total) }))
      .sort((a, b) => a.grupo - b.grupo)
    const cts = contasNo(h), rec = recorrentesNo(h), ind = indiretosNo(h)
    const soma = (arr) => r2(arr.reduce((s, x) => s + x.valor, 0))
    const mo = r2(lista.reduce((s, g) => s + g.mo, 0)), material = r2(lista.reduce((s, g) => s + g.material, 0))
    const tot = {
      mo, material, atividades: r2(mo + material), contas: soma(cts), recorrentes_diretos: soma(rec),
      indiretos_recorrentes: soma(ind.filter((i) => i.tipo === 'indireto recorrente')),
      indiretos_pontuais: soma(ind.filter((i) => i.tipo === 'indireto pontual')),
    }
    tot.total = r2(tot.atividades + tot.contas + tot.recorrentes_diretos + tot.indiretos_recorrentes + tot.indiretos_pontuais)
    return { de: h.de, ate: h.ate, dias_uteis: h.dias_uteis, grupos: lista, contas: cts, recorrentes: rec, indiretos: ind,
      totais: tot, curva: desembolso(h) }
  }

  const unicas = (ls) => Object.values(Object.fromEntries(ls.map((p) => [`${p.tipo}|${p.linha}|${p.dado}`, p])))
  const vencidas = compras.filter((c) => c.status === 'vencido')
  const proxima = compras.find((c) => c.pedir_ate && c.status !== 'vencido')
  return {
    semana: sem.semana, hoje, jornada, feriados, configurado, premissa: PREMISSA, adiantamento: adiant,
    periodos: { semana: { de: h1.de, ate: h1.ate, dias_uteis: h1.dias_uteis, dias_corridos: h1.dias_corridos },
      mes: { de: h2.de, ate: h2.ate, dias_uteis: h2.dias_uteis, dias_corridos: h2.dias_corridos } },
    topo: {
      atrasadas: atividades.filter((a) => a.atrasada).length,
      semana: atividades.filter((a) => a.na_semana).length,
      mes: atividades.filter((a) => a.em_30).length,
      equipes: atividades.filter((a) => a.em_30).reduce((s, a) => s + (a.termino.usadas || 0), 0),
    },
    caixa: { semana: caixaPeriodo(h1, 'caixa_semana', 'na_semana'), mes: caixaPeriodo(h2, 'caixa_mes', 'em_30') },
    atividades, compras,
    alerta_compras: { vencidas: vencidas.length, proxima: proxima ? { cod_eap: proxima.cod_eap, categoria: proxima.categoria,
      pedir_ate: proxima.pedir_ate, meses_ate: proxima.meses_ate } : null },
    pendencias: unicas(pendencias),
  }
}
