import { useState, useEffect } from 'react'
import Dashboard from '../components/Dashboard'
import { normalizeCompetencia } from '../lib/competencia'
import { garantirSenha } from '../lib/fetch-com-senha'

export default function Home() {
  const [mesAtual, setMesAtual] = useState(null)

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

        const datas = competencias
          .map(c => {
            const comp = normalizeCompetencia(c)
            const date = comp ? new Date(`${comp}-01`) : null
            return { comp, date }
          })
          .filter(x => x.date && !Number.isNaN(x.date.getTime()))
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

  async function handleNavRestrita(destino) {
    if (await garantirSenha()) window.location.href = destino
  }

  if (mesAtual === null) {
    return <div className="page"><div className="loading">Carregando dashboard...</div></div>
  }

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">Av. Coronel José Dias Bicalho, 635 · São José · Belo Horizonte</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">
              Orçamento: R$ 6.042.209,73 · Prazo: 20 meses · Jul/2026 a Fev/2028 ·
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
          <button className="nav-btn" onClick={() => window.location.href = '/semanal'}>Acompanhamento semanal</button>
        </div>
      </div>

      <Dashboard mesLimite={mesAtual} onNavRestrita={handleNavRestrita} />
    </div>
  )
}
