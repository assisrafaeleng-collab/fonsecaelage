// pages/api/avanco-fisico-planejado.js
import { supabase } from '../../lib/supabase'

const ORDEM_GRUPOS = [
  'Servicos Preliminares e Gerais','Movimento de Terra e Fundacoes','Estrutura',
  'Alvenaria e Fechamentos','Reboco e Emboco','Instalacoes Hidrossanitarias',
  'Instalacoes Eletricas e Telecom','Instalacoes Especiais','Cobertura e Impermeabilizacao',
  'Aplicacao de Gesso','Pisos e Rodapes','Esquadrias','Pintura',
  'Loucas Metais e Bancadas','Urbanizacao e Paisagismo','Locacoes e Equipamentos','Servicos Finais',
]

const NOMES_AMIGAVEIS = {
  'Servicos Preliminares e Gerais': 'Serviços Preliminares e Gerais',
  'Movimento de Terra e Fundacoes': 'Movimento de Terra e Fundações',
  'Estrutura': 'Estrutura', 'Alvenaria e Fechamentos': 'Alvenaria e Fechamentos',
  'Reboco e Emboco': 'Reboco e Emboço',
  'Instalacoes Hidrossanitarias': 'Instalações Hidrossanitárias',
  'Instalacoes Eletricas e Telecom': 'Instalações Elétricas e Telecom',
  'Instalacoes Especiais': 'Instalações Especiais',
  'Cobertura e Impermeabilizacao': 'Cobertura e Impermeabilização',
  'Aplicacao de Gesso': 'Aplicação de Gesso', 'Pisos e Rodapes': 'Pisos e Rodapés',
  'Esquadrias': 'Esquadrias', 'Pintura': 'Pintura',
  'Loucas Metais e Bancadas': 'Louças, Metais e Bancadas',
  'Urbanizacao e Paisagismo': 'Urbanização e Paisagismo',
  'Locacoes e Equipamentos': 'Locações e Equipamentos', 'Servicos Finais': 'Serviços Finais',
}

// Extrai cod_eap e descrição do nome formatado "X.X.X — Descrição"
function parseName(atividade_nome) {
  const match = atividade_nome.match(/^([\d.X]+)\s*—\s*(.+)$/)
  if (match) return { cod_eap: match[1], desc: match[2].trim() }
  return { cod_eap: null, desc: atividade_nome }
}

function getSubgrupo(cod_eap, grupo_custo) {
  if (!cod_eap) return null
  const parts = cod_eap.split('.')
  if (parts.length < 2) return null
  const subIdx = parseInt(parts[1])
  if (grupo_custo === 'Estrutura') {
    const map = { 1: 'Térreo', 2: '2º Pavimento', 3: '3º Pavimento', 4: '4º Pavimento', 5: '5º Pavimento', 6: '6º Pavimento / Platibanda' }
    return map[subIdx] || null
  }
  if (grupo_custo === 'Alvenaria e Fechamentos') {
    const map = { 1: 'Térreo', 2: '2º Pavimento', 3: '3º Pavimento', 4: '4º Pavimento', 5: '5º Pavimento', 6: '6º Pavimento', 7: 'Platibanda' }
    return map[subIdx] || null
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const obra_id = 'flats_pampulha'
  const mesLimite = parseInt(req.query.mes) || 20

  try {
    const [cronoRes, realRes, orcRes] = await Promise.all([
      supabase.from('cronograma_fisico_planejado')
        .select('atividade_nome, atividade_codigo, mes_numero, percentual_mensal, valor_orcado')
        .eq('obra_id', obra_id).lte('mes_numero', mesLimite).order('mes_numero'),
      supabase.from('avanco_fisico_realizado')
        .select('atividade_nome, percentual_realizado, mes_numero')
        .eq('obra_id', obra_id).lte('mes_numero', mesLimite),
      supabase.from('orcamento_planejado')
        .select('cod_eap, grupo_custo').eq('obra_id', obra_id),
    ])

    if (cronoRes.error) throw new Error(cronoRes.error.message)

    // Mapa cod_eap -> grupo_custo
    const eapGrupoMap = {}
    ;(orcRes.data || []).forEach(o => { eapGrupoMap[o.cod_eap] = o.grupo_custo })

    // Mapa realizado por atividade_codigo (máximo acumulado)
    const realizadoMap = {}
    ;(realRes.data || []).forEach(r => {
      const { cod_eap } = parseName(r.atividade_nome)
      if (cod_eap) {
        realizadoMap[cod_eap] = Math.max(realizadoMap[cod_eap] || 0, parseFloat(r.percentual_realizado || 0))
      }
    })

    // Agrupa por cod_eap único
    const atividadeMap = {}
    ;(cronoRes.data || []).forEach(c => {
      const { cod_eap, desc } = parseName(c.atividade_nome)
      const key = cod_eap || c.atividade_nome
      
      if (!atividadeMap[key]) {
        const grupo_custo = eapGrupoMap[cod_eap] || 'Outro'
        atividadeMap[key] = {
          cod_eap,
          nome: desc,
          grupo_custo,
          valor_orcado: parseFloat(c.valor_orcado || 0),
          perc_planejado: 0,
          perc_realizado: realizadoMap[cod_eap] || 0,
          mes_inicio: c.mes_numero,
          mes_fim: c.mes_numero,
        }
      }
      atividadeMap[key].perc_planejado += parseFloat(c.percentual_mensal || 0)
      atividadeMap[key].mes_fim = Math.max(atividadeMap[key].mes_fim, c.mes_numero)
    })

    // Calcular valores finais
    Object.values(atividadeMap).forEach(a => {
      a.perc_planejado = Math.min(a.perc_planejado, 1)
      a.perc_planejado_pct = parseFloat((a.perc_planejado * 100).toFixed(1))
      a.perc_realizado_pct = parseFloat((a.perc_realizado * 100).toFixed(1))
      a.valor_periodo = a.valor_orcado * a.perc_planejado
    })

    // Agrupar por macrogrupo e subgrupo
    const gruposMap = {}
    Object.values(atividadeMap).forEach(at => {
      const grupo = at.grupo_custo
      const subgrupo = getSubgrupo(at.cod_eap, grupo)
      if (!gruposMap[grupo]) {
        gruposMap[grupo] = { chave: grupo, nome: NOMES_AMIGAVEIS[grupo] || grupo, atividades: [], subgrupos: {}, valor_total: 0, valor_periodo: 0 }
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

    // Calcular % médio ponderado
    const calcPerc = (atividades) => {
      const tot = atividades.reduce((s, a) => s + a.valor_orcado, 0)
      return tot > 0 ? parseFloat((atividades.reduce((s, a) => s + a.perc_planejado * a.valor_orcado, 0) / tot * 100).toFixed(1)) : 0
    }

    Object.values(gruposMap).forEach(g => {
      const todas = [...g.atividades, ...Object.values(g.subgrupos).flatMap(sg => sg.atividades)]
      g.perc_medio = calcPerc(todas)
      Object.values(g.subgrupos).forEach(sg => { sg.perc_medio = calcPerc(sg.atividades) })
    })

    // Ordenar subgrupos por pavimento
    const ORDEM_PAV = ['Térreo', '2º Pavimento', '3º Pavimento', '4º Pavimento', '5º Pavimento', '6º Pavimento', '6º Pavimento / Platibanda', 'Platibanda']
    
    const grupos = ORDEM_GRUPOS.filter(g => gruposMap[g]).map(g => ({
      ...gruposMap[g],
      subgrupos: Object.values(gruposMap[g].subgrupos).sort((a, b) => {
        const ia = ORDEM_PAV.indexOf(a.nome)
        const ib = ORDEM_PAV.indexOf(b.nome)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      })
    }))

    Object.keys(gruposMap).forEach(g => {
      if (!ORDEM_GRUPOS.includes(g)) grupos.push({ ...gruposMap[g], subgrupos: Object.values(gruposMap[g].subgrupos) })
    })

    const totalAtividades = Object.keys(atividadeMap).length
    const totalOrc = grupos.reduce((s, g) => s + g.valor_total, 0)
    const avancoMedio = totalOrc > 0
      ? parseFloat((grupos.reduce((s, g) => s + g.valor_periodo, 0) / totalOrc * 100).toFixed(1))
      : 0

    return res.status(200).json({ grupos, avancoMedio, totalAtividades, mes_limite: mesLimite, obra_id })

  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}
