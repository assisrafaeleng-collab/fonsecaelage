// pages/index.js
// 
// Página principal do dashboard COM FILTRO DE PERÍODO

import { useState } from 'react'
import Dashboard from '../components/Dashboard'

export default function Home() {
  const [mesAtual, setMesAtual] = useState(18) // Padrão: todos os 18 meses

  // Gerar opções de meses formatadas como Mês/Ano
  const dataInicio = new Date('2025-04-01') // M1 = Abril/2025
  const mesesOpcoes = Array.from({ length: 18 }, (_, i) => {
    const data = new Date(2025, 3 + i, 1) // Abril=3, fixo sem setMonth
    return {
      valor: i + 1,
      label: data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    }
  })
    }
  })

  return (
    <div className="page">
      {/* HEADER */}
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">OBRA PREDIAL - TORRE A</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">
              Orçamento: R$ 4.920.564 · Prazo: 18 meses · 
              {mesAtual === 18 ? ' Período completo' : ` Até M${mesAtual}`}
            </div>
          </div>
          
          {/* SELETOR DE PERÍODO */}
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
        </div>
      </div>

      {/* DASHBOARD COM FILTRO */}
      <Dashboard mesLimite={mesAtual} />
    </div>
  )
}
