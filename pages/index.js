import { useState, useEffect } from 'react'
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
        background: '#1b1b20', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12,
        padding: 32, width: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#eeeef2', marginBottom: 8 }}>
          Área Restrita
        </div>
        <div style={{ fontSize: 12, color: '#9a9aa6', marginBottom: 20 }}>
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
            background: '#131316', border: `1px solid ${erro ? '#d6453c' : 'rgba(255,255,255,0.14)'}`,
            color: '#eeeef2', outline: 'none', marginBottom: 8, boxSizing: 'border-box'
          }}
        />
        {erro && <div style={{ color: '#d6453c', fontSize: 12, marginBottom: 8 }}>Senha incorreta. Tente novamente.</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={handleConfirmar}
            style={{
              flex: 1, background: '#e0a93b', color: '#131316', border: 'none',
              borderRadius: 6, padding: '10px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}
          >
            Entrar
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: 'transparent', color: '#9a9aa6',
              border: '1px solid rgba(255,255,255,0.14)', borderRadius: 6, padding: '10px',
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
  const [mesAtual, setMesAtual] = useState(null)
  const [modal, setModal] = useState(null)

  // Obra: Jul/2026 a Fev/2028 (20 meses)
  const NOMES_MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const mesesOpcoes = Array.from({ length: 20 }, (_, i) => {
    // M01 = Jul/2026 (month index 6)
    const totalMonths = 6 + i  // 6=jul, 7=ago, ...
    const ano = 2026 + Math.floor(totalMonths / 12)
    const mes = totalMonths % 12
    return {
      valor: i + 1,
      label: `${NOMES_MESES[mes]}. de ${ano}`
    }
  })

  useEffect(() => {
    fetch('/api/custos?resumo=competencias')
      .then(r => r.json())
      .then(competencias => {
        if (!competencias?.length) {
          setMesAtual(20)
          return
        }

        const MESES_PT = { janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 }
        function toDate(comp) {
          if (!comp) return null
          if (comp.match(/^\d{4}-\d{2}/)) return new Date(comp.slice(0, 7) + '-01')
          const m = comp.match(/^([a-záéíóúãõç]+)\/(\d{4})$/i)
          if (m) {
            const mes = MESES_PT[m[1].toLowerCase()]
            if (mes) return new Date(`${m[2]}-${String(mes).padStart(2,'0')}-01`)
          }
          return null
        }

        const datas = competencias.map(c => ({ comp: c, date: toDate(c) })).filter(x => x.date)
        if (!datas.length) { setMesAtual(20); return }

        const maisRecente = datas.sort((a, b) => b.date - a.date)[0].date

        // Obra começa Jul/2026 = M1
        const inicioObra = new Date('2026-07-01')
        const diffMeses = (maisRecente.getFullYear() - inicioObra.getFullYear()) * 12
                        + (maisRecente.getMonth() - inicioObra.getMonth()) + 1

        const mesCalculado = Math.max(1, Math.min(20, diffMeses))
        setMesAtual(mesCalculado)
      })
      .catch(() => setMesAtual(20))
  }, [])

  function handleNavRestrita(destino) {
    if (sessionStorage.getItem('autenticado') === 'true') {
      window.location.href = destino
    } else {
      setModal(destino)
    }
  }

  if (mesAtual === null) {
    return <div className="page"><div className="loading">Carregando dashboard...</div></div>
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
              Orçamento: R\$ 5.904.213,83 · Prazo: 20 meses · Jul/2026 a Fev/2028 ·
              {mesAtual === 20 ? ' Período completo' : ` Até M${mesAtual}`}
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
                  {opcao.valor === 20 ? 'Todos os 20 meses' : opcao.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="nav">
          <button className="nav-btn active">Dashboard</button>
          <button className="nav-btn" onClick={() => handleNavRestrita('/custos')}>Lançamentos de Custos</button>
        </div>
      </div>

      <Dashboard mesLimite={mesAtual} onNavRestrita={handleNavRestrita} />
    </div>
  )
}
