import { supabase } from '../../lib/supabase'
import { senhaOk } from '../../lib/senha-servidor'
import { montarPainelPontos, carregarEntradas, OBRA_ID } from '../../lib/pontos-atencao-servidor'

// /api/pontos-atencao — painel "Pontos de atenção" da página semanal (lib/pontos-atencao.js).
//   GET ?semana=N   só leitura; sem as tabelas de supabase/planejamento o painel vem com tudo pendente e
//                   "configurado" diz o que falta.
//   ?entradas=1     (só em desenvolvimento) devolve as entradas da conta, para o teste por script.
//   POST { cod_eap, pavimento, campo, valor, quem } — grava a edição feita na tela. Exige DASHBOARD_SENHA no
//     cabeçalho x-dashboard-senha; chave secreta só aqui no servidor. Campos:
//       indice  Hh do oficial por unidade (> 0)          duracao  dias (> 0) do serviço por duração
//       equipes nº de equipes (null = voltar ao sugerido) equipe   { oficiais, ajudantes, funcao } da linha
//       antecedencia (item de compra, sem pavimento): { dias } ou { meses } (null = apagar)
//     Toda alteração vai para planejamento_historico (valor anterior e novo, quem e quando).
const naoExiste = (e) => /does not exist|could not find the table|schema cache|column .* does not exist/i.test(String(e && e.message))
const RODE_SQL = 'Rode antes os SQL supabase/planejamento/1-tabelas-pontos-atencao.sql e 2-edicao-no-site.sql.'
const numero = (v) => Number(String(v ?? '').replace(',', '.'))

async function gravarCompra(res, b, quem, agora) {
  const atual = await supabase.from('insumo_prazo_entrega')
    .select('cod_eap, antecedencia_dias, antecedencia_meses, editado_por').eq('obra_id', OBRA_ID).eq('cod_eap', b.cod_eap).maybeSingle()
  if (atual.error) return res.status(409).json({ error: naoExiste(atual.error) ? RODE_SQL : atual.error.message })
  if (!atual.data) return res.status(404).json({ error: 'Item sem cadastro em insumo_prazo_entrega.' })
  const v = b.valor || null
  const dias = v && v.dias != null && v.dias !== '' ? parseInt(v.dias, 10) : null
  const meses = v && v.meses != null && v.meses !== '' ? parseInt(v.meses, 10) : null
  if ((dias != null && !(dias >= 0)) || (meses != null && !(meses >= 0)) || (dias != null && meses != null))
    return res.status(400).json({ error: 'Informe a antecedência em dias OU em meses (número ≥ 0).' })
  const a = atual.data
  const txt = (d, m) => (m != null ? `${m} meses` : d != null ? `${d} dias` : null)
  const up = await supabase.from('insumo_prazo_entrega')
    .update({ antecedencia_dias: dias, antecedencia_meses: meses, editado_por: quem, editado_em: agora, atualizado_em: agora })
    .eq('obra_id', OBRA_ID).eq('cod_eap', b.cod_eap)
  if (up.error) return res.status(500).json({ error: up.error.message })
  return historico(res, { cod_eap: b.cod_eap, pavimento: null, campo: 'antecedencia',
    antes: txt(a.antecedencia_dias, a.antecedencia_meses), depois: txt(dias, meses), quem, agora })
}

async function historico(res, { cod_eap, pavimento, campo, antes, depois, quem, agora }) {
  const h = await supabase.from('planejamento_historico').insert({
    obra_id: OBRA_ID, cod_eap, pavimento, campo, valor_anterior: antes == null ? null : String(antes),
    valor_novo: depois == null ? null : String(depois), editado_por: quem, editado_em: agora,
  })
  if (h.error) return res.status(500).json({ error: 'Gravado, mas o histórico falhou: ' + h.error.message })
  return res.status(200).json({ ok: true })
}

async function gravar(req, res) {
  if (!senhaOk(req, res)) return
  const b = req.body || {}
  const quem = String(b.quem || '').trim() || null
  const agora = new Date().toISOString()     // instante da edição (timestamptz), não é data de calendário
  if (!b.cod_eap || !['indice', 'duracao', 'equipes', 'equipe', 'antecedencia'].includes(b.campo))
    return res.status(400).json({ error: 'Pedido inválido.' })
  if (b.campo === 'antecedencia') return gravarCompra(res, b, quem, agora)

  const pav = b.pavimento == null ? '' : String(b.pavimento)
  const atual = await supabase.from('indice_produtividade')
    .select('cod_eap, pavimento, regra, hh_por_unidade, duracao_dias, tipo_equipe, equipes_definidas, equipe_oficiais, equipe_ajudantes, equipe_funcao')
    .eq('obra_id', OBRA_ID).eq('cod_eap', b.cod_eap).eq('pavimento', pav).maybeSingle()
  if (atual.error) return res.status(409).json({ error: naoExiste(atual.error) ? RODE_SQL : atual.error.message })
  if (!atual.data) return res.status(404).json({ error: 'Linha sem cadastro em indice_produtividade.' })
  const a = atual.data
  const descrIx = (x) => (x.regra === 'duracao' ? (x.duracao_dias != null ? `duração ${x.duracao_dias} dias` : 'duração pendente')
    : x.hh_por_unidade != null ? `${x.hh_por_unidade} Hh/un` : 'índice pendente')
  let mudar, antes, depois
  if (b.campo === 'indice') {
    const v = numero(b.valor)
    if (!(v > 0)) return res.status(400).json({ error: 'Índice deve ser maior que zero (Hh do oficial por unidade).' })
    antes = descrIx(a); depois = `${v} Hh/un`
    mudar = { hh_por_unidade: v, regra: 'indice', duracao_dias: null, origem: 'rafael-site' }
  } else if (b.campo === 'duracao') {
    const v = numero(b.valor)
    if (!(v > 0)) return res.status(400).json({ error: 'Duração deve ser maior que zero (dias úteis).' })
    antes = descrIx(a); depois = `duração ${v} dias`
    mudar = { duracao_dias: v, regra: 'duracao', hh_por_unidade: null, origem: 'rafael-site' }
  } else if (b.campo === 'equipes') {
    const v = b.valor == null || b.valor === '' ? null : parseInt(b.valor, 10)
    if (v != null && !(v > 0)) return res.status(400).json({ error: 'Número de equipes deve ser maior que zero.' })
    antes = a.equipes_definidas; depois = v
    mudar = { equipes_definidas: v }
  } else {
    const of = parseInt(b.valor && b.valor.oficiais, 10), aj = parseInt(b.valor && b.valor.ajudantes, 10)
    const fn = String((b.valor && b.valor.funcao) || '').trim()
    if (!(of > 0) || !(aj >= 0)) return res.status(400).json({ error: 'Informe pelo menos 1 oficial (e os ajudantes, 0 ou mais).' })
    antes = a.equipe_oficiais == null && a.equipe_ajudantes == null ? (a.tipo_equipe || 'sem equipe')
      : `${a.equipe_oficiais} ${a.equipe_funcao || 'oficial'} + ${a.equipe_ajudantes} ajudante(s)`
    depois = `${of} ${fn || 'oficial'} + ${aj} ajudante(s)`
    mudar = { equipe_oficiais: of, equipe_ajudantes: aj, equipe_funcao: fn || null }
  }
  const up = await supabase.from('indice_produtividade').update({ ...mudar, editado_por: quem, editado_em: agora, atualizado_em: agora })
    .eq('obra_id', OBRA_ID).eq('cod_eap', b.cod_eap).eq('pavimento', pav)
  if (up.error) return res.status(naoExiste(up.error) ? 409 : 500).json({ error: naoExiste(up.error) ? RODE_SQL : up.error.message })
  return historico(res, { cod_eap: b.cod_eap, pavimento: pav, campo: b.campo, antes, depois, quem, agora })
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' })
  if (req.method === 'POST') {
    try { return await gravar(req, res) } catch (e) { return res.status(500).json({ error: e.message }) }
  }
  const semana = req.query.semana ? parseInt(req.query.semana, 10) : null
  try {
    res.setHeader('Cache-Control', 'no-store')
    if (req.query.entradas && process.env.NODE_ENV !== 'production') {
      return res.status(200).json(await carregarEntradas(supabase, semana))
    }
    return res.status(200).json(await montarPainelPontos(supabase, semana))
  } catch (e) {
    console.error('Erro em /api/pontos-atencao:', e)
    return res.status(500).json({ error: 'Erro ao montar os pontos de atenção', message: e.message })
  }
}
