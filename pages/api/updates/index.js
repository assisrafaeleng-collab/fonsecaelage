// pages/api/updates/index.js
// API com integração automática de custos

import { supabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // Buscar todas as atualizações
      const { data: updates, error: updatesError } = await supabase
        .from('atualizacoes_obra')
        .select('*')
        .eq('obra_id', 'flats_pampulha')
        .order('data', { ascending: true })

      if (updatesError) throw updatesError

      // Para cada atualização, buscar custos até aquela data
      const enriched = await Promise.all(updates.map(async (u) => {
        // Buscar custos até a data
        const { data: custos, error: custosError } = await supabase
          .from('custos_lancamentos')
          .select('valor')
          .eq('obra_id', 'flats_pampulha')
          .eq('status', 'Normal')
          .lte('competencia', u.data)

        if (custosError) throw custosError

        const custo_real = custos.reduce((sum, c) => sum + parseFloat(c.valor), 0)
        
        // Buscar orçamento
        const { data: orcamento, error: orcError } = await supabase
          .from('v_kpis_projeto')
          .select('orcamento_total')
          .eq('obra_id', 'flats_pampulha')
          .single()

        if (orcError) throw orcError

        const orcamento_total = parseFloat(orcamento.orcamento_total) / 1000

        // Calcular projeção
        const projecao = u.avanco_real > 0 
          ? (custo_real / u.avanco_real * 100)
          : custo_real

        // Calcular avanço planejado
        const dataObj = new Date(u.data + 'T12:00:00')
        const mesIdx = (dataObj.getFullYear() - 2024) * 12 + (dataObj.getMonth() - 5)
        
        const curvaS = [2.5, 6, 10, 15, 22, 30, 39, 48.5, 58, 67, 75, 82, 87.5, 91.5, 94.5, 96.5, 98, 100]
        const avanco_plan = mesIdx >= 0 && mesIdx < curvaS.length ? curvaS[mesIdx] : 100

        const desvio_dias = Math.round((u.avanco_real - avanco_plan) * 5.4)

        return {
          ...u,
          orcamento: orcamento_total,
          custo_real,
          projecao,
          avanco_plan,
          desvio_dias,
        }
      }))

      res.status(200).json(enriched)
    } catch (error) {
      console.error('Erro ao buscar atualizações:', error)
      res.status(500).json({ error: error.message })
    }
  } else if (req.method === 'POST') {
    try {
      const payload = {
        obra_id: 'flats_pampulha',
        data: req.body.data,
        semana: req.body.semana,
        avanco_real: req.body.avanco_real,
        disciplinas: req.body.disciplinas,
        notas: req.body.notas,
      }

      const { data, error } = await supabase
        .from('atualizacoes_obra')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      res.status(201).json(data)
    } catch (error) {
      console.error('Erro ao criar atualização:', error)
      res.status(500).json({ error: error.message })
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}