// pages/api/custos-indiretos-realizados-lista.js
import { supabase } from '../../lib/supabase'

// Mapeamento exato: codigo_eap -> categoria do planejado
const EAP_CATEGORIA = {
  '19.1.1': 'AVCB (Auto de Vistoria CBMMG) — taxa e vistoria',
  '19.1.2': 'Serviços Sondagem',
  '19.1.3': 'Projeto Arquitetonico',
  '19.1.4': 'Projeto Estrutural',
  '19.1.5': 'Projeto Eletrico',
  '19.1.6': 'Projeto Padrão',
  '19.1.7': 'Projeto Hidrossanitario',
  '19.1.8': 'Projeto SPDA',
  '19.1.9': 'Projeto Combate de Incendio',
  '19.1.10': 'Registro de Incorporação+Averbação da Construção',
  '19.1.11': 'Custo de ITBI',
  '19.1.12': 'Custo de Registro Lote',
  '19.1.13': 'Custo de Escritura',
  '19.1.14': 'Taxa de Aprovação Prefeitura - Projeto',
  '19.1.15': 'Alvará Tráfego de Terra e Entulho',
  '19.1.16': 'Taxa Aprovação Corpo de Bombeiro',
  '19.1.17': 'Laudo Cautelares',
  '19.1.18': 'Serviços Contabeis',
  '19.1.19': 'Serviços Advocaticios',
  '19.1.20': 'Valor do Terreno',
  '19.1.21': 'IPTU Terreno',
  '19.1.22': 'Art e Taxas',
  '19.1.23': 'Administração local da obra (engenheiro)',
  '19.1.24': 'Taxa ADM (12% custo direto)',
  '19.1.25': 'Restaurante',
  '19.1.26': 'Padaria',
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = 'flats_pampulha'
  try {
    const [lancRes, planRes] = await Promise.all([
      supabase.from('custos_lancamentos').select('*').eq('obra_id', obra_id).like('codigo_eap', '19.%').eq('status', 'Normal').order('data_emissao', { ascending: false }),
      supabase.from('custos_indiretos_planejados').select('categoria, valor_total, mes_desembolso').eq('obra_id', obra_id)
    ])
    if (lancRes.error) throw new Error(lancRes.error.message)
    if (planRes.error) throw new Error(planRes.error.message)

    const lancamentos = lancRes.data || []
    const planejados = planRes.data || []

    // Calcular realizado por categoria usando mapeamento exato
    const realPorCategoria = {}
    const lancsPorCategoria = {}
    lancamentos.forEach(l => {
      const cat = EAP_CATEGORIA[l.codigo_eap]
      if (cat) {
        if (!realPorCategoria[cat]) realPorCategoria[cat] = 0
        realPorCategoria[cat] += parseFloat(l.valor || 0)
        if (!lancsPorCategoria[cat]) lancsPorCategoria[cat] = []
        lancsPorCategoria[cat].push(l)
      }
    })

    const totalRealizado = lancamentos.reduce((s, l) => s + parseFloat(l.valor || 0), 0)
    const totalPlanejado = planejados.reduce((s, p) => s + parseFloat(p.valor_total || 0), 0)

    return res.status(200).json({
      lancamentos,
      planejados,
      realPorCategoria,
      lancsPorCategoria,
      totalRealizado,
      totalPlanejado,
      quantidade: lancamentos.length
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
