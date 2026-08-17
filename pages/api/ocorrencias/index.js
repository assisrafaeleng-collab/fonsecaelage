// pages/api/ocorrencias/index.js
// GET  -> lista as ocorrências mais recentes da obra
// POST -> cria uma nova ocorrência (Diário de Ocorrências)

import { supabase } from '../../../lib/supabase'

const IMPACTOS_VALIDOS = ['baixo', 'medio', 'alto']

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const limite = parseInt(req.query.limite) || 50

      const { data, error } = await supabase
        .from('ocorrencias_obra')
        .select('*')
        .eq('obra_id', 'flats_pampulha')
        .order('data_ocorrencia', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limite)

      if (error) throw error

      res.status(200).json(data)
    } catch (error) {
      console.error('Erro ao buscar ocorrências:', error)
      res.status(500).json({ error: error.message })
    }
  } else if (req.method === 'POST') {
    try {
      const {
        data_ocorrencia,
        categoria,
        impacto,
        codigo_eap,
        grupo,
        dias_atraso_estimado,
        descricao,
      } = req.body || {}

      if (!data_ocorrencia || !categoria || !impacto || !descricao) {
        return res.status(400).json({ error: 'Preencha data, categoria, impacto e descrição.' })
      }

      if (!IMPACTOS_VALIDOS.includes(impacto)) {
        return res.status(400).json({ error: 'Impacto inválido. Use baixo, medio ou alto.' })
      }

      const payload = {
        obra_id: 'flats_pampulha',
        data_ocorrencia,
        categoria,
        impacto,
        codigo_eap: codigo_eap || null,
        grupo: grupo || null,
        dias_atraso_estimado: parseInt(dias_atraso_estimado) || 0,
        descricao,
      }

      const { data, error } = await supabase
        .from('ocorrencias_obra')
        .insert([payload])
        .select()
        .single()

      if (error) throw error

      res.status(201).json(data)
    } catch (error) {
      console.error('Erro ao criar ocorrência:', error)
      res.status(500).json({ error: error.message })
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).json({ error: 'Method not allowed' })
  }
}
