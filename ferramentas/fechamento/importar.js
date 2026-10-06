// ferramentas/fechamento/importar.js
//
// Segunda etapa: grava no Supabase o fechamento ja conferido.
// Sem --confirmar so mostra a previa; nada e gravado.
//
// Custos do mes (aba "Lançamentos"):
//   node ferramentas/fechamento/importar.js --custos "C:\Obras\FlatsPampulha\saida\2026-09\fechamento_2026-09.xlsx" --competencia 2026-09
//   ... --confirmar --pasta "C:\Obras\FlatsPampulha"
//      substitui a competencia inteira (insere as novas e so depois apaga as
//      antigas: rodar duas vezes nao duplica) e grava as decisoes na memoria.
//
// Contas a pagar (aba "Contas a pagar"):
//   node ferramentas/fechamento/importar.js --contas "...\fechamento_2026-09.xlsx" --data 2026-09-30 [--confirmar]
//      substitui a foto do contas a pagar daquela data.
//
// Contas a pagar do classificador (automacao/contas_a_pagar.csv, gerado pelo
// contas_a_pagar.py): card separado do custo, nao entra em custos_lancamentos.
//   node ferramentas/fechamento/importar.js --contas-classificador automacao/contas_a_pagar.csv [--confirmar]
//      previa com totais (direto / indireto / previsto sem NF / pendente),
//      alertas e pendencias; substitui a foto inteira do fechamento. Titulo
//      sem EAP so grava com --aceitar-pendencias (fica fora do IPC).
//
// Saida do classificador (automacao/lancamentos.csv):
//   node ferramentas/fechamento/importar.js --classificador automacao/lancamentos.csv [--confirmar]
//      a competencia vem das datas do arquivo (Data de Baixa); substitui a
//      competencia inteira e registra a carga em "importacoes", com copia das
//      linhas substituidas. Recusa 2026-07 e anteriores (historico manual).
//      Se algum documento do banco sairia (nao esta no arquivo), so grava
//      com --aceitar-saidas. Documento novo com mesmo fornecedor e valor de
//      uma linha de outro mes (possivel duplicidade) so grava com
//      --aceitar-duplicidade.
//   node ferramentas/fechamento/importar.js --desfazer <id da importacao> [--confirmar]
//      apaga as linhas daquela carga e devolve as que ela substituiu.
//
// Precisa no .env.local do repositorio (nunca no GitHub):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (aceita tambem o nome antigo SUPABASE_SERVICE_ROLE_KEY)
'use strict'
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

const OBRA = 'flats_pampulha'
const args = process.argv.slice(2)
const arg = (n) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null
}
const CONFIRMAR = args.includes('--confirmar')
const ARQ_CUSTOS = arg('--custos')
const ARQ_CONTAS = arg('--contas')
const COMPETENCIA = arg('--competencia')
const DATA_REF = arg('--data')
const PASTA = arg('--pasta')
const ARQ_CLASSIF = arg('--classificador')
const DESFAZER = arg('--desfazer')
const ACEITAR_SAIDAS = args.includes('--aceitar-saidas')
const ACEITAR_DUPLICIDADE = args.includes('--aceitar-duplicidade')
const ARQ_CONTAS_CLASSIF = arg('--contas-classificador')
const ACEITAR_PENDENCIAS = args.includes('--aceitar-pendencias')
// --exportar ARQUIVO.xlsx: grava (so no disco) a lista do custo direto a pagar
// por entrega, para conferencia. Nao mexe no banco.
const ARQ_EXPORTAR = arg('--exportar')
// Tabela do contas a pagar por titulo (supabase/contas/1-contas-a-pagar.sql).
// Mesmo nome em lib/contas-a-pagar.js. (Conferido em out/26: a tabela nao
// existia no banco; o modo antigo --contas, que gravaria nela com outro
// formato, foi desativado.)
const TABELA_CONTAS = 'contas_a_pagar'
// Ate esta competencia o banco tem historico lancado a mao (fev-jun dentro de
// 2026-07): substituir a competencia inteira apagaria esse historico.
const ULTIMA_COMPETENCIA_MANUAL = '2026-07'

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r2 = (v) => Math.round(v * 100) / 100
const num = (v) => {
  if (typeof v === 'number') return v
  const t = String(v == null ? '' : v).replace(/[R$\s]/g, '')
  const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t)
  return Number.isFinite(n) ? n : NaN
}
const iso = (v) => {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10)
  const s = String(v)
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}
const txt = (v) => (v == null ? '' : String(v).trim())

function lerEnv() {
  const f = path.join(__dirname, '..', '..', '.env.local')
  const env = {}
  if (fs.existsSync(f))
    fs.readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .forEach((l) => {
        const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      })
  return { ...env, ...process.env }
}

function lerAba(arquivo, nomeAba, colunas) {
  const wb = XLSX.readFile(arquivo, { cellDates: true })
  const nome = wb.SheetNames.find((n) => n.toLowerCase() === nomeAba.toLowerCase())
  if (!nome) throw new Error(`${path.basename(arquivo)}: não tem a aba "${nomeAba}"`)
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: null, raw: true })
  for (let i = 0; i < Math.min(15, linhas.length); i++) {
    const cab = (linhas[i] || []).map(txt)
    if (colunas.every((c) => cab.includes(c)))
      return linhas
        .slice(i + 1)
        .map((l, k) => ({ __linha: i + k + 2, ...Object.fromEntries(cab.map((c, j) => [c, l[j]])) }))
        .filter((l) => colunas.some((c) => txt(l[c])))
  }
  throw new Error(`aba "${nomeAba}": cabeçalho com ${colunas.join(', ')} não encontrado`)
}

async function todos(q) {
  const out = []
  for (let de = 0; ; de += 1000) {
    const r = await q().range(de, de + 999)
    if (r.error) throw new Error(r.error.message)
    out.push(...r.data)
    if (r.data.length < 1000) return out
  }
}

async function main() {
  if (!ARQ_CUSTOS && !ARQ_CONTAS && !ARQ_CLASSIF && !ARQ_CONTAS_CLASSIF && !DESFAZER) {
    console.error('Uso: --custos ARQUIVO --competencia AAAA-MM  |  --contas ARQUIVO --data AAAA-MM-DD  |  --classificador lancamentos.csv  |  --contas-classificador contas_a_pagar.csv  |  --desfazer ID  [--confirmar]')
    process.exit(1)
  }
  const env = lerEnv()
  const chave = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !chave)
    throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SECRET_KEY no .env.local')
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, chave, { auth: { persistSession: false } })

  // Codigos validos: orcamento (direto) + indireto planejado.
  const orc = await todos(() => db.from('orcamento_planejado').select('cod_eap, pavimento').eq('obra_id', OBRA))
  const ind = await todos(() => db.from('custos_indiretos_planejados').select('cod_eap').eq('obra_id', OBRA))
  const validos = new Set([...orc.map((o) => o.cod_eap), ...ind.map((o) => o.cod_eap)])
  const pavimento = {}
  orc.forEach((o) => {
    if (!pavimento[o.cod_eap]) pavimento[o.cod_eap] = o.pavimento || 'Edifício'
  })

  if (ARQ_CUSTOS) await custos(db, validos, pavimento)
  if (ARQ_CONTAS) await contas(db, validos)
  if (ARQ_CLASSIF) await classificador(db, validos, pavimento)
  if (ARQ_CONTAS_CLASSIF) await contasClassificador(db, validos)
  if (DESFAZER) await desfazer(db)
}

function checar(linhas, validos) {
  const semCodigo = linhas.filter((l) => !l.codigo_eap)
  const fora = linhas.filter((l) => l.codigo_eap && !validos.has(l.codigo_eap))
  // Indireto (grupo 19) fora da tabela de indiretos: avisa, nao bloqueia — o
  // dashboard reconhece o indireto pelo grupo.
  const avisos = fora.filter((l) => l.codigo_eap.split('.')[0] === '19')
  const invalidos = fora.filter((l) => l.codigo_eap.split('.')[0] !== '19')
  const resumo = (ls) => {
    const c = {}
    ls.forEach((l) => (c[l.codigo_eap] = (c[l.codigo_eap] || 0) + 1))
    return Object.entries(c).map(([k, n]) => `${k}${n > 1 ? ` (${n}×)` : ''}`).join(', ')
  }
  const semValor = linhas.filter((l) => !Number.isFinite(l.valor))
  if (semCodigo.length) console.log(`\n  ✗ ${semCodigo.length} linha(s) sem código EAP: ${semCodigo.map((l) => l.__linha).join(', ')}`)
  if (semValor.length) console.log(`  ✗ ${semValor.length} linha(s) com valor inválido: ${semValor.map((l) => l.__linha).join(', ')}`)
  if (invalidos.length) console.log(`  ✗ ${invalidos.length} linha(s) com código fora do orçamento: ${resumo(invalidos)}`)
  if (avisos.length) console.log(`  ! ${avisos.length} linha(s) de indireto com código fora da tabela de indiretos: ${resumo(avisos)}`)
  return !semCodigo.length && !semValor.length && !invalidos.length
}

async function custos(db, validos, pavimento) {
  if (!/^\d{4}-\d{2}$/.test(COMPETENCIA || '')) throw new Error('--competencia AAAA-MM é obrigatório com --custos')
  const brutas = lerAba(ARQ_CUSTOS, 'Lançamentos', ['Codigo da EAP', 'Valor (R$)'])
  const linhas = brutas
    .filter((l) => !/^total/i.test(txt(l['#'])))
    .map((l) => ({
      __linha: l.__linha,
      obra_id: OBRA,
      codigo_eap: txt(l['Codigo da EAP']),
      valor: r2(num(l['Valor (R$)'])),
      data_emissao: iso(l['Data Emissão']),
      data_vencimento: iso(l['Data de Baixa (usado: Vencimento)'] || l['Data de Vencimento']),
      competencia: COMPETENCIA,
      fornecedor: txt(l['Fornecedor']) || null,
      historico: txt(l['Item comprado (Histórico / Descrição)']) || null,
      num_documento: txt(l['Nº Documento']) || null,
      classificacao: txt(l['Classificação do Custo']) || null,
      grupo_custo: txt(l['Grupo']) || null,
      fase_obra: txt(l['Fase da Obra']) || null,
      status: 'Normal',
    }))
  linhas.forEach((l) => (l.pavimento = pavimento[l.codigo_eap] || 'Edifício'))

  const existentes = await todos(() => db.from('custos_lancamentos').select('id, valor').eq('obra_id', OBRA).eq('competencia', COMPETENCIA))
  const total = r2(linhas.reduce((t, l) => t + (l.valor || 0), 0))
  const porGrupo = {}
  linhas.forEach((l) => {
    const g = l.codigo_eap.split('.')[0] || '?'
    porGrupo[g] = r2((porGrupo[g] || 0) + (l.valor || 0))
  })
  const semVenc = linhas.filter((l) => !l.data_vencimento).length

  console.log(`\nCustos ${COMPETENCIA} · ${path.basename(ARQ_CUSTOS)}`)
  console.log(`  ${linhas.length} lançamentos · ${fmt(total)}`)
  console.log(`  por grupo: ${Object.entries(porGrupo).sort((a, b) => Number(a[0]) - Number(b[0])).map(([g, v]) => `${g}: ${fmt(v)}`).join(' · ')}`)
  if (semVenc) console.log(`  ! ${semVenc} sem data de vencimento: entram pela data de emissão`)
  console.log(`  no banco hoje para ${COMPETENCIA}: ${existentes.length} lançamentos · ${fmt(existentes.reduce((t, e) => t + Number(e.valor), 0))} → serão SUBSTITUÍDOS`)
  const ok = checar(linhas, validos)

  if (!CONFIRMAR) return console.log(`\n  PRÉVIA: nada foi gravado.${ok ? ' Para gravar, rode de novo com --confirmar' : ' Corrija os erros acima antes de gravar.'}\n`)
  if (!ok) throw new Error('há erros na planilha: nada foi gravado')

  const novas = linhas.map(({ __linha, ...l }) => l)
  for (let i = 0; i < novas.length; i += 500) {
    const r = await db.from('custos_lancamentos').insert(novas.slice(i, i + 500))
    if (r.error) throw new Error(`inserção falhou (nada antigo foi apagado): ${r.error.message}`)
  }
  const ids = existentes.map((e) => e.id)
  for (let i = 0; i < ids.length; i += 500) {
    const r = await db.from('custos_lancamentos').delete().in('id', ids.slice(i, i + 500))
    if (r.error) throw new Error(`as novas foram gravadas, mas apagar as antigas falhou: ${r.error.message}. Rode de novo para limpar.`)
  }
  console.log(`\n  ✓ ${novas.length} lançamentos gravados em ${COMPETENCIA}; ${ids.length} antigos substituídos.`)

  // Memoria: as decisoes deste mes viram referencia para os proximos.
  if (PASTA) {
    const f = path.join(PASTA, 'memoria', 'classificacoes.csv')
    const cab = ['competencia', 'fornecedor', 'item', 'codigo_eap', 'classificacao', 'grupo', 'fase', 'valor', 'origem', 'observacao']
    let atuais = []
    if (fs.existsSync(f)) {
      const wb = XLSX.read(fs.readFileSync(f, 'utf8'), { type: 'string', raw: true })
      atuais = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    }
    const outras = atuais.filter((m) => String(m.competencia) !== COMPETENCIA)
    const deste = linhas.map((l) => ({
      competencia: COMPETENCIA, fornecedor: l.fornecedor || '', item: l.historico || '', codigo_eap: l.codigo_eap,
      classificacao: l.classificacao || '', grupo: l.grupo_custo || '', fase: l.fase_obra || '', valor: l.valor,
      origem: 'importado', observacao: '',
    }))
    fs.mkdirSync(path.dirname(f), { recursive: true })
    const ws = XLSX.utils.json_to_sheet([...outras, ...deste], { header: cab })
    fs.writeFileSync(f, XLSX.utils.sheet_to_csv(ws), 'utf8')
    console.log(`  ✓ memória atualizada: ${deste.length} classificações de ${COMPETENCIA} (${outras.length + deste.length} no total)`)
  }
  console.log('')
}

async function contas(db, validos) {
  // Desativado: gravava na tabela contas_a_pagar com outro formato (aba do
  // preparar.js). O contas a pagar agora vem do classificador.
  throw new Error('--contas foi substituído por --contas-classificador automacao/contas_a_pagar.csv (gerado pelo automacao/contas_a_pagar.py)')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DATA_REF || '')) throw new Error('--data AAAA-MM-DD é obrigatório com --contas')
  const brutas = lerAba(ARQ_CONTAS, 'Contas a pagar', ['Codigo da EAP', 'Valor (R$)'])
  const linhas = brutas.map((l) => ({
    __linha: l.__linha,
    codigo_eap: txt(l['Codigo da EAP']),
    valor: r2(num(l['Valor (R$)'])),
    fornecedor: txt(l['Fornecedor']) || null,
    vencimento: iso(l['Vencimento']),
    observacao: txt(l['Origem']) || null,
  }))
  const porCodigo = {}
  linhas.forEach((l) => {
    if (l.codigo_eap) porCodigo[l.codigo_eap] = r2((porCodigo[l.codigo_eap] || 0) + (l.valor || 0))
  })
  const antigas = await todos(() => db.from('contas_a_pagar').select('id').eq('obra_id', OBRA).eq('data_referencia', DATA_REF))
  console.log(`\nContas a pagar em ${DATA_REF} · ${path.basename(ARQ_CONTAS)}`)
  console.log(`  ${linhas.length} linhas · ${Object.keys(porCodigo).length} códigos · ${fmt(linhas.reduce((t, l) => t + (l.valor || 0), 0))}`)
  console.log(`  já existe foto nessa data: ${antigas.length} linhas → será SUBSTITUÍDA`)
  const ok = checar(linhas, validos)
  if (!CONFIRMAR) return console.log(`\n  PRÉVIA: nada foi gravado.${ok ? ' Para gravar, rode de novo com --confirmar' : ''}\n`)
  if (!ok) throw new Error('há erros na planilha: nada foi gravado')

  const novas = linhas.map(({ __linha, ...l }) => ({ obra_id: OBRA, data_referencia: DATA_REF, ...l }))
  for (let i = 0; i < novas.length; i += 500) {
    const r = await db.from('contas_a_pagar').insert(novas.slice(i, i + 500))
    if (r.error) throw new Error(`inserção falhou (a foto antiga continua): ${r.error.message}`)
  }
  const ids = antigas.map((a) => a.id)
  if (ids.length) {
    const r = await db.from('contas_a_pagar').delete().in('id', ids)
    if (r.error) throw new Error(`gravou, mas apagar a foto antiga falhou: ${r.error.message}`)
  }
  console.log(`\n  ✓ contas a pagar de ${DATA_REF} gravado: ${novas.length} linhas.\n`)
}

// ── Saida do classificador (automacao/lancamentos.csv) ───────────────────

// Chave de documento para comparar o arquivo com o banco: numero do titulo +
// inicio do nome do fornecedor sem acentos/pontuacao (S/A x SA, LTDA. x LTDA).
const semAcento = (s) => txt(s).normalize('NFKD').replace(/[^\x00-\x7F]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const chaveDoc = (doc, forn) => `${txt(doc).replace(/\s/g, '').replace(/^0+/, '')} | ${semAcento(forn).slice(0, 12)}`
const porEap = (ls) => {
  const m = {}
  ls.forEach((l) => (m[l.codigo_eap] = r2((m[l.codigo_eap] || 0) + Number(l.valor))))
  return m
}
const textoEaps = (m) => Object.entries(m).sort().map(([e, v]) => `${e} ${fmt(v)}`).join(' + ')

function lerCsv(arquivo) {
  // raw: true mantem tudo como texto (cnpj com zero a esquerda, documento 10339/01)
  const conteudo = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '')
  const wb = XLSX.read(conteudo, { type: 'string', raw: true })
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true })
}

async function classificacaoPorEap(db) {
  // classificacao / grupo / fase para documento NOVO ou EAP nova no documento:
  // o trio mais usado para a EAP nos meses anteriores, contando so linhas cujo
  // grupo tem o numero certo (o historico tem 2.1.14 marcado como "3. Estrutura"
  // em parte das linhas). EAP sem historico: descricao e grupo do orcamento.
  // (Documento que ja esta no banco com a mesma EAP mantem o que tem hoje.)
  const orc = await todos(() => db.from('orcamento_planejado').select('cod_eap, descricao, grupo_numero, grupo_nome').eq('obra_id', OBRA))
  const ind = await todos(() => db.from('custos_indiretos_planejados').select('cod_eap, categoria').eq('obra_id', OBRA))
  const doOrc = {}
  orc.forEach((o) => (doOrc[o.cod_eap] = doOrc[o.cod_eap] || { descricao: o.descricao, grupo: o.grupo_numero ? `${o.grupo_numero}. ${o.grupo_nome}` : null }))
  ind.forEach((i) => (doOrc[i.cod_eap] = doOrc[i.cod_eap] || { descricao: i.categoria, grupo: '19. CUSTO INDIRETO' }))

  const numGrupo = (g) => txt(g).split('.')[0]
  const hist = await todos(() => db.from('custos_lancamentos').select('codigo_eap, classificacao, grupo_custo, fase_obra').eq('obra_id', OBRA))
  const cont = {}
  hist.forEach((h) => {
    if (numGrupo(h.grupo_custo) !== numGrupo(h.codigo_eap)) return
    const k = JSON.stringify([h.classificacao || null, h.grupo_custo, h.fase_obra || null])
    cont[h.codigo_eap] = cont[h.codigo_eap] || {}
    cont[h.codigo_eap][k] = (cont[h.codigo_eap][k] || 0) + 1
  })
  const usado = {}
  Object.entries(cont).forEach(([e, c]) => (usado[e] = JSON.parse(Object.entries(c).sort((a, b) => b[1] - a[1])[0][0])))

  return (eap) => {
    const o = doOrc[eap] || {}
    return usado[eap] || [o.descricao || null, o.grupo || null, null]
  }
}

async function classificador(db, validos, pavimento) {
  const brutas = lerCsv(ARQ_CLASSIF)
  if (!brutas.length) throw new Error(`${ARQ_CLASSIF} está vazio`)
  const faltando = ['documento', 'fornecedor', 'item', 'competencia', 'valor', 'eap', 'data_emissao', 'cnpj'].filter((c) => !(c in brutas[0]))
  if (faltando.length) throw new Error(`${path.basename(ARQ_CLASSIF)} sem as colunas: ${faltando.join(', ')} (rode o classificador atualizado)`)

  const comps = [...new Set(brutas.map((b) => txt(b.competencia).slice(0, 7)))]
  if (comps.length !== 1 || !/^\d{4}-\d{2}$/.test(comps[0])) throw new Error(`o arquivo deve ter UMA competência; tem: ${comps.join(', ')}`)
  const competencia = comps[0]
  if (competencia <= ULTIMA_COMPETENCIA_MANUAL)
    throw new Error(`${competencia} tem histórico lançado à mão no banco; substituir apagaria esse histórico. Nada foi feito.`)

  const existentes = await todos(() => db.from('custos_lancamentos').select('*').eq('obra_id', OBRA).eq('competencia', competencia))
  const classif = await classificacaoPorEap(db)
  const atual = {}
  existentes.forEach((e) => (atual[`${chaveDoc(e.num_documento, e.fornecedor)}#${e.codigo_eap}`] = [e.classificacao, e.grupo_custo, e.fase_obra]))
  // EAP sem historico: o texto do grupo segue o que o mes ja usa para aquele
  // numero (a tela /custos agrupa pelo texto exato).
  const grupoDoMes = {}
  existentes.forEach((e) => {
    const n = txt(e.grupo_custo).split('.')[0]
    if (n && n === txt(e.codigo_eap).split('.')[0]) grupoDoMes[n] = grupoDoMes[n] || e.grupo_custo
  })
  const linhas = brutas.map((b, i) => {
    const eap = txt(b.eap)
    let [classificacao, grupo_custo, fase_obra] = atual[`${chaveDoc(b.documento, b.fornecedor)}#${eap}`] || classif(eap)
    grupo_custo = grupoDoMes[txt(grupo_custo).split('.')[0]] || grupo_custo
    // classificacao informada por voce (decisoes_pontuais.csv) tem prioridade
    if (txt(b.classificacao)) classificacao = txt(b.classificacao)
    return {
      __linha: i + 2,
      obra_id: OBRA,
      competencia,
      codigo_eap: eap,
      valor: r2(num(b.valor)),
      data_emissao: iso(txt(b.data_emissao)),
      data_vencimento: iso(txt(b.competencia)), // o dashboard usa como data de baixa
      fornecedor: txt(b.fornecedor) || null,
      historico: txt(b.item) || null,
      num_documento: txt(b.documento) || null,
      cnpj: txt(b.cnpj) || null,
      classificacao, grupo_custo, fase_obra,
      pavimento: pavimento[eap] || 'Edifício',
      status: 'Normal',
    }
  })

  const total = r2(linhas.reduce((t, l) => t + (l.valor || 0), 0))
  const totalAntes = r2(existentes.reduce((t, e) => t + Number(e.valor), 0))

  console.log(`\nClassificador ${competencia} · ${path.basename(ARQ_CLASSIF)}`)
  console.log(`  arquivo: ${linhas.length} lançamentos · ${fmt(total)}`)
  console.log(`  banco hoje: ${existentes.length} lançamentos · ${fmt(totalAntes)} → serão SUBSTITUÍDOS`)
  console.log(`  diferença no mês: ${fmt(r2(total - totalAntes))}`)

  // Comparacao documento a documento
  const grupos = (ls, d, f) => {
    const g = {}
    ls.forEach((l) => (g[chaveDoc(l[d], l[f])] = g[chaveDoc(l[d], l[f])] || []).push(l))
    return g
  }
  const novo = grupos(linhas, 'num_documento', 'fornecedor')
  const velho = grupos(existentes, 'num_documento', 'fornecedor')
  const docs = [...new Set([...Object.keys(novo), ...Object.keys(velho)])].sort()
  const res = { entra: [], sai: [], muda: [], igual: [] }
  docs.forEach((k) => {
    const n = novo[k], v = velho[k]
    if (n && !v) return res.entra.push({ k, n })
    if (v && !n) return res.sai.push({ k, v })
    const en = porEap(n), ev = porEap(v)
    const igual = Object.keys({ ...en, ...ev }).every((e) => Math.abs((en[e] || 0) - (ev[e] || 0)) < 0.005)
    res[igual ? 'igual' : 'muda'].push({ k, n, v })
  })
  const soma = (ls) => fmt(r2(ls.reduce((t, l) => t + Number(l.valor), 0)))
  console.log(`\n  ENTRA (${res.entra.length} documento(s) que não estão no banco):`)
  const rotulos = (ls) =>
    [...new Set(ls.map((l) => `        ${l.codigo_eap}: ${[l.classificacao, l.grupo_custo, l.fase_obra].map((x) => x || '—').join(' | ')}`))].forEach((x) => console.log(x))
  // Documento novo com mesmo fornecedor e valor de uma linha de OUTRA
  // competencia, quando essa linha nao tem documento ou tem o MESMO: pode ser a
  // mesma parcela lancada a mao em outro mes. Documento diferente (10339/01 x
  // 10339/02) e outro titulo e nao conta.
  const outras = await todos(() => db.from('custos_lancamentos').select('id, competencia, num_documento, fornecedor, valor').eq('obra_id', OBRA).neq('competencia', competencia))
  let suspeitas = 0
  res.entra.forEach(({ k, n }) => {
    console.log(`    + ${k} · ${soma(n)} · ${textoEaps(porEap(n))}`)
    rotulos(n)
    const forn = semAcento(n[0].fornecedor).slice(0, 12)
    const valorDoc = r2(n.reduce((t, l) => t + Number(l.valor), 0))
    outras
      .filter((o) => semAcento(o.fornecedor).slice(0, 12) === forn && Math.abs(Number(o.valor) - valorDoc) < 0.005)
      .filter((o) => !txt(o.num_documento) || chaveDoc(o.num_documento, o.fornecedor) === k)
      .forEach((o) => {
        suspeitas++
        console.log(`        ⚠ possível duplicidade: ${o.competencia} já tem ${o.fornecedor} ${fmt(o.valor)} (documento ${o.num_documento || 'vazio'}, id ${o.id})`)
      })
  })
  console.log(`  SAI (${res.sai.length} documento(s) do banco que não estão no arquivo):`)
  res.sai.forEach(({ k, v }) => console.log(`    - ${k} · ${soma(v)} · ${textoEaps(porEap(v))}`))
  console.log(`  MUDA (${res.muda.length} documento(s) com valor ou EAP diferente):`)
  res.muda.forEach(({ k, n, v }) => {
    console.log(`    ~ ${k}`)
    console.log(`        banco:   ${soma(v)} · ${textoEaps(porEap(v))}`)
    console.log(`        arquivo: ${soma(n)} · ${textoEaps(porEap(n))}`)
    rotulos(n.filter((l) => !v.some((x) => x.codigo_eap === l.codigo_eap)))
  })
  console.log(`  IGUAL em valor e EAP: ${res.igual.length} documento(s)`)
  const datas = existentes.filter((e) => !e.data_vencimento).length
  if (datas) console.log(`  ! ${datas} linha(s) do banco estão sem data de baixa; as do arquivo vêm com a data de baixa do TOTVS`)
  const ok = checar(linhas, validos)

  // Documento que esta no banco e nao esta no arquivo seria APAGADO. Normal so
  // em correcao de mes; arquivo parcial (TOTVS cortado) apagaria titulos bons.
  const travaSaidas = res.sai.length > 0 && !ACEITAR_SAIDAS
  if (travaSaidas)
    console.log(`  ✗ ${res.sai.length} documento(s) do banco SAIRIAM. Se for isso mesmo, rode com --aceitar-saidas`)
  const travaDuplic = suspeitas > 0 && !ACEITAR_DUPLICIDADE
  if (travaDuplic)
    console.log(`  ✗ ${suspeitas} possível(is) duplicidade(s) com outros meses (⚠ acima). Resolva no banco ou, se não for duplicidade, rode com --aceitar-duplicidade`)

  if (!CONFIRMAR) return console.log(`\n  PRÉVIA: nada foi gravado.${ok && !travaSaidas && !travaDuplic ? ' Para gravar, rode de novo com --confirmar' : ' Resolva os itens marcados com ✗ antes de gravar.'}\n`)
  if (!ok) throw new Error('há erros no arquivo: nada foi gravado')
  if (travaSaidas) throw new Error('documentos do banco sairiam e --aceitar-saidas não foi informado: nada foi gravado')
  if (travaDuplic) throw new Error('possível duplicidade com outro mês e --aceitar-duplicidade não foi informado: nada foi gravado')

  // Estrutura do passo 1 (supabase/custos/1-importacoes.sql) precisa existir
  const t1 = await db.from('importacoes').select('id').limit(1)
  const t2 = await db.from('custos_lancamentos').select('importacao_id, cnpj').limit(1)
  if (t1.error || t2.error) throw new Error('rode antes o supabase/custos/1-importacoes.sql no painel do Supabase: nada foi gravado')

  const imp = await db.from('importacoes').insert({
    obra_id: OBRA, competencia, origem: 'classificador', arquivo: path.basename(ARQ_CLASSIF),
    linhas: linhas.length, total, linhas_substituidas: existentes.length, total_substituido: totalAntes,
    substituidos: existentes,
  }).select('id').single()
  if (imp.error) throw new Error(`não consegui registrar a importação: ${imp.error.message}. Nada foi gravado.`)
  const importacao_id = imp.data.id

  const novas = linhas.map(({ __linha, ...l }) => ({ ...l, importacao_id }))
  for (let i = 0; i < novas.length; i += 500) {
    const r = await db.from('custos_lancamentos').insert(novas.slice(i, i + 500))
    if (r.error) {
      await db.from('custos_lancamentos').delete().eq('importacao_id', importacao_id)
      await db.from('importacoes').delete().eq('id', importacao_id)
      throw new Error(`inserção falhou (nada antigo foi apagado): ${r.error.message}`)
    }
  }
  const ids = existentes.map((e) => e.id)
  for (let i = 0; i < ids.length; i += 500) {
    const r = await db.from('custos_lancamentos').delete().in('id', ids.slice(i, i + 500))
    if (r.error) throw new Error(`as novas foram gravadas, mas apagar as antigas falhou: ${r.error.message}. Desfaça com --desfazer ${importacao_id}`)
  }
  await db.from('importacoes').update({ status: 'ok' }).eq('id', importacao_id)
  console.log(`\n  ✓ ${novas.length} lançamentos gravados em ${competencia}; ${ids.length} antigos substituídos.`)
  console.log(`  importação: ${importacao_id}  (para desfazer: --desfazer ${importacao_id})\n`)
}

// ── Contas a pagar pelo classificador (automacao/contas_a_pagar.csv) ─────
//
// Card separado do custo realizado: nada daqui vai para custos_lancamentos.
// Substitui a foto inteira do fechamento (insere as novas e so depois apaga
// as antigas). Alertas: os do relatorio vem no arquivo; os que dependem do
// historico do banco sao calculados aqui e gravados junto.

// Parcelas da mesma NF (99222/01, /02) tem o mesmo numero antes da barra
const baseNf = (doc) => txt(doc).split('/')[0].replace(/^0+/, '')
const chaveForn = (cnpj, forn) => (txt(cnpj) ? `c${txt(cnpj).replace(/\D/g, '').slice(0, 8)}` : `n${semAcento(forn).slice(0, 12)}`)

async function existeTabela(db, nome) {
  const r = await db.from(nome).select('*').limit(1)
  if (!r.error) return { existe: true, colunas: r.data && r.data[0] ? Object.keys(r.data[0]) : null }
  if (/does not exist|could not find the table|schema cache/i.test(r.error.message)) return { existe: false, erro: r.error.message }
  throw new Error(`${nome}: ${r.error.message}`)
}

// Recorrente x por entrega (decisao out/26). O contas a pagar so leva o que
// e pago por entrega: material, servico por empreitada (medido) e indireto
// pontual. Recorrente sai do card e do IPC (o ja pago continua no realizado).
// A regua e a marcacao que o sistema ja tem:
//   direto   recorrente = fora do avanco fisico (entra_evm = false: locacao,
//            funcionarios) ou agregado por tempo (1.1.6);
//   indireto recorrente = diluido na obra (mes_desembolso = 0).
// Mesma lista do AGREGADO_POR_TEMPO de pages/api/dashboard-semanal.js
const AGREGADO_POR_TEMPO = new Set(['1.1.6'])

// Custo direto a pagar por entrega: uma linha por titulo e EAP, do maior para
// o menor valor, com o total no fim.
function exportarDireto(linhas, regua, arquivo) {
  const m = new Map()
  linhas
    .filter((l) => l.classe === 'direto')
    .forEach((l) => {
      const k = `${l.__chave}#${l.codigo_eap}`
      if (!m.has(k))
        m.set(k, {
          Fornecedor: l.fornecedor,
          Documento: l.num_documento,
          Vencimento: l.data_previsao || l.data_vencimento,
          'Valor (R$)': 0,
          'Valor do título (R$)': l.valor_titulo,
          EAP: l.codigo_eap,
          'Descrição da EAP': regua.descricao(l.codigo_eap),
          Tipo: l.natureza === 'previsto_sem_nf' ? 'Previsto sem NF' : 'NF',
          Alerta: l.alertas.join(' | '),
        })
      m.get(k)['Valor (R$)'] = r2(m.get(k)['Valor (R$)'] + l.valor)
    })
  const lista = [...m.values()].sort((a, b) => b['Valor (R$)'] - a['Valor (R$)'])
  const total = r2(lista.reduce((t, x) => t + x['Valor (R$)'], 0))
  const ws = XLSX.utils.json_to_sheet([...lista, { Fornecedor: 'TOTAL', 'Valor (R$)': total }])
  ws['!cols'] = [{ wch: 44 }, { wch: 14 }, { wch: 11 }, { wch: 13 }, { wch: 15 }, { wch: 9 }, { wch: 60 }, { wch: 15 }, { wch: 70 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Direto a pagar')
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  XLSX.writeFile(wb, arquivo)
  console.log(`
  ✓ lista do direto a pagar gravada em ${arquivo}: ${lista.length} linha(s) · ${fmt(total)}`)
  return lista
}

async function reguaRecorrencia(db) {
  const orc = await todos(() => db.from('orcamento_planejado').select('cod_eap, descricao, entra_evm').eq('obra_id', OBRA))
  const ind = await todos(() => db.from('custos_indiretos_planejados').select('cod_eap, categoria, mes_desembolso').eq('obra_id', OBRA))
  const evm = {}
  const desc = {}
  orc.forEach((o) => {
    if (!o.cod_eap) return
    evm[o.cod_eap] = evm[o.cod_eap] || !!o.entra_evm
    desc[o.cod_eap] = desc[o.cod_eap] || o.descricao
  })
  const mesInd = {}
  ind.forEach((i) => {
    if (!i.cod_eap) return
    mesInd[i.cod_eap] = parseInt(i.mes_desembolso, 10) || 0
    desc[i.cod_eap] = desc[i.cod_eap] || i.categoria
  })
  const regua = (eap) => {
    if (!eap) return { recorrente: false, motivo: 'sem EAP' }
    if (eap.startsWith('19.')) {
      if (!(eap in mesInd)) return { recorrente: false, motivo: 'indireto sem marcação na tabela de indiretos' }
      return mesInd[eap] === 0
        ? { recorrente: true, motivo: 'indireto diluído na obra (mes_desembolso = 0)' }
        : { recorrente: false, motivo: `indireto pontual (M${mesInd[eap]})` }
    }
    if (AGREGADO_POR_TEMPO.has(eap)) return { recorrente: true, motivo: 'agregado por tempo' }
    if (eap in evm && !evm[eap]) return { recorrente: true, motivo: 'fora do avanço físico (entra_evm = false)' }
    return { recorrente: false, motivo: 'medido por avanço físico' }
  }
  regua.descricao = (eap) => desc[eap] || ''
  regua.todas = () => [...new Set([...Object.keys(evm), ...Object.keys(mesInd)])]
  return regua
}

// Pagamento mensal (automacao/fornecedores_recorrentes.csv, decisao out/26):
// mesmo valor em outro mes e outro documento e a mensalidade, nao duplicidade.
function lerRecorrentes() {
  const f = path.join(__dirname, '..', '..', 'automacao', 'fornecedores_recorrentes.csv')
  if (!fs.existsSync(f)) return new Set()
  return new Set(lerCsv(f).map((r) => txt(r.cnpj)).filter(Boolean))
}

function alertasDoBanco(titulos, custos, jaAvisados = {}) {
  const mensais = lerRecorrentes()
  // Historico por fornecedor: um registro por documento (soma das linhas de EAP)
  const docs = {}
  custos.forEach((c) => {
    const k = `${chaveDoc(c.num_documento, c.fornecedor)}`
    if (!docs[k]) docs[k] = { fornecedor: c.fornecedor, cnpj: c.cnpj, num_documento: c.num_documento, competencia: c.competencia, valor: 0 }
    docs[k].valor = r2(docs[k].valor + Number(c.valor))
  })
  const lista = Object.values(docs)
  const porForn = {}
  lista.forEach((d) => {
    // Nos meses lancados a mao o cnpj pode faltar: indexa pelo cnpj e pelo nome
    ;[chaveForn(d.cnpj, d.fornecedor), chaveForn(null, d.fornecedor)].forEach((k) => {
      if (!porForn[k]) porForn[k] = []
      if (!porForn[k].includes(d)) porForn[k].push(d)
    })
  })
  const doFornecedor = (t) => {
    const a = porForn[chaveForn(t.cnpj, t.fornecedor)] || []
    const b = porForn[chaveForn(null, t.fornecedor)] || []
    return [...new Set([...a, ...b])]
  }

  const out = {}
  titulos.forEach((t) => {
    const al = []
    const hist = doFornecedor(t)
    if (!hist.length) al.push('fornecedor novo (nunca apareceu nos fechamentos)')
    else {
      const media = hist.reduce((s, d) => s + d.valor, 0) / hist.length
      if (media > 0 && t.valor > media * 1.5)
        al.push(`valor ${Math.round((t.valor / media - 1) * 100)}% acima da média do fornecedor (${fmt(media)} em ${hist.length} título(s))`)
      const mesmoDoc = hist.filter((d) => chaveDoc(d.num_documento, d.fornecedor) === chaveDoc(t.num_documento, t.fornecedor))
      mesmoDoc.forEach((d) => al.push(`título já lançado como custo em ${d.competencia} (${fmt(d.valor)})`))
      // Mesmo valor em outro documento: parcela da mesma NF e pagamento fixo
      // mensal (mesmo valor em 2+ meses) nao contam.
      // O relatorio ja avisou pelo titulo pago: nao repete o mesmo documento
      const avisados = (jaAvisados[t.chave] || []).join(' ')
      let dup = hist.filter((d) => Math.abs(d.valor - t.valor) < 0.005 && baseNf(d.num_documento) !== baseNf(t.num_documento) && !mesmoDoc.includes(d))
        .filter((d) => !txt(d.num_documento) || !avisados.includes(`título ${txt(d.num_documento)} `))
      if (new Set(dup.map((d) => d.competencia)).size >= 2) dup = []
      if (mensais.has(txt(t.cnpj))) dup = dup.filter((d) => txt(d.competencia).slice(0, 7) === t.competencia_vencimento)
      dup.forEach((d) => al.push(`possível duplicidade: ${d.num_documento || 'sem documento'} de mesmo valor já lançado em ${d.competencia}`))
    }
    if (al.length) out[t.chave] = al
  })
  return out
}

async function contasClassificador(db, validos) {
  const brutas = lerCsv(ARQ_CONTAS_CLASSIF)
  if (!brutas.length) throw new Error(`${ARQ_CONTAS_CLASSIF} está vazio`)
  const faltando = ['competencia_fechamento', 'competencia_vencimento', 'cnpj', 'fornecedor', 'documento', 'seq', 'valor', 'eap', 'classe', 'natureza', 'alertas']
    .filter((c) => !(c in brutas[0]))
  if (faltando.length) throw new Error(`${path.basename(ARQ_CONTAS_CLASSIF)} sem as colunas: ${faltando.join(', ')} (rode o contas_a_pagar.py atualizado)`)
  const fechs = [...new Set(brutas.map((b) => txt(b.competencia_fechamento)))]
  if (fechs.length !== 1 || !/^\d{4}-\d{2}$/.test(fechs[0])) throw new Error(`o arquivo deve ter UM fechamento; tem: ${fechs.join(', ')}`)
  const fechamento = fechs[0]

  const todas = brutas.map((b, i) => ({
    __linha: i + 2,
    obra_id: OBRA,
    competencia_fechamento: fechamento,
    competencia_vencimento: txt(b.competencia_vencimento),
    cnpj: txt(b.cnpj) || null,
    fornecedor: txt(b.fornecedor),
    num_documento: txt(b.documento),
    seq: parseInt(b.seq, 10) || 1,
    historico: txt(b.historico) || null,
    item: txt(b.item) || null,
    oc: txt(b.oc) || null,
    data_emissao: iso(txt(b.data_emissao)),
    data_vencimento: iso(txt(b.data_vencimento)),
    data_previsao: iso(txt(b.data_previsao)),
    valor_titulo: r2(num(b.valor_titulo)),
    valor: r2(num(b.valor)),
    codigo_eap: txt(b.eap) || null,
    classe: txt(b.classe),
    natureza: txt(b.natureza),
    vinculo_oc: txt(b.vinculo_oc) || null,
    regra: txt(b.regra) || null,
    alertas: txt(b.alertas) ? txt(b.alertas).split(' | ') : [],
  }))

  // Titulos (uma chave por cnpj + documento) para os alertas do banco
  const titulos = {}
  todas.forEach((l) => {
    const chave = `${l.cnpj}|${l.num_documento}`
    l.__chave = chave
    if (!titulos[chave]) titulos[chave] = { chave, cnpj: l.cnpj, fornecedor: l.fornecedor, num_documento: l.num_documento, competencia_vencimento: l.competencia_vencimento, valor: 0, natureza: l.natureza, linhas: [] }
    titulos[chave].valor = r2(titulos[chave].valor + l.valor)
    titulos[chave].linhas.push(l)
  })
  const custos = await todos(() => db.from('custos_lancamentos').select('competencia, num_documento, fornecedor, cnpj, valor').eq('obra_id', OBRA).eq('status', 'Normal'))
  const doRelatorio = {}
  Object.values(titulos).forEach((t) => (doRelatorio[t.chave] = t.linhas[0].alertas))
  const doBanco = alertasDoBanco(Object.values(titulos), custos, doRelatorio)
  todas.forEach((l) => (l.alertas = [...new Set([...l.alertas, ...(doBanco[l.__chave] || [])])]))

  // Recorrentes saem da carga: ficam fora do card e do IPC
  const regua = await reguaRecorrencia(db)
  todas.forEach((l) => (l.__rec = regua(l.codigo_eap)))
  const recorrentes = todas.filter((l) => l.__rec.recorrente)
  const linhas = todas.filter((l) => !l.__rec.recorrente)
  const titulosTodos = Object.values(titulos).map((t) => ({ ...t, todas: t.linhas }))
  Object.values(titulos).forEach((t) => {
    t.linhas = t.linhas.filter((l) => !l.__rec.recorrente)
    t.valor = r2(t.linhas.reduce((x, l) => x + l.valor, 0))
    if (!t.linhas.length) delete titulos[t.chave]
  })

  const destino = await existeTabela(db, TABELA_CONTAS)

  const soma = (ls) => r2(ls.reduce((t, l) => t + l.valor, 0))
  const nTit = (ls) => new Set(ls.map((l) => l.__chave)).size
  console.log(`\nContas a pagar · fechamento ${fechamento} → vencimento ${linhas[0].competencia_vencimento} · ${path.basename(ARQ_CONTAS_CLASSIF)}`)
  console.log(`  relatório: ${nTit(todas)} título(s) sem pagamento · ${fmt(soma(todas))}`)
  const eapsRec = [...new Set(regua.todas().filter((e) => regua(e).recorrente))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  console.log(`\n  RÉGUA (marcação do sistema): ${eapsRec.length} EAP(s) recorrentes; as demais ${regua.todas().length - eapsRec.length} são por entrega`)
  eapsRec.forEach((e) => console.log(`    ↻ ${e.padEnd(8)} ${regua.descricao(e).slice(0, 60).padEnd(60)} ${regua(e).motivo}`))
  console.log(`\n  RECORRENTES de ${linhas[0] ? linhas[0].competencia_vencimento : ''} (saem do card e do IPC): ${nTit(recorrentes)} título(s) · ${fmt(soma(recorrentes))}`)
  titulosTodos
    .filter((t) => t.todas.some((l) => l.__rec.recorrente))
    .forEach((t) => {
      const rec = t.todas.filter((l) => l.__rec.recorrente)
      const parcial = rec.length < t.todas.length
      const eaps = [...new Set(rec.map((l) => l.codigo_eap))].join(', ')
      console.log(`    - ${t.num_documento} · ${t.fornecedor} · ${fmt(soma(rec))} · ${eaps}${parcial ? ` (parcial: ${fmt(soma(t.todas.filter((l) => !l.__rec.recorrente)))} fica)` : ''}`)
    })
  console.log(`\n  POR ENTREGA (vão para o card): ${nTit(linhas)} título(s) · ${linhas.length} linha(s) · ${fmt(soma(linhas))}`)
  const grupos = [
    ['Direto (com NF)', (l) => l.natureza === 'nf' && l.classe === 'direto'],
    ['Indireto (com NF)', (l) => l.natureza === 'nf' && l.classe === 'indireto'],
    ['Previsto sem NF', (l) => l.natureza === 'previsto_sem_nf' && l.classe !== 'pendente'],
    ['Pendente (sem EAP)', (l) => l.classe === 'pendente'],
  ]
  grupos.forEach(([rot, f]) => {
    const ls = linhas.filter(f)
    console.log(`    ${rot.padEnd(20)} ${String(nTit(ls)).padStart(3)} título(s) · ${fmt(soma(ls))}`)
  })
  const ipc = linhas.filter((l) => l.classe === 'direto')
  console.log(`  entra no IPC (direto, com NF e previsto): ${fmt(soma(ipc))}`)

  const comAlerta = Object.values(titulos).filter((t) => t.linhas[0].alertas.length)
  console.log(`\n  ALERTAS (${comAlerta.length} título(s)):`)
  comAlerta.forEach((t) => {
    console.log(`    ! ${t.num_documento} · ${t.fornecedor} · ${fmt(t.valor)}${t.natureza === 'previsto_sem_nf' ? ' · previsto sem NF' : ''}`)
    t.linhas[0].alertas.forEach((a) => console.log(`        - ${a}`))
  })
  const pend = Object.values(titulos).filter((t) => t.linhas.some((l) => l.classe === 'pendente'))
  console.log(`\n  PENDÊNCIAS (${pend.length} título(s) sem EAP · ${fmt(soma(linhas.filter((l) => l.classe === 'pendente')))}): decida em automacao/pendencias_contas.csv e grave como regra`)
  pend.forEach((t) => console.log(`    ? ${t.num_documento} · ${t.fornecedor} · ${fmt(soma(t.linhas.filter((l) => l.classe === 'pendente')))} · ${t.linhas.find((l) => l.classe === 'pendente').regra || ''}`))
  const ok = checar(linhas.filter((l) => l.codigo_eap).map((l) => ({ ...l, codigo_eap: l.codigo_eap })), validos)

  console.log('')
  let antigas = []
  if (destino.existe) {
    antigas = await todos(() => db.from(TABELA_CONTAS).select('id, valor').eq('obra_id', OBRA).eq('competencia_fechamento', fechamento))
    console.log(`  tabela "${TABELA_CONTAS}": ${antigas.length} linha(s) do fechamento ${fechamento} · ${fmt(soma(antigas.map((a) => ({ valor: Number(a.valor) }))))} → serão SUBSTITUÍDAS`)
  } else console.log(`  tabela "${TABELA_CONTAS}" ainda não existe: rode antes o supabase/contas/1-contas-a-pagar.sql (banco: ${destino.erro})`)

  if (ARQ_EXPORTAR) exportarDireto(linhas, regua, ARQ_EXPORTAR)

  const travaPend = pend.length > 0 && !ACEITAR_PENDENCIAS
  if (travaPend) console.log(`  ✗ ${pend.length} título(s) sem EAP. Decida e rode o contas_a_pagar.py de novo, ou grave assim com --aceitar-pendencias (ficam fora do IPC)`)
  if (!CONFIRMAR) return console.log(`\n  PRÉVIA: nada foi gravado.${ok && !travaPend && destino.existe ? ' Para gravar, rode de novo com --confirmar' : ' Resolva os itens marcados com ✗ antes de gravar.'}\n`)
  if (!destino.existe) throw new Error(`a tabela ${TABELA_CONTAS} não existe: nada foi gravado`)
  if (!ok) throw new Error('há códigos EAP inválidos: nada foi gravado')
  if (travaPend) throw new Error('há títulos sem EAP e --aceitar-pendencias não foi informado: nada foi gravado')

  // Cada carga tem um id proprio: a nova entra inteira e so depois a anterior
  // do mesmo fechamento sai (a chave unica inclui a carga).
  const carga_id = require('crypto').randomUUID()
  const novas = linhas.map(({ __linha, __chave, __rec, ...l }) => ({ ...l, carga_id }))
  const r = await db.from(TABELA_CONTAS).insert(novas)
  if (r.error) {
    await db.from(TABELA_CONTAS).delete().eq('carga_id', carga_id)
    throw new Error(`inserção falhou (a foto antiga continua): ${r.error.message}`)
  }
  const d = await db.from(TABELA_CONTAS).delete().eq('obra_id', OBRA).eq('competencia_fechamento', fechamento).neq('carga_id', carga_id)
  if (d.error) throw new Error(`gravou, mas apagar a foto antiga falhou: ${d.error.message}. Rode de novo para limpar.`)
  console.log(`\n  ✓ contas a pagar do fechamento ${fechamento} gravado: ${novas.length} linhas, carga ${carga_id} (${antigas.length} antigas substituídas).\n`)
}

async function desfazer(db) {
  const r = await db.from('importacoes').select('*').eq('id', DESFAZER).single()
  if (r.error || !r.data) throw new Error(`importação ${DESFAZER} não encontrada`)
  const imp = r.data
  if (imp.status === 'desfeita') throw new Error(`a importação ${DESFAZER} já foi desfeita em ${imp.desfeita_em}`)
  const atuais = await todos(() => db.from('custos_lancamentos').select('id, valor').eq('importacao_id', DESFAZER))
  const voltam = imp.substituidos || []
  console.log(`\nDesfazer importação ${DESFAZER} · ${imp.competencia} · ${imp.arquivo} · ${imp.criado_em}`)
  console.log(`  sai: ${atuais.length} lançamentos desta carga · ${fmt(atuais.reduce((t, a) => t + Number(a.valor), 0))}`)
  console.log(`  volta: ${voltam.length} lançamentos que ela substituiu · ${fmt(voltam.reduce((t, a) => t + Number(a.valor), 0))}`)
  if (!CONFIRMAR) return console.log(`\n  PRÉVIA: nada foi alterado. Para desfazer, rode de novo com --confirmar\n`)

  for (let i = 0; i < voltam.length; i += 500) {
    const x = await db.from('custos_lancamentos').upsert(voltam.slice(i, i + 500))
    if (x.error) throw new Error(`devolver as linhas antigas falhou (a carga continua no banco): ${x.error.message}`)
  }
  const d = await db.from('custos_lancamentos').delete().eq('importacao_id', DESFAZER)
  if (d.error) throw new Error(`as antigas voltaram, mas apagar a carga falhou: ${d.error.message}. Rode de novo.`)
  await db.from('importacoes').update({ status: 'desfeita', desfeita_em: new Date().toISOString() }).eq('id', DESFAZER)
  console.log(`\n  ✓ importação desfeita: ${atuais.length} saíram, ${voltam.length} voltaram.\n`)
}

main().catch((e) => {
  console.error(`\nERRO: ${e.message}\n`)
  process.exit(1)
})
