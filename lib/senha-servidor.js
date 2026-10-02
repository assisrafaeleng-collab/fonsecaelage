// Confere a senha de lançamento nas rotas que gravam (somente servidor).
// A senha vem no cabeçalho "x-dashboard-senha" e é comparada com DASHBOARD_SENHA.
// Sem DASHBOARD_SENHA configurada, toda gravação é recusada.
import crypto from 'crypto'

if (typeof window !== 'undefined') {
  throw new Error('lib/senha-servidor.js é só para o servidor (pages/api).')
}

// Devolve true se a senha confere; senão já responde 401/500 e devolve false.
// Uso no início da rota: if (req.method !== 'GET' && !senhaOk(req, res)) return
export function senhaOk(req, res) {
  const esperada = process.env.DASHBOARD_SENHA
  if (!esperada) {
    res.status(500).json({ error: 'DASHBOARD_SENHA não configurada no servidor. Gravação bloqueada.' })
    return false
  }
  const recebida = String(req.headers['x-dashboard-senha'] || '')
  // compara os hashes para ter o mesmo tamanho e tempo constante
  const a = crypto.createHash('sha256').update(recebida).digest()
  const b = crypto.createHash('sha256').update(esperada).digest()
  if (!recebida || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Senha de lançamento incorreta ou não informada.' })
    return false
  }
  return true
}
