import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { DISCIPLINAS, CURVA_PLANEJADA, monthIdx, fmtMoeda } from '../lib/constants'

Chart.register(...registerables)

export default function Dashboard({ updates, selectedId, onSelectId }) {
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  const cur = updates.find(u => u.id === selectedId) || updates.at(-1)

  // Monta os dados da Curva S
  useEffect(() => {
    if (!chartRef.current || !cur) return
    if (chartInst.current) { chartInst.current.destroy() }

    const selDate = cur.data
    const realFis = CURVA_PLANEJADA.map(row => {
      const us = updates.filter(u => monthIdx(u.data) === row.idx && u.data <= selDate)
      const u = us.at(-1)
      return u ? u.avanco_real : null
    })
    const realFin = CURVA_PLANEJADA.map(row => {
      const us = updates.filter(u => monthIdx(u.data) === row.idx && u.data <= selDate)
      const u = us.at(-1)
      return u ? +(u.custo_real / u.orcamento * 100).toFixed(1) : null
    })

    const isDark = window.matchMedia('(prefers-color-scheme:dark)').matches
    const gc = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
    const tc = isDark ? '#aaa' : '#888'

    chartInst.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: CURVA_PLANEJADA.map(r => r.mes),
        datasets: [
          { label: 'Físico plan.', data: CURVA_PLANEJADA.map(r => r.pf), borderColor: '#B0AEA6', borderWidth: 1.5, borderDash: [5,3], pointRadius: 0, fill: false, tension: 0.3, spanGaps: false },
          { label: 'Fin. plan.',   data: CURVA_PLANEJADA.map(r => r.pn), borderColor: '#9AB8E8', borderWidth: 1.5, borderDash: [3,3], pointRadius: 0, fill: false, tension: 0.3, spanGaps: false },
          { label: 'Físico real',  data: realFis, borderColor: '#C8860A', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#C8860A', fill: false, tension: 0.3, spanGaps: false },
          { label: 'Fin. real',    data: realFin, borderColor: '#B03030', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#B03030', fill: false, tension: 0.3, spanGaps: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => c.dataset.label + ': ' + (c.parsed.y != null ? c.parsed.y.toFixed(1) + '%' : '—') } },
        },
        scales: {
          x: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, autoSkip: false } },
          y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: v => v + '%' }, min: 0, max: 100 },
        },
      },
    })
  }, [updates, selectedId])

  useEffect(() => { return () => { if (chartInst.current) chartInst.current.destroy() } }, [])

  if (!cur) {
    return (
      <div className="empty-state">
        <h3>Nenhuma atualização lançada ainda.</h3>
        <p>Use a aba "Lançar atualização" para registrar o primeiro período.</p>
      </div>
    )
  }

  const diffFis = cur.avanco_real - cur.avanco_plan
  const finPct  = (cur.custo_real / cur.orcamento * 100).toFixed(1)
  const devFin  = cur.projecao - cur.orcamento

  const kpis = [
    { label: 'Avanço físico real', value: cur.avanco_real + '%', sub: 'Planejado: ' + cur.avanco_plan + '% · ' + (diffFis >= 0 ? '+' : '') + diffFis + '%', acent: diffFis < 0 ? '#C8860A' : '#4D9B6A', color: diffFis < 0 ? '#8A5D00' : '#2E6E48' },
    { label: 'Desvio de prazo',    value: (cur.desvio_dias > 0 ? '+' : '') + cur.desvio_dias + ' dias', sub: 'Semana ' + (cur.semana || '—') + ' de 52', acent: cur.desvio_dias < 0 ? '#B03030' : '#4D9B6A', color: cur.desvio_dias < 0 ? '#922020' : '#2E6E48' },
    { label: 'Custo realizado',    value: fmtMoeda(cur.custo_real), sub: finPct + '% do orçamento', acent: '#B03030', color: '#922020' },
    { label: 'Projeção final',     value: fmtMoeda(cur.projecao),   sub: 'Orçado: ' + fmtMoeda(cur.orcamento) + ' · ' + (devFin >= 0 ? '+' : '') + fmtMoeda(devFin), acent: '#4361C2', color: '#185FA5' },
  ]

  const disc = cur.disciplinas || []

  return (
    <div>
      {/* KPIs */}
      <div className="kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="kpi" style={{ borderLeftColor: k.acent }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Curva S */}
      <div className="card">
        <div className="card-title">Curva S — avanço físico e financeiro acumulado (%)</div>
        <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.55 }}>
          Quando o custo (vermelho) sobe mais rápido que o físico (laranja), está se gastando mais do que produzindo.
        </p>
        <div className="legend">
          {[['#B0AEA6','Físico planejado'],['#C8860A','Físico realizado'],['#9AB8E8','Fin. planejado'],['#B03030','Fin. realizado']].map(([c,l]) => (
            <span key={l}><span className="legend-dot" style={{ background: c }}></span>{l}</span>
          ))}
        </div>
        <div style={{ position: 'relative', height: 230 }}>
          <canvas ref={chartRef} aria-label="Curva S de avanço físico e financeiro acumulado" role="img" />
        </div>
      </div>

      {/* Duas colunas */}
      <div className="two-col">
        {/* Barras de disciplina */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title">Avanço físico por disciplina</div>
          {DISCIPLINAS.map((d, i) => {
            const di = disc[i] || {}
            const fr = di.fr || 0, fp = di.fp || 0, diff = fr - fp
            const bc = diff >= 0 ? '#4D9B6A' : diff >= -8 ? '#C8860A' : '#B03030'
            return (
              <div key={d.key} className="prog-row">
                <div className="prog-lbl">{d.label}</div>
                <div className="prog-track">
                  <div className="prog-fill" style={{ width: Math.min(100, fr) + '%', background: bc }} />
                  {fp > 0 && <div className="prog-mark" style={{ left: Math.min(100, fp) + '%' }} />}
                </div>
                <div className="prog-pct">{fr}%</div>
                <div className={`prog-delta ${diff >= 0 ? 'pos' : 'neg'}`}>{diff >= 0 ? '+' : ''}{diff}%</div>
              </div>
            )
          })}
        </div>

        {/* Resumo + notas */}
        <div>
          <div className="card">
            <div className="card-title">Resumo do período</div>
            {[
              { label: 'Data do lançamento', val: new Date(cur.data + 'T12:00:00').toLocaleDateString('pt-BR'), color: null },
              { label: 'Desvio físico acumulado', val: (diffFis >= 0 ? '+' : '') + diffFis + '%', color: diffFis >= 0 ? '#2E6E48' : '#922020' },
              { label: 'Custo vs previsto',        val: fmtMoeda(cur.custo_real - cur.orcamento * (cur.avanco_real / 100)), color: '#922020' },
              { label: 'Projeção vs orçamento',    val: (devFin >= 0 ? '+' : '') + fmtMoeda(devFin), color: devFin > 0 ? '#922020' : '#2E6E48' },
            ].map(it => (
              <div key={it.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '.5px solid var(--border)' }}>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>{it.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: it.color || 'var(--text)' }}>{it.val}</span>
              </div>
            ))}
          </div>
          {cur.notas && (
            <div className="card">
              <div className="card-title">Observações</div>
              <div className="notas-box">{cur.notas}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabela financeira */}
      <div className="card">
        <div className="card-title">Desvio financeiro por disciplina (R$ mil)</div>
        <table>
          <thead>
            <tr>
              <th style={{ width: '20%' }}>Disciplina</th>
              <th style={{ width: '16%' }}>Orçado</th>
              <th style={{ width: '16%' }}>Realizado</th>
              <th style={{ width: '18%' }}>Desvio</th>
              <th style={{ width: '12%' }}>%</th>
              <th style={{ width: '18%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {DISCIPLINAS.map((d, i) => {
              const di = disc[i] || {}
              const fn = di.fn || 0, orc = d.orc
              const dev = fn - orc
              const dp = +(dev / orc * 100).toFixed(1)
              const cls = dev > orc * 0.1 ? 'badge-bad' : dev > 0 ? 'badge-warn' : dev < 0 ? 'badge-ok' : 'badge-gray'
              const lbl = cls === 'badge-bad' ? 'Crítico' : cls === 'badge-warn' ? 'Alerta' : cls === 'badge-ok' ? 'No orçamento' : '—'
              return (
                <tr key={d.key}>
                  <td>{d.label}</td>
                  <td>{fmtMoeda(orc)}</td>
                  <td>{fmtMoeda(fn)}</td>
                  <td style={{ color: dev > 0 ? '#922020' : '#2E6E48', fontWeight: 600 }}>{dev >= 0 ? '+' : ''}{fmtMoeda(dev)}</td>
                  <td style={{ color: dev > 0 ? '#922020' : '#2E6E48' }}>{dp >= 0 ? '+' : ''}{dp}%</td>
                  <td><span className={`badge ${cls}`}>{lbl}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
