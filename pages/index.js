import { useState } from 'react'
import Dashboard from '../components/Dashboard'

const SENHA_CORRETA = 'fonseca2025'

function ModalSenha({ destino, onClose }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)

  function handleConfirmar() {
    if (senha === SENHA_CORRETA) {
      sessionStorage.setItem('autenticado', 'true')
      window.location.href = destino
    } else {
      setErro(true)
      setSenha('')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: '#1E1E1E', border: '1px solid #2A2A2A', borderRadius: 12,
        padding: 32, width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#E8E8E8', marginBottom: 8 }}>
          🔒 Área Restrita
        </div>
        <div style={{ fontSize: 12, color: '#A8A8A8', marginBottom: 20 }}>
          Digite a senha para acessar esta área.
        </div>
        <input
          type="password"
          value={senha}
          onChange={e => { setSenha(e.target.value); setErro(false) }}
          onKeyDown={e => e.key === 'Enter' && handleConfirmar()}
          placeholder="Senha"
          autoFocus
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 6, fontSize: 14,
            background: '#141414', border: `1px solid ${erro ? '#B03030' : '#2A2A2A'}`,
            color: '#E8E8E8', outline: 'none', marginBottom: 8, boxSizing: 'border-box'
          }}
        />
        {erro && <div style={{ color: '#B03030', fontSize: 12, marginBottom: 8 }}>Senha incorreta. Tente novamente.</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={handleConfirmar}
            style={{
              flex: 1, background: '#C8860A', color: 'white', border: 'none',
              borderRadius: 6, padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}
          >
            Entrar
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: 'transparent', color: '#A8A8A8',
              border: '1px solid #2A2A2A', borderRadius: 6, padding: '10px',
              fontSize: 14, cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [mesAtual, setMesAtual] = useState(18)
  const [modal, setModal] = useState(null)

  const mesesOpcoes = Array.from({ length: 18 }, (_, i) => {
    const data = new Date(2025, 3 + i, 1)
    return {
      valor: i + 1,
      label: data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    }
  })

  function handleNavRestrita(destino) {
    if (sessionStorage.getItem('autenticado') === 'true') {
      window.location.href = destino
    } else {
      setModal(destino)
    }
  }

  return (
    <div className="page">
      {modal && <ModalSenha destino={modal} onClose={() => setModal(null)} />}

      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">Av. Coronel José Dias Bicalho, 635 · São José · Belo Horizonte</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">
              Orçamento: R$ 4.920.564 · Prazo: 18 meses ·
              {mesAtual === 18 ? ' Período completo' : ` Até M${mesAtual}`}
            </div>
          </div>

          <div className="sel-wrap">
            <div className="sel-lbl">Período</div>
            <select
              className="periodo"
              value={mesAtual}
              onChange={(e) => setMesAtual(parseInt(e.target.value))}
            >
              {mesesOpcoes.map(opcao => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.valor === 18 ? 'Todos os 18 meses' : opcao.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="nav">
          <button className="nav-btn active">📊 Dashboard</button>
          <button className="nav-btn" onClick={() => handleNavRestrita('/custos')}>💰 Lançamentos de Custos</button>
        </div>
      </div>

      <Dashboard mesLimite={mesAtual} onNavRestrita={handleNavRestrita} />
    </div>
  )
}