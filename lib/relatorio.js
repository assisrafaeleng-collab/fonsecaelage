// Relatório gerencial por período (decisão de 16/10/2026; mesmo do Sirius 60, adaptado). Conta pura: não acessa o
// banco e não cria número novo — organiza o que as rotas do site já devolvem para pages/relatorio.js:
//   /api/dashboard-semanal?semana=S&memoria=1  curva, cards, grupos, indiretos, avanço por linha, a pagar da semana
//   /api/pontos-atencao?semana=S              situação das atividades, janela projetada, caixa de 30 dias, adiantamento
//   /api/contas-a-pagar?fechamento=AAAA-MM     títulos a pagar da carga usada na semana
// Período → semanas do calendário da obra: semana inicial = a da data inicial (antes da S01, desde a S01); semana final
// = a da data final. "Até a data final" = fim da semana final. "No período" = fim da semana final − fim da semana
// anterior à inicial. Contas combinadas com o Rafael em 16/10/2026:
//   - a pagar dinâmico: cada semana usa a carga do próprio mês (lib/painel-semanal.js);
//   - custo final = custo de hoje (pago + a pagar) + o que falta do direto pelo orçado + indireto pelo orçamento +
//     custo fixo recorrente da semana (kpis.projecao.custo_calendario_semana) × semanas de atraso (− adiantamento);
//   - dias de atraso da atividade = (previsto − feito) × dias da janela do cronograma (a reta do planejado do site).

const num = (v) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
export const r2 = (v) => Math.round(num(v) * 100) / 100
const iso = (s) => (s ? String(s).slice(0, 10) : '')
const diaDe = (s) => Date.parse(iso(s) + 'T12:00:00Z') / 864e5
export const diasEntre = (a, b) => Math.round(diaDe(b) - diaDe(a)) // b − a, em dias
export const addDias = (s, n) => {
  const [y, m, d] = iso(s).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

// Semáforo. Faixas (escritas na página): rendimento do custo ≥ 1,00 verde, 0,95–1,00 amarelo, < 0,95 vermelho;
// prazo: em dia/adiantada verde, atraso até 2 semanas amarelo; indireto e projeção: estouro até 5% amarelo;
// atividade: atraso até 7 dias amarelo.
export const corRendimento = (x) => (x == null ? 'cinza' : x >= 1 ? 'verde' : x >= 0.95 ? 'amarelo' : 'vermelho')
export const corPrazo = (semanas) => (semanas == null ? 'cinza' : semanas >= -0.05 ? 'verde' : semanas >= -2 ? 'amarelo' : 'vermelho')
export const corSaldoPct = (pct) => (pct == null ? 'cinza' : pct >= 0 ? 'verde' : pct >= -5 ? 'amarelo' : 'vermelho')
export const corAtraso = (dias) => (dias == null ? 'cinza' : dias <= 0 ? 'verde' : dias <= 7 ? 'amarelo' : 'vermelho')

// curva: dados.curva da semanal (semana, data_inicio, data_fim)
export function periodoEmSemanas(de, ate, curva) {
  const cs = curva || []
  if (!cs.length) return null
  const ini1 = iso(cs[0].data_inicio)
  const fimObra = iso(cs[cs.length - 1].data_fim)
  if (ate < ini1) return null
  const semanaDe = (d) => (cs.find((c) => iso(c.data_inicio) <= d && d <= iso(c.data_fim)) || {}).semana
  const sFim = ate > fimObra ? cs[cs.length - 1].semana : semanaDe(ate)
  const sIni = de < ini1 ? cs[0].semana : semanaDe(de)
  if (!sFim || !sIni || sIni > sFim) return null
  const w = (s) => cs.find((c) => c.semana === s)
  const fimReal = iso(w(sFim).data_fim)
  const iniReal = iso(w(sIni).data_inicio)
  return { de, ate, sIni, sFim, sAntes: sIni - 1, iniReal, fimReal, inicioObra: ini1, fimObra,
    ajusteFim: fimReal !== ate, ajusteIni: iniReal !== de && de >= ini1 }
}

const agregadoDe = (c) => (c && c.bcwp_a_custo != null ? num(c.bcwp_a_custo) + num(c.bcwp_b) + num(c.bcwp_c) : 0)
const ponto = (painel, s) => (painel ? painel.curva.find((c) => c.semana === s) : null)

// Última medição até a semana do painel (as medições do avanço por linha já vêm cortadas na semana)
export function ultimaMedicao(painel) {
  let s = 0
  let data = null
  ;(painel.avanco_grupos || []).forEach((g) =>
    (g.itens || []).forEach((i) =>
      (i.retratos || []).forEach((r) => {
        if (r.semana > s || (r.semana === s && r.data && (!data || r.data > data))) {
          s = r.semana
          data = r.data || data
        }
      })
    )
  )
  return s ? { semana: s, data } : null
}

// a) custo direto: o mesmo dos cards (valor do que foi feito × pago + a pagar), acumulado e no período
export function custoDireto(pFim, pAntes, per) {
  const f = ponto(pFim, per.sFim)
  const a = per.sAntes >= 1 ? ponto(pFim, per.sAntes) : null
  const apFim = num(pFim.contas_a_pagar && pFim.contas_a_pagar.direto)
  const apIni = pAntes ? num(pAntes.contas_a_pagar && pAntes.contas_a_pagar.direto) : 0
  const feito = agregadoDe(f)
  const pago = num(f.acwp)
  const custo = pago + apFim
  const previsto = num(f.bcws)
  const feitoIni = agregadoDe(a)
  const pagoIni = a ? num(a.acwp) : 0
  const previstoIni = a ? num(a.bcws) : 0
  return {
    feito: r2(feito), pago: r2(pago), a_pagar: r2(apFim), custo: r2(custo), previsto: r2(previsto),
    saldo: r2(feito - custo), rendimento: feito > 0.005 && custo > 0.005 ? feito / custo : null,
    periodo: {
      previsto: r2(previsto - previstoIni), feito: r2(feito - feitoIni), pago: r2(pago - pagoIni),
      a_pagar_ini: r2(apIni), a_pagar_fim: r2(apFim),
      custo: r2(pago - pagoIni + apFim - apIni), saldo: r2(feito - feitoIni - (pago - pagoIni + apFim - apIni)),
    },
    fechamento: pFim.contas_a_pagar && pFim.contas_a_pagar.fechamento,
  }
}

// Indireto: previsto até a data × pago + a pagar. Diferença separada (Sirius, pedido 18): a pagar previsto (pontuais
// previstos ainda não pagos), sem lançamento (recorrentes sem nenhum lançamento) e economia real (o resto).
export function custoIndireto(pFim, per) {
  const f = ponto(pFim, per.sFim)
  const plan = num(f.indireto_planejado)
  const pago = num(f.indireto_realizado)
  const ap = num(pFim.contas_a_pagar && pFim.contas_a_pagar.indireto)
  const cats = pFim.indiretos || []
  const rec = (c) => parseInt(c.mes_desembolso, 10) === 0
  const naoPago = cats.filter((c) => !rec(c) && num(c.planejado) > 0.005 && num(c.realizado) < num(c.planejado) - 0.005)
  const semLanc = cats.filter((c) => rec(c) && num(c.planejado) > 0.005 && num(c.realizado) < 0.005)
  const aPagarPrev = naoPago.reduce((t, c) => t + num(c.planejado) - num(c.realizado), 0)
  const semLancV = semLanc.reduce((t, c) => t + num(c.planejado), 0)
  const saldo = plan - pago - ap
  const economiaReal = saldo - aPagarPrev - semLancV
  return { plan: r2(plan), pago: r2(pago), a_pagar: r2(ap), custo: r2(pago + ap), saldo: r2(saldo),
    pct: plan > 0 ? (100 * saldo) / plan : null, naoPago, semLanc, a_pagar_previsto: r2(aPagarPrev),
    sem_lancamento: r2(semLancV), economia_real: r2(economiaReal), pendencias: semLanc.length }
}

// b) prazo: adiantamento do painel Pontos de atenção (mesma conta do card "Adiantamento"), na última medição
export function prazo(pFim, pa, med) {
  const adi = pa && pa.adiantamento ? pa.adiantamento : null
  const pm = med ? ponto(pFim, med.semana) : null
  const fim = iso(pFim.curva[pFim.curva.length - 1].data_fim)
  const termino = adi && adi.dias != null ? addDias(fim, -adi.dias) : null
  return { semanas: adi ? adi.semanas : null, dias: adi ? adi.dias : null, fimCronograma: fim, termino,
    plan: pm ? num(pm.avanco_plan_hh) : null, real: pm ? num(pm.avanco_real_hh) : null }
}

// d) custo final (Rafael 16/10): custo de hoje + o que falta do direto pelo orçado + indireto pelo orçamento +
// custo fixo recorrente da semana × semanas de atraso (adiantamento reduz)
export function custoFinal(pFim, dir, adi) {
  const orcDireto = num(pFim.totais.custo_direto)
  const orcIndireto = num(pFim.totais.indireto)
  const orcTotal = num(pFim.totais.obra)
  const falta = Math.max(orcDireto - dir.feito, 0)
  const porSemana = num(pFim.kpis.projecao && pFim.kpis.projecao.custo_calendario_semana)
  const semanasAtraso = adi.semanas == null ? 0 : -adi.semanas
  const ajustePrazo = porSemana * semanasAtraso
  const direto = dir.custo + falta
  const total = direto + orcIndireto + ajustePrazo
  return { orcDireto: r2(orcDireto), orcIndireto: r2(orcIndireto), orcTotal: r2(orcTotal), falta: r2(falta),
    direto: r2(direto), porSemana: r2(porSemana), semanasAtraso, ajustePrazo: r2(ajustePrazo), total: r2(total),
    saldo: r2(orcTotal - total), pct: orcTotal > 0 ? (100 * (orcTotal - total)) / orcTotal : null }
}

// Situação de uma atividade (Pontos de atenção) com os dias: (previsto − feito) × dias da janela do cronograma
export function situacao(a) {
  if (!a) return null
  const dur = a.inicio_crono && a.fim_crono ? Math.max(diasEntre(a.inicio_crono, a.fim_crono) + 1, 1) : null
  const dias = dur == null ? null : Math.round(((num(a.plan_hoje) - num(a.real)) / 100) * dur)
  const n = (x) => (Math.abs(x) <= 1 ? '1 dia' : `${Math.abs(x)} dias`)
  if (num(a.real) >= 99.95) return { texto: 'concluída', cor: 'verde', dias: 0 }
  if (a.aguarda_medicao) return { texto: 'aguardando a medição real', cor: 'cinza', dias: null }
  if (a.status === 'ATRASADA') return { texto: dias != null ? `atrasada ${n(Math.max(dias, 1))}` : 'atrasada', cor: corAtraso(Math.max(dias || 1, 1)), dias: Math.max(dias || 1, 1) }
  if (a.status === 'ADIANTADA') return { texto: dias != null ? `adiantada ${n(Math.max(-dias, 1))}` : 'adiantada', cor: 'verde', dias }
  if (a.status === 'A INICIAR') return { texto: 'a iniciar', cor: 'cinza', dias: 0 }
  return { texto: 'em dia', cor: 'verde', dias: 0 }
}

// Físico do período por linha: previsto e feito NO período (fim − início) e acumulado, com a situação
export function fisicoDoPeriodo(pFim, pAntes, pa, semMedicao) {
  const antes = new Map()
  ;((pAntes && pAntes.avanco_grupos) || []).forEach((g) => (g.itens || []).forEach((i) => antes.set(i.chave, i)))
  const ativ = new Map(((pa && pa.atividades) || []).map((a) => [a.chave, a]))
  const ativPorCodigo = new Map(((pa && pa.atividades) || []).map((a) => [a.cod_eap, a]))
  const linhas = []
  ;(pFim.avanco_grupos || []).forEach((g) =>
    (g.itens || []).forEach((i) => {
      const a = antes.get(i.chave) || {}
      const prevP = num(i.perc_planejado) - num(a.perc_planejado)
      const feitoP = num(i.perc_realizado) - num(a.perc_realizado)
      if (prevP <= 0.05 && Math.abs(feitoP) <= 0.05) return
      const at = ativ.get(i.chave) || ativ.get(`${i.cod_eap}|${i.pavimento || ''}`) || ativPorCodigo.get(i.cod_eap)
      // linha fora do painel Pontos de atenção (concluída ou fora dos grupos 1–16): a mesma regra, feito × previsto, sem os dias
      const sit = situacao(at) || (num(i.perc_realizado) >= 99.95 ? { texto: 'concluída', cor: 'verde', dias: 0 }
        : num(i.perc_realizado) < num(i.perc_planejado) - 0.05 ? { texto: 'atrasada', cor: 'amarelo', dias: null }
        : num(i.perc_realizado) > num(i.perc_planejado) + 0.05 ? { texto: 'adiantada', cor: 'verde', dias: null }
        : { texto: 'em dia', cor: 'verde', dias: 0 })
      linhas.push({ ...i, grupo: g.grupo, grupo_nome: g.nome, prev_periodo: prevP, feito_periodo: feitoP,
        hh_prev: (num(i.hh) * prevP) / 100, hh_feito: (num(i.hh) * feitoP) / 100,
        situacao: semMedicao ? { texto: 'sem medição no período', cor: 'cinza', dias: null, base: sit } : sit })
    })
  )
  const grupos = new Map()
  linhas.forEach((l) => {
    if (!grupos.has(l.grupo)) grupos.set(l.grupo, { grupo: l.grupo, nome: l.grupo_nome, itens: [], hh_prev: 0, hh_feito: 0 })
    const g = grupos.get(l.grupo)
    g.itens.push(l)
    g.hh_prev += l.hh_prev
    g.hh_feito += l.hh_feito
  })
  const atrasadas = linhas.filter((l) => l.situacao.cor === 'amarelo' || l.situacao.cor === 'vermelho')
    .sort((a, b) => (b.situacao.dias || 0) - (a.situacao.dias || 0))
  return { linhas, grupos: [...grupos.values()].sort((a, b) => a.grupo - b.grupo), atrasadas,
    emDia: linhas.filter((l) => l.situacao.cor === 'verde').length }
}

// Financeiro por grupo: acumulado (principal) e período, pago e a pagar separados
export function financeiroPorGrupo(pFim, pAntes) {
  const antes = new Map(((pAntes && pAntes.grupos) || []).map((g) => [g.grupo, g]))
  const grupos = (pFim.grupos || []).map((g) => {
    const a = antes.get(g.grupo) || {}
    const custo = num(g.pago) + num(g.a_pagar)
    const custoIni = num(a.pago) + num(a.a_pagar)
    return { grupo: g.grupo, nome: g.nome, orcado: r2(g.orcado), feito: r2(g.agregado), pago: r2(g.pago), a_pagar: r2(g.a_pagar),
      custo: r2(custo), saldo: r2(num(g.agregado) - custo),
      feito_p: r2(num(g.agregado) - num(a.agregado)), pago_p: r2(num(g.pago) - num(a.pago)), custo_p: r2(custo - custoIni),
      saldo_p: r2(num(g.agregado) - num(a.agregado) - (custo - custoIni)),
      tem: Math.abs(num(g.agregado)) > 0.005 || custo > 0.005, itens: g.itens || [] }
  })
  const linhas = []
  grupos.forEach((g) => g.itens.forEach((i) => {
    const custo = num(i.pago) + num(i.a_pagar)
    linhas.push({ ...i, grupo: g.grupo, custo: r2(custo), saldo: r2(num(i.agregado) - custo) })
  }))
  const mov = linhas.filter((l) => Math.abs(l.saldo) > 0.5)
  return { grupos, economias: mov.filter((l) => l.saldo > 0).sort((a, b) => b.saldo - a.saldo).slice(0, 5),
    estouros: mov.filter((l) => l.saldo < 0).sort((a, b) => a.saldo - b.saldo).slice(0, 5), linhas }
}

// Custo que pode estourar (regra do relatório, escrita na página): linha de serviço em que o custo (pago + a pagar)
// já passou do valor do que foi feito, ou que já consumiu do orçado 10 p.p. a mais do que executou
export function riscoDeEstouro(fin) {
  return fin.linhas.filter((l) => !l.locacao && num(l.planejado_total) > 0 && l.custo > 0.005)
    .map((l) => {
      const usado = (100 * l.custo) / num(l.planejado_total)
      return { ...l, usado, exec: num(l.perc_executado) }
    })
    .filter((l) => l.saldo < -0.5 || l.usado > l.exec + 10)
    .sort((a, b) => a.saldo - b.saldo)
}

// c) caixa dos 30 dias: a MESMA soma do painel Pontos de atenção (caixa.mes)
export function caixa30(pa) {
  const m = pa.caixa.mes
  const t = m.totais
  const tit = new Map()
  ;(m.contas || []).forEach((c) => {
    const k = `${c.fornecedor}|${c.documento}`
    if (!tit.has(k)) tit.set(k, { chave: k, fornecedor: c.fornecedor || '—', documento: c.documento || '—', vencimento: c.vencimento, valor: 0, classe: c.classe })
    tit.get(k).valor += num(c.valor)
  })
  return { de: m.de, ate: m.ate, grupos: (m.grupos || []).filter((g) => num(g.total) > 0.005).sort((a, b) => b.total - a.total),
    servicos: r2(t.atividades), contas: r2(t.contas), recorrentes: r2(t.recorrentes_diretos),
    indiretos: r2(num(t.indiretos_recorrentes) + num(t.indiretos_pontuais)), total: r2(t.total), curva: r2(m.curva),
    titulos: [...tit.values()].map((x) => ({ ...x, valor: r2(x.valor) })).sort((a, b) => iso(a.vencimento).localeCompare(iso(b.vencimento))) }
}

// Produtividade baixa (Pontos de atenção): pelo ritmo/equipes a atividade termina depois do fim do cronograma
// (projetado), ou o cronograma tem menos horas que a produtividade real pede
export function produtividadeBaixa(pa) {
  return (pa.atividades || []).filter((a) => (a.em_30 || a.atrasada) && num(a.real) < 99.95 &&
    ((a.termino && a.termino.termino && a.termino.cumpre === false) || a.cronograma_curto))
}

export const dmy = (s) => (s ? `${iso(s).slice(8, 10)}/${iso(s).slice(5, 7)}/${iso(s).slice(0, 4)}` : '—')
export const dm = (s) => (s ? `${iso(s).slice(8, 10)}/${iso(s).slice(5, 7)}` : '—')
