// Pede a senha de lançamento DENTRO da página (sem janela do navegador) e libera as gravações enquanto a aba estiver
// aberta. A senha é conferida em /api/senha, que não acessa o banco.
import { useState } from 'react'
import { conferirSenha } from '../lib/fetch-com-senha'

export default function Desbloqueio({ onLiberar, onCancelar }) {
  const [senha, setSenha] = useState('')
  const [quem, setQuem] = useState('')
  const [erro, setErro] = useState(null)
  const [indo, setIndo] = useState(false)

  async function entrar() {
    if (!senha) { setErro('Informe a senha.'); return }
    setIndo(true); setErro(null)
    try {
      const r = await conferirSenha(senha)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha ao validar')
      onLiberar(quem)
    } catch (e) {
      setErro(e.message === 'Failed to fetch' ? 'Sem resposta do servidor.' : e.message)
    } finally { setIndo(false) }
  }

  return (
    <div className="form-section" style={{ marginBottom: 12 }}>
      <div className="form-section-title">Liberar gravação</div>
      <div className="form-grid-2">
        <div className="field">
          <label>Seu nome</label>
          <input type="text" value={quem} placeholder="Ex.: Rafael" onChange={(e) => setQuem(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && entrar()} />
        </div>
        <div className="field">
          <label>Senha de lançamento</label>
          <input type="password" value={senha} autoFocus onChange={(e) => setSenha(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && entrar()} />
        </div>
      </div>
      {erro && <div className="toast toast-err" style={{ marginTop: 10 }}>{erro}</div>}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn-primary" onClick={entrar} disabled={indo}>{indo ? 'Validando…' : 'Liberar'}</button>
        {onCancelar && <button className="btn-secondary" onClick={onCancelar} disabled={indo}>Cancelar</button>}
      </div>
    </div>
  )
}
