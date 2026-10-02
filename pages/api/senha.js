// pages/api/senha.js
// POST — só confere a senha de lançamento (cabeçalho x-dashboard-senha).
// Não acessa o banco. Usada pelas telas para pedir a senha antes de abrir
// uma área ou formulário de lançamento.
import { senhaOk } from '../../lib/senha-servidor'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Método não permitido' })
  }
  if (!senhaOk(req, res)) return
  return res.status(200).json({ ok: true })
}
