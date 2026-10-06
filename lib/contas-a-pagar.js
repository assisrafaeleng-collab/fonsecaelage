// Contas a pagar do mes seguinte ao fechamento (tabela contas_a_pagar,
// gravada pelo importar.js --contas-classificador). NAO e custo realizado.
//
// Classe pela EAP: 19.x = indireto, o resto = direto, sem EAP = pendente.
// Natureza: 'nf' (titulo com nota) ou 'previsto_sem_nf' ("Prev. Financ.").
// O IPC soma as linhas de classe 'direto', com NF e previstas.

export const TABELA_CONTAS = 'contas_a_pagar' // mesmo nome no importar.js

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100

// Le a foto do fechamento pedido (ou do mais recente). Sem a tabela no banco
// (SQL ainda nao rodado) volta disponivel = false em vez de erro: o resto do
// dashboard continua, com o a pagar zerado e um aviso.
export async function carregarContasAPagar(supabase, obra_id, fechamento = null) {
  let alvo = fechamento
  if (!alvo) {
    const ult = await supabase
      .from(TABELA_CONTAS)
      .select('competencia_fechamento')
      .eq('obra_id', obra_id)
      .order('competencia_fechamento', { ascending: false })
      .limit(1)
    if (ult.error) {
      if (/does not exist|could not find the table|schema cache/i.test(ult.error.message))
        return { disponivel: false, motivo: 'tabela contas_a_pagar ainda não criada no banco', linhas: [] }
      throw new Error(`${TABELA_CONTAS}: ${ult.error.message}`)
    }
    if (!ult.data || !ult.data.length) return { disponivel: false, motivo: 'nenhuma carga de contas a pagar', linhas: [] }
    alvo = ult.data[0].competencia_fechamento
  }
  const linhas = []
  for (let de = 0; ; de += 1000) {
    const r = await supabase
      .from(TABELA_CONTAS)
      .select('*')
      .eq('obra_id', obra_id)
      .eq('competencia_fechamento', alvo)
      .order('fornecedor')
      .range(de, de + 999)
    if (r.error) throw new Error(`${TABELA_CONTAS}: ${r.error.message}`)
    linhas.push(...r.data)
    if (r.data.length < 1000) break
  }
  return { disponivel: true, fechamento: alvo, linhas }
}

// Meses de fechamento com contas a pagar carregado, em ordem ('AAAA-MM').
export async function listarFechamentos(supabase, obra_id) {
  const r = await supabase.from(TABELA_CONTAS).select('competencia_fechamento').eq('obra_id', obra_id).limit(10000)
  if (r.error) throw new Error(`${TABELA_CONTAS}: ${r.error.message}`)
  return Array.from(new Set((r.data || []).map((x) => x.competencia_fechamento).filter(Boolean))).sort()
}

// Totais do card, a pagar por EAP (para o IPC) e um registro por titulo.
export function resumirContas(linhas) {
  const tot = { direto: 0, indireto: 0, previsto_sem_nf: 0, pendente: 0, total: 0, ipc_direto: 0, a_pagar_indireto: 0, previsto_direto: 0, previsto_indireto: 0 }
  const porEapDireto = {}
  const porMes = {}
  const titulos = new Map()
  linhas.forEach((l) => {
    const v = Number(l.valor) || 0
    tot.total += v
    if (l.classe === 'pendente') tot.pendente += v
    else if (l.natureza === 'previsto_sem_nf') tot.previsto_sem_nf += v
    else tot[l.classe] += v
    if (l.classe === 'direto') {
      tot.ipc_direto += v
      porEapDireto[l.codigo_eap] = (porEapDireto[l.codigo_eap] || 0) + v
    }
    if (l.classe === 'indireto') tot.a_pagar_indireto += v
    if (l.natureza === 'previsto_sem_nf' && l.classe === 'direto') tot.previsto_direto += v
    if (l.natureza === 'previsto_sem_nf' && l.classe === 'indireto') tot.previsto_indireto += v
    const mes = l.competencia_vencimento || String(l.data_previsao || l.data_vencimento || '').slice(0, 7)
    if (!porMes[mes]) porMes[mes] = { mes, direto: 0, indireto: 0, previsto_sem_nf: 0, pendente: 0, total: 0, ipc_direto: 0 }
    const pm = porMes[mes]
    pm.total += v
    if (l.classe === 'direto') pm.ipc_direto += v
    if (l.classe === 'pendente') pm.pendente += v
    else if (l.natureza === 'previsto_sem_nf') pm.previsto_sem_nf += v
    else pm[l.classe] += v

    const k = `${l.cnpj || ''}|${l.num_documento}`
    if (!titulos.has(k))
      titulos.set(k, {
        chave: k,
        fornecedor: l.fornecedor,
        num_documento: l.num_documento,
        historico: l.historico,
        data_vencimento: l.data_previsao || l.data_vencimento,
        competencia_vencimento: mes,
        // Parcela: o numero depois da barra no documento (99222/03 -> 03)
        parcela: String(l.num_documento || '').includes('/') ? String(l.num_documento).split('/').pop() : null,
        natureza: l.natureza,
        valor: 0,
        eaps: [],
        alertas: l.alertas || [],
      })
    const t = titulos.get(k)
    t.valor += v
    const e = t.eaps.find((x) => x.codigo_eap === (l.codigo_eap || null))
    if (e) e.valor += v
    else t.eaps.push({ codigo_eap: l.codigo_eap || null, classe: l.classe, valor: v })
  })
  Object.keys(tot).forEach((k) => (tot[k] = r2(tot[k])))
  Object.keys(porEapDireto).forEach((k) => (porEapDireto[k] = r2(porEapDireto[k])))
  const lista = Array.from(titulos.values())
    .map((t) => ({ ...t, valor: r2(t.valor), eaps: t.eaps.map((e) => ({ ...e, valor: r2(e.valor) })) }))
    .sort((a, b) => String(a.data_vencimento || '').localeCompare(String(b.data_vencimento || '')) || b.valor - a.valor)
  const meses = Object.values(porMes)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m) => ({ ...m, direto: r2(m.direto), indireto: r2(m.indireto), previsto_sem_nf: r2(m.previsto_sem_nf), pendente: r2(m.pendente), total: r2(m.total), ipc_direto: r2(m.ipc_direto) }))
  return {
    totais: tot,
    por_mes: meses,
    por_eap_direto: porEapDireto,
    titulos: lista,
    n_titulos: lista.length,
    n_alertas: lista.filter((t) => t.alertas.length).length,
  }
}
