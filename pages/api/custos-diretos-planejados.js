// pages/api/custos-diretos-planejados.js
import { supabase } from '../../lib/supabase'

// Ordem dos macrogrupos na sequência construtiva
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

// Nomes amigáveis dos grupos
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

// Mapa de subgrupos por pavimento para Estrutura e Alvenaria
function getSubgrupo(cod_eap, grupo_custo) {
  if (!cod_eap) return null
  const parts = cod_eap.split('.')
  if (parts.length < 2) return null

  const subIdx = parseInt(parts[1])

  if (grupo_custo === 'Estrutura') {
    const map = { 1: 'Térreo', 2: '1º Pavimento', 3: '2º Pavimento', 4: '3º Pavimento', 5: '4º Pavimento', 6: '5º Pavimento / Platibanda' }
    return map[subIdx] || `Pavimento ${subIdx}`
  }

  if (grupo_custo === 'Alvenaria e Fechamentos') {
    const map = { 1: 'Térreo', 2: '1º Pavimento', 3: '2º Pavimento', 4: '3º Pavimento', 5: '4º Pavimento', 6: '5º Pavimento', 7: 'Platibanda' }
    return map[subIdx] || `Pavimento ${subIdx}`
  }

  return null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const obra_id = 'flats_pampulha'

  try {
    const { data, error } = await supabase
      .from('orcamento_planejado')
      .select('cod_eap, descricao, preco_total, grupo_custo')
      .eq('obra_id', obra_id)
      .order('cod_eap')

    if (error) throw new Error(error.message)

    const total = data.reduce((sum, item) => sum + parseFloat(item.preco_total || 0), 0)

    // Agrupar por grupo e subgrupo
    const gruposMap = {}

    data.forEach(item => {
      const grupo = item.grupo_custo || 'Outro'
      const subgrupo = getSubgrupo(item.cod_eap, grupo)

      if (!gruposMap[grupo]) {
        gruposMap[grupo] = {
          nome: NOMES_AMIGAVEIS[grupo] || grupo,
          chave: grupo,
          total: 0,
          subgrupos: {},
          itens: []
        }
      }

      gruposMap[grupo].total += parseFloat(item.preco_total || 0)

      if (subgrupo) {
        if (!gruposMap[grupo].subgrupos[subgrupo]) {
          gruposMap[grupo].subgrupos[subgrupo] = { nome: subgrupo, total: 0, itens: [] }
        }
        gruposMap[grupo].subgrupos[subgrupo].total += parseFloat(item.preco_total || 0)
        gruposMap[grupo].subgrupos[subgrupo].itens.push({
          cod_eap: item.cod_eap,
          descricao: item.descricao,
          valor: parseFloat(item.preco_total || 0)
        })
      } else {
        gruposMap[grupo].itens.push({
          cod_eap: item.cod_eap,
          descricao: item.descricao,
          valor: parseFloat(item.preco_total || 0)
        })
      }
    })

    // Ordenar grupos conforme sequência construtiva
    const grupos = ORDEM_GRUPOS
      .filter(g => gruposMap[g])
      .map(g => ({
        ...gruposMap[g],
        percentual: total > 0 ? (gruposMap[g].total / total) * 100 : 0,
        subgrupos: Object.values(gruposMap[g].subgrupos).map(sg => ({
          ...sg,
          percentual: total > 0 ? (sg.total / total) * 100 : 0
        }))
      }))

    // Adicionar grupos não mapeados na ordem
    Object.keys(gruposMap).forEach(g => {
      if (!ORDEM_GRUPOS.includes(g)) {
        grupos.push({
          ...gruposMap[g],
          percentual: total > 0 ? (gruposMap[g].total / total) * 100 : 0,
          subgrupos: Object.values(gruposMap[g].subgrupos)
        })
      }
    })

    return res.status(200).json({ grupos, total, obra_id })

  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
  }
}