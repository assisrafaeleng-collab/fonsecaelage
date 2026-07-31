// components/CurvaFisicaSemanal.jsx
// Card isolado: curva fisica SEMANAL (planejado vs realizado). Le /api/curva-fisica-semanal.
import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

export default function CurvaFisicaSemanal({ obra_id = 'flats_pampulha' }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    fetch(`/api/curva-fisica-semanal?obra_id=${obra_id}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErro(d.error); else setDados(d) })
      .catch(() => setErro('Erro ao carregar curva semanal'))
  }, [obra_id])

  if (erro) return (
    <div className="card"><div className="card-title">Curva Física Semanal</div>
      <div style={{ color: '#d6453c', fontSize: 13, padding: 8 }}>{erro}</div></div>
  )
  if (!dados) return (
    <div className="card"><div className="card-title">Curva Física Semanal</div>
      <div style={{ color: '#9a9aa6', fontSize: 13, padding: 8 }}>Carregando curva semanal...</div></div>
  )

  const semanas = dados.semanas || []
  const labels = semanas.map(s => (s.semana % 4 === 0 || s.semana === 1) ? `S${s.semana}` : '')
  const plan = semanas.map(s => s.planejado)
  const real = semanas.map(s => s.realizado)

  // indicadores do momento atual (ultima semana com realizado)
  const ult = dados.ultima_semana_realizada || 0
  const pontoReal = ult > 0 ? semanas[ult - 1] : null
  const realAtual = pontoReal ? pontoReal.realizado : 0
  const planAtual = pontoReal ? pontoReal.planejado : 0
  const desvio = pontoReal ? (realAtual - planAtual) : 0

  const chartData = {
    labels,
    datasets: [
      { label: 'Físico Planejado', data: plan, borderColor: '#6f86c9', backgroundColor: 'rgba(111,134,201,0.08)', fill: false, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4, tension: 0.3 },
      { label: 'Físico Realizado', data: real, borderColor: '#4a8fe0', backgroundColor: 'rgba(74,143,224,0.12)', fill: true, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: 0.3, spanGaps: false },
    ]
  }

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(20,20,24,0.96)', titleColor: '#9a9aa6', bodyColor: '#9a9aa6',
        borderColor: 'rgba(255,255,255,0.14)', borderWidth: 1, padding: 12,
        callbacks: {
          title: (it) => `Semana ${it[0].dataIndex + 1} (M${Math.floor(it[0].dataIndex / 4) + 1})`,
          label: (c) => c.parsed.y == null ? null : `${c.dataset.label}: ${c.parsed.y.toFixed(1)}%`
        }
      }
    },
    scales: {
      y: { min: 0, max: 100, ticks: { color: '#9a9aa6', font: { size: 10 }, callback: (v) => `${v}%` }, grid: { color: 'rgba(255,255,255,0.06)' } },
      x: { ticks: { color: '#9a9aa6', font: { size: 9 }, maxRotation: 0, autoSkip: false }, grid: { color: 'rgba(255,255,255,0.04)' } }
    }
  }

  return (
    <div className="card">
      <div className="card-title">Curva Física Semanal — Planejado vs Realizado</div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', margin: '6px 0 4px' }}>
        <div>
          <div style={{ fontSize: 10, color: '#6d675e', textTransform: 'uppercase', letterSpacing: .5 }}>Semana atual</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>S{ult || '-'}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#6d675e', textTransform: 'uppercase', letterSpacing: .5 }}>Realizado</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#4a8fe0' }}>{realAtual != null ? realAtual.toFixed(1) : '-'}%</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#6d675e', textTransform: 'uppercase', letterSpacing: .5 }}>Planejado</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#6f86c9' }}>{planAtual != null ? planAtual.toFixed(1) : '-'}%</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#6d675e', textTransform: 'uppercase', letterSpacing: .5 }}>Desvio</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: desvio >= 0 ? '#3f9e6c' : '#d6453c' }}>
            {desvio >= 0 ? '+' : ''}{desvio.toFixed(1)}%
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', margin: '4px 0 6px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: "500 11px 'IBM Plex Sans'", color: '#9a9aa6' }}>
          <span style={{ width: 18, height: 0, borderTop: '2px solid #4a8fe0' }}></span>Físico realizado</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: "500 11px 'IBM Plex Sans'", color: '#9a9aa6' }}>
          <span style={{ width: 18, height: 0, borderTop: '2px dashed #6f86c9' }}></span>Físico planejado</span>
      </div>

      <div style={{ height: 360, position: 'relative' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  )
}
