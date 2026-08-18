import { supabase } from '../../../lib/supabase'

const IMPACTOS_VALIDOS = ['baixo', 'medio', 'alto']

export default async function handler(req, res) {
  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'ID da ocorrência não informado.' })
  }

  if (req.method === 'PATCH') {
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
        .update(payload)
        .eq('id', id)
        .eq('obra_id', 'flats_pampulha')
        .select()
        .single()

      if (error) throw error

      return res.status(200).json(data)
    } catch (error) {
      console.error('Erro ao atualizar ocorrência:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('ocorrencias_obra')
        .delete()
        .eq('id', id)
        .eq('obra_id', 'flats_pampulha')

      if (error) throw error

      return res.status(200).json({ ok: true })
    } catch (error) {
      console.error('Erro ao excluir ocorrência:', error)
      return res.status(500).json({ error: error.message })
    }
  }

  res.setHeader('Allow', ['PATCH', 'DELETE'])
  return res.status(405).json({ error: 'Method not allowed' })
}
