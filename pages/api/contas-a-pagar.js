// pages/api/contas-a-pagar.js
// Card de contas a pagar: titulos sem pagamento com vencimento a partir do
// mes do fechamento (recorrentes ficam fora, ja na carga). Separado do
// custo realizado (nao entra no IPC como realizado; o IPC soma o a pagar do
// direto a parte).
//   ?resumo=1        so os totais (o card); sem ele vem a lista de titulos
//   ?fechamento=AAAA-MM  um fechamento especifico (padrao: o mais recente)
import { supabase } from '../../lib/supabase'
import { carregarContasAPagar, resumirContas } from '../../lib/contas-a-pagar'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const obra_id = req.query.obra_id || 'flats_pampulha'
  const fechamento = /^\d{4}-\d{2}$/.test(req.query.fechamento || '') ? req.query.fechamento : null

  try {
    const c = await carregarContasAPagar(supabase, obra_id, fechamento)
    if (!c.disponivel) return res.status(200).json({ disponivel: false, motivo: c.motivo })
    const r = resumirContas(c.linhas)
    const base = {
      disponivel: true,
      fechamento: c.fechamento,
      // Horizonte (decisao out/26): vencimentos a partir do mes do fechamento
      vencimentos_a_partir_de: c.fechamento,
      ultimo_vencimento: r.por_mes.length ? r.por_mes[r.por_mes.length - 1].mes : null,
      por_mes: r.por_mes,
      importado_em: c.linhas[0] ? c.linhas[0].importado_em : null,
      totais: r.totais,
      n_titulos: r.n_titulos,
      n_alertas: r.n_alertas,
    }
    return res.status(200).json(req.query.resumo ? base : { ...base, titulos: r.titulos })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
