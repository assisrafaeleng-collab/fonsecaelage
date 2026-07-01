// pages/api/custos-indiretos-realizados-lista.js
import { supabase } from '../../lib/supabase'

// Mapeamento exato: codigo_eap -> categoria do planejado
const EAP_CATEGORIA = {
  '18.1.1':  'Administração local da obra (engenheiro)',
  '18.1.2':  'Serviços Sondagem',
  '18.1.4':  'Projeto Estrutural',
  '18.1.11': 'Custo de ITBI',
  '18.1.12': 'Custo de Registro Lote',
  '18.1.13': 'Custo de Escritura',
  '18.1.15': 'Alvará Tráfego de Terra e Entulho',
  '18.1.17': 'Laudo Cautelares',
  '18.1.19': 'Serviços Advocaticios',
  '18.1.21': 'IPTU Terreno',
  '18.1.22': 'Art e Taxas',
  '18.1.20': 'Valor do Terreno',
  '18.1.23': 'Administração local da obra (engenheiro)',
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = 'flats_pampulha'
  try {
    const [lancRes, planRes] = await Promise.all([
      supabase.from('custos_lancamentos').select('*').eq('obra_id', obra_id).like('codigo_eap', '18.%').eq('status', 'Normal').order('data_emissao', { ascending: false }),
      supabase.from('custos_indiretos_planejados').select('categoria, valor_total, mes_desembolso').eq('obra_id', obra_id)
    ])
    if (lancRes.error) throw new Error(lancRes.error.message)
    if (planRes.error) throw new Error(planRes.error.message)

    const lancamentos = lancRes.data || []
    const planejados = planRes.data || []

    // Calcular realizado por categoria usando mapeamento exato
    const realPorCategoria = {}
    lancamentos.forEach(l => {
      const cat = EAP_CATEGORIA[l.codigo_eap]
      if (cat) {
        if (!realPorCategoria[cat]) realPorCategoria[cat] = 0
        realPorCategoria[cat] += parseFloat(l.valor || 0)
      }
    })

    const totalRealizado = lancamentos.reduce((s, l) => s + parseFloat(l.valor || 0), 0)
    const totalPlanejado = planejados.reduce((s, p) => s + parseFloat(p.valor_total || 0), 0)

    return res.status(200).json({
      lancamentos,
      planejados,
      realPorCategoria,
      totalRealizado,
      totalPlanejado,
      quantidade: lancamentos.length
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
