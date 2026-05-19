// pages/index.js
// 
// Página principal do dashboard COM FILTRO DE PERÍODO

import { useState } from 'react'
import Dashboard from '../components/Dashboard'

export default function Home() {
  const [mesAtual, setMesAtual] = useState(18) // Padrão: todos os 18 meses

  // Gerar opções de meses
  const mesesOpcoes = Array.from({ length: 18 }, (_, i) => i + 1)

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
              {mesesOpcoes.map(mes => (
                <option key={mes} value={mes}>
                  {mes === 18 ? 'Todos os 18 meses' : `Até M${mes}`}
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
