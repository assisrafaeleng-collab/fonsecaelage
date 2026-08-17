// components/CurvaFisicaSemanal.jsx
// Card da curva fisica semanal com ZOOM por mes (seletor M1..M20).
import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const TOTAL_MESES = 20

export default function CurvaFisicaSemanal({ obra_id = 'flats_pampulha' }) {
  const [mes, setMes] = useState(1)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    setDados(null); setErro(null)
    fetch(`/api/curva-fisica-semanal?obra_id=${obra_id}&mes=${mes}`)
      .then(r => r.json())
      .then(d => { if (d.error) setErro(d.error); else setDados(d) })
      .catch(() => setErro('Erro ao carregar curva semanal'))
  }, [obra_id, mes])

  const seletor = (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
      <span style={{ fontSize: 12, color: '#6d675e', marginRight: 4 }}>Mês:</span>
      {Array.from({ length: TOTAL_MESES }, (_, i) => i + 1).map(m => (
        <button key={m} onClick={() => setMes(m)}
          style={{
            padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
            border: m === mes ? '1.5px solid #4a8fe0' : '1px solid #2a2a31',
            background: m === mes ? 'rgba(74,143,224,0.12)' : 'transparent',
            color: m === mes ? '#4a8fe0' : '#a09a90', fontWeight: m === mes ? 600 : 400,
          }}>M{m}</button>
      ))}
    </div>
  )

  if (erro) return <div className="card"><div className="card-title">Curva Física Semanal</div>{seletor}<div style={{ color:'#d6453c', fontSize:13 }}>{erro}</div></div>
  if (!dados) return <div className="card"><div className="card-title">Curva Física Semanal</div>{seletor}<div style={{ color:'#9a9aa6', fontSize:13 }}>Carregando...</div></div>

  const semanas = dados.semanas || []
  const resumo = dados.resumo || { realizado: 0, planejado: 0, desvio: 0, semana_critica: null }
  const labels = semanas.map(s => `Sem ${s.semana_do_mes}`)
  const plan = semanas.map(s => s.planejado)
  const real = semanas.map(s => s.realizado)
  const temReal = real.some(v => v != null)

  const chartData = {
    labels,
    datasets: [
      { label: 'Planejado', data: plan, borderColor: '#6f86c9', borderDash: [5,4], borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#6f86c9', tension: 0.25, fill: false },
      { label: 'Realizado', data: real, borderColor: '#4a8fe0', borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 7, pointBackgroundColor: '#4a8fe0', tension: 0.25, fill: false, spanGaps: false },
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
          label: (c) => c.parsed.y == null ? null : `${c.dataset.label}: ${c.parsed.y.toFixed(1)}%`,
          afterBody: (items) => {
            const p = items.find(i => i.dataset.label === 'Planejado')
            const r = items.find(i => i.dataset.label === 'Realizado')
            if (!p || !r || r.parsed.y == null) return null
            return `Desvio: ${(r.parsed.y - p.parsed.y).toFixed(1)}%`
          }
        }
      }
    },
    scales: {
      y: { ticks: { color:'#9a9aa6', font:{size:10}, callback:(v)=>`${v}%` }, grid:{ color:'rgba(255,255,255,0.06)' }, title:{ display:true, text:'Avanço no mês (%)', color:'#9a9aa6', font:{size:11} } },
      x: { ticks: { color:'#9a9aa6', font:{size:11} }, grid:{ display:false } }
    }
  }

  const card = (label, valor, cor) => (
    <div style={{ background:'#141418', borderRadius:8, padding:'10px 12px' }}>
      <div style={{ fontSize:10, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color:cor }}>{valor}</div>
    </div>
  )

  return (
    <div className="card">
      <div className="card-title">Curva Física Semanal — Zoom por Mês</div>
      {seletor}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:14 }}>
        {card('Realizado no mês', temReal ? `${resumo.realizado.toFixed(1)}%` : '-', '#4a8fe0')}
        {card('Planejado no mês', `${resumo.planejado.toFixed(1)}%`, '#6f86c9')}
        {card('Desvio do mês', temReal ? `${resumo.desvio >= 0 ? '+' : ''}${resumo.desvio.toFixed(1)}%` : '-', temReal ? (resumo.desvio >= 0 ? '#3f9e6c' : '#d6453c') : '#6d675e')}
        {card('Semana crítica', resumo.semana_critica ? `Sem ${resumo.semana_critica}` : '—', '#ece9e4')}
      </div>

      <div style={{ display:'flex', gap:18, marginBottom:8 }}>
        <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#9a9aa6' }}>
          <span style={{ width:16, height:0, borderTop:'2px solid #4a8fe0' }}></span>Realizado</span>
        <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#9a9aa6' }}>
          <span style={{ width:16, height:0, borderTop:'2px dashed #6f86c9' }}></span>Planejado</span>
      </div>

      <div style={{ height:300, position:'relative' }}>
        <Line data={chartData} options={chartOptions} />
      </div>

      {!temReal && (
        <div style={{ fontSize:11, color:'#6d675e', marginTop:8, fontStyle:'italic' }}>
          Sem lançamentos de avanço neste mês ainda. A linha de realizado aparece conforme você lança.
        </div>
      )}
    </div>
  )
}
