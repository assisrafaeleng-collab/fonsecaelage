// pages/api/avanco-fisico-planejado.js
import { supabase } from '../../lib/supabase'

const ORDEM_GRUPOS = [
  'Servicos Preliminares e Gerais',
  'Movimento de Terra e Fundacoes',
  'Estrutura',
  'Alvenaria e Fechamentos',
  'Reboco e Emboco',
  'Instalacoes Hidrossanitarias',
  'Instalacoes Eletricas e Telecom',
  'Instalacoes Especiais',
  'Cobertura e Impermeabilizacao',
  'Aplicacao de Gesso',
  'Pisos e Rodapes',
  'Esquadrias',
  'Pintura',
  'Loucas Metais e Bancadas',
  'Urbanizacao e Paisagismo',
  'Locacoes e Equipamentos',
  'Servicos Finais',
]

const NOMES_AMIGAVEIS = {
  'Servicos Preliminares e Gerais': 'Serviços Preliminares e Gerais',
  'Movimento de Terra e Fundacoes': 'Movimento de Terra e Fundações',
  'Estrutura': 'Estrutura',
  'Alvenaria e Fechamentos': 'Alvenaria e Fechamentos',
  'Reboco e Emboco': 'Reboco e Emboço',
  'Instalacoes Hidrossanitarias': 'Instalações Hidrossanitárias',
  'Instalacoes Eletricas e Telecom': 'Instalações Elétricas e Telecom',
  'Instalacoes Especiais': 'Instalações Especiais',
  'Cobertura e Impermeabilizacao': 'Cobertura e Impermeabilização',
  'Aplicacao de Gesso': 'Aplicação de Gesso',
  'Pisos e Rodapes': 'Pisos e Rodapés',
  'Esquadrias': 'Esquadrias',
  'Pintura': 'Pintura',
  'Loucas Metais e Bancadas': 'Louças, Metais e Bancadas',
  'Urbanizacao e Paisagismo': 'Urbanização e Paisagismo',
  'Locacoes e Equipamentos': 'Locações e Equipamentos',
  'Servicos Finais': 'Serviços Finais',
}

function getSubgrupo(cod_eap, grupo_custo) {
  if (!cod_eap) return null
  const parts = cod_eap.split('.')
  if (parts.length < 2) return null
  const subIdx = parseInt(parts[1])
  if (grupo_custo === 'Estrutura') {
    const map = { 1: 'Térreo', 2: '1º Pavimento', 3: '2º Pavimento', 4: '3º Pavimento', 5: '4º Pavimento', 6: '5º Pavimento / Platibanda' }
    return map[subIdx] || null
  }
  if (grupo_custo === 'Alvenaria e Fechamentos') {
    const map = { 1: 'Térreo', 2: '1º Pavimento', 3: '2º Pavimento', 4: '3º Pavimento', 5: '4º Pavimento', 6: '5º Pavimento', 7: 'Platibanda' }
    return map[subIdx] || null
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const obra_id = 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 20

  try {
    // Buscar cronograma planejado até o mês
    const { data: cronograma, error: errCrono } = await supabase
      .from('cronograma_fisico_planejado')
      .select('atividade_nome, atividade_codigo, mes_numero, percentual_mensal, valor_orcado')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
      .order('mes_numero')
    if (errCrono) throw new Error(errCrono.message)

    // Buscar avanço realizado
    const { data: realizado, error: errReal } = await supabase
      .from('avanco_fisico_realizado')
      .select('atividade_nome, percentual_realizado, mes_numero')
      .eq('obra_id', obra_id)
      .lte('mes_numero', mesLimite)
    if (errReal) throw new Error(errReal.message)

    // Buscar mapeamento cod_eap por nome
    const { data: orcamento } = await supabase
      .from('orcamento_planejado')
      .select('cod_eap, descricao, grupo_custo')
      .eq('obra_id', obra_id)
    
    // Mapa nome -> {cod_eap, grupo_custo}
    const nomeMap = {}
    ;(orcamento || []).forEach(o => {
      nomeMap[o.descricao] = { cod_eap: o.cod_eap, grupo_custo: o.grupo_custo }
    })

    // Mapa realizado por atividade (máximo acumulado)
    const realizadoMap = {}
    ;(realizado || []).forEach(r => {
      const atual = realizadoMap[r.atividade_nome] || 0
      realizadoMap[r.atividade_nome] = Math.max(atual, parseFloat(r.percentual_realizado || 0))
    })

    // Agrupa cronograma por atividade
    const atividadeMap = {}
    cronograma.forEach(c => {
      const nome = c.atividade_nome
      if (!atividadeMap[nome]) {
        const info = nomeMap[nome] || {}
        atividadeMap[nome] = {
          nome,
          cod_eap: info.cod_eap || null,
          grupo_custo: info.grupo_custo || 'Outro',
          valor_orcado: parseFloat(c.valor_orcado || 0),
          perc_planejado: 0,
          perc_realizado: realizadoMap[nome] || 0,
          meses: []
        }
      }
      atividadeMap[nome].perc_planejado += parseFloat(c.percentual_mensal || 0)
      atividadeMap[nome].meses.push(c.mes_numero)
    })

    // Cap em 1.0
    Object.values(atividadeMap).forEach(a => {
      a.perc_planejado = Math.min(a.perc_planejado, 1)
      a.perc_planejado_pct = parseFloat((a.perc_planejado * 100).toFixed(1))
      a.perc_realizado_pct = parseFloat((a.perc_realizado * 100).toFixed(1))
      a.valor_periodo = a.valor_orcado * a.perc_planejado
      a.status = a.perc_planejado >= 1 ? 'Concluído' : a.perc_planejado > 0 ? 'Em andamento' : 'Não iniciado'
    })

    // Agrupar por macrogrupo e subgrupo
    const gruposMap = {}
    Object.values(atividadeMap).forEach(at => {
      const grupo = at.grupo_custo
      const subgrupo = getSubgrupo(at.cod_eap, grupo)
      if (!gruposMap[grupo]) {
        gruposMap[grupo] = {
          chave: grupo,
          nome: NOMES_AMIGAVEIS[grupo] || grupo,
          atividades: [],
          subgrupos: {},
          valor_total: 0,
          valor_periodo: 0,
          perc_medio: 0,
        }
      }
      gruposMap[grupo].valor_total += at.valor_orcado
      gruposMap[grupo].valor_periodo += at.valor_periodo

      if (subgrupo) {
        if (!gruposMap[grupo].subgrupos[subgrupo]) {
          gruposMap[grupo].subgrupos[subgrupo] = { nome: subgrupo, atividades: [], valor_total: 0, valor_periodo: 0 }
        }
        gruposMap[grupo].subgrupos[subgrupo].atividades.push(at)
        gruposMap[grupo].subgrupos[subgrupo].valor_total += at.valor_orcado
        gruposMap[grupo].subgrupos[subgrupo].valor_periodo += at.valor_periodo
      } else {
        gruposMap[grupo].atividades.push(at)
      }
    })

    // Calcular % médio ponderado por valor de cada grupo
    Object.values(gruposMap).forEach(g => {
      const todasAt = [
        ...g.atividades,
        ...Object.values(g.subgrupos).flatMap(sg => sg.atividades)
      ]
      const totalOrc = todasAt.reduce((s, a) => s + a.valor_orcado, 0)
      g.perc_medio = totalOrc > 0
        ? todasAt.reduce((s, a) => s + a.perc_planejado * a.valor_orcado, 0) / totalOrc * 100
        : 0
      g.perc_medio = parseFloat(g.perc_medio.toFixed(1))
      
      // Subgrupos também
      Object.values(g.subgrupos).forEach(sg => {
        const tot = sg.atividades.reduce((s, a) => s + a.valor_orcado, 0)
        sg.perc_medio = tot > 0
          ? sg.atividades.reduce((s, a) => s + a.perc_planejado * a.valor_orcado, 0) / tot * 100
          : 0
        sg.perc_medio = parseFloat(sg.perc_medio.toFixed(1))
      })
    })

    // Ordenar grupos
    const grupos = ORDEM_GRUPOS
      .filter(g => gruposMap[g])
      .map(g => ({
        ...gruposMap[g],
        subgrupos: Object.values(gruposMap[g].subgrupos)
      }))

    // Grupos não mapeados
    Object.keys(gruposMap).forEach(g => {
      if (!ORDEM_GRUPOS.includes(g)) {
        grupos.push({ ...gruposMap[g], subgrupos: Object.values(gruposMap[g].subgrupos) })
      }
    })

    const totalAtividades = Object.keys(atividadeMap).length
    const avancoMedio = grupos.length > 0
      ? grupos.reduce((s, g) => s + g.perc_medio, 0) / grupos.length
      : 0

    return res.status(200).json({
      grupos,
      avancoMedio: parseFloat(avancoMedio.toFixed(1)),
      totalAtividades,
      mes_limite: mesLimite,
      obra_id
    })

  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}