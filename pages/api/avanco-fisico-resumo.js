// pages/api/avanco-fisico-resumo.js
// Avanço de TODOS os itens de uma vez: a ÚLTIMA medição de cada linha (código + pavimento quando o código se
// repete por pavimento), a mesma regra do painel semanal (lib/medicao-linha.js). percentual_realizado é o
// ACUMULADO do item ("está em X%"), nunca incremento — antes esta rota somava as medições (decisão de 16/10/2026).
//   ?ate=AAAA-MM-DD  só medições até a data (inclusive); sem ela, todas
// Resposta: acumulados { 'codigo|pavimento': % } e medicoes { 'codigo|pavimento': { percentual, data, semana } }.
import { supabase } from '../../lib/supabase'
import { carregarMedicoes, chavesDeMedicao, ultimaMedicaoPorLinha } from '../../lib/medicao-linha'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = req.query.obra_id || 'flats_pampulha'
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.ate || '') ? req.query.ate : null

  const [orc, med] = await Promise.all([
    supabase.from('orcamento_planejado').select('cod_eap, pavimento').eq('obra_id', obra_id),
    carregarMedicoes(supabase, obra_id),
  ])
  if (orc.error) return res.status(500).json({ error: orc.error.message })
  if (med.error) return res.status(500).json({ error: med.error.message })

  const { chave } = chavesDeMedicao(orc.data || [])
  const acumulados = {}
  const medicoes = {}
  Object.values(ultimaMedicaoPorLinha(med.data, chave, ate)).forEach((r) => {
    const k = `${r.codigo_eap}|${r.pavimento}`
    acumulados[k] = parseFloat(r.percentual_realizado) || 0
    medicoes[k] = { percentual: acumulados[k], data: String(r.data_lancamento || '').slice(0, 10), semana: r.semana_numero }
  })
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ate, acumulados, medicoes })
}
