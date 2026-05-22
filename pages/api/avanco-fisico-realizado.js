import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
  const obra_id = 'flats_pampulha'

  // GET - buscar lançamentos
  if (req.method === 'GET') {
    try {
      const { data: lancamentos, error } = await supabase
        .from('avanco_fisico_realizado')
        .select('*')
        .eq('obra_id', obra_id)
        .order('competencia', { ascending: false })
        .order('atividade_nome')

      if (error) throw new Error(error.message)
      return res.status(200).json({ lancamentos, obra_id })
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao buscar dados', message: error.message })
    }
  }

  // POST - salvar lançamentos
  if (req.method === 'POST') {
    try {
      const { competencia, mes_numero, atividades } = req.body
      if (!competencia || !atividades?.length) {
        return res.status(400).json({ error: 'Dados inválidos' })
      }

      // Deletar lançamentos existentes do mesmo mês antes de inserir
      await supabase
        .from('avanco_fisico_realizado')
        .delete()
        .eq('obra_id', obra_id)
        .eq('competencia', competencia)

      const registros = atividades.map(a => ({
        obra_id,
        competencia,
        mes_numero,
        atividade_nome: a.nome,
        percentual_realizado: parseFloat(a.percentual) / 100,
        observacao: a.observacao || null
      }))

      const { error } = await supabase
        .from('avanco_fisico_realizado')
        .insert(registros)

      if (error) throw new Error(error.message)
      return res.status(200).json({ success: true, quantidade: registros.length })
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao salvar dados', message: error.message })
    }
  }

  // DELETE - excluir lançamento por id
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body
      if (!id) return res.status(400).json({ error: 'ID não informado' })
      const { error } = await supabase
        .from('avanco_fisico_realizado')
        .delete()
        .eq('id', id)
        .eq('obra_id', obra_id)
      if (error) throw new Error(error.message)
      return res.status(200).json({ success: true })
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao excluir', message: error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
