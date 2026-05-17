import { useState } from 'react'
import { DISCIPLINAS, fmtMoeda } from '../lib/constants'

const blank = () => ({
  data: new Date().toISOString().slice(0, 10),
  semana: '',
  notas: '',
  disc: DISCIPLINAS.map(d => ({ ...d, fr: '' })),
})

export default function UpdateForm({ onSaved }) {
  const [form, setForm] = useState(blank())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setDisc  = (key, v) => setForm(f => ({ ...f, disc: f.disc.map(d => d.key === key ? { ...d, fr: v } : d) }))

  const handleSubmit = async () => {
    if (!form.data) {
      setErr('Preencha pelo menos a data da atualização.')
      return
    }
    
    // Calcular avanço físico médio ponderado
    const totalOrc = DISCIPLINAS.reduce((sum, d) => sum + d.orc, 0)
    const avanco_real = form.disc.reduce((sum, d) => {
      const fr = parseFloat(d.fr) || 0
      const peso = d.orc / totalOrc
      return sum + (fr * peso)
    }, 0)

    if (avanco_real === 0) {
      setErr('Preencha pelo menos um avanço físico.')
      return
    }

    setSaving(true)
    setErr('')

    const payload = {
      data: form.data,
      semana: parseInt(form.semana) || null,
      avanco_real: parseFloat(avanco_real.toFixed(2)),
      notas: form.notas,
      disciplinas: form.disc.map(d => ({
        key: d.key, 
        label: d.label, 
        orc: d.orc,
        fr: parseFloat(d.fr) || 0,
      })),
    }

    const res = await fetch('/api/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      setErr('Erro ao salvar. Tente novamente.')
      setSaving(false)
      return
    }

    setSaving(false)
    setForm(blank())
    onSaved()
  }

  return (
    <div>
      {err && <div className="toast toast-err">{err}</div>}

      <div className="form-section">
        <div className="form-section-title">1. Identificação do período</div>
        <div className="form-grid-2">
          <div className="field">
            <label>Data da medição</label>
            <input 
              type="date" 
              value={form.data} 
              onChange={e => setField('data', e.target.value)} 
            />
          </div>
          <div className="field">
            <label>Semana da obra (opcional)</label>
            <input 
              type="number" 
              placeholder="ex: 38" 
              value={form.semana} 
              onChange={e => setField('semana', e.target.value)} 
            />
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text2)', marginTop: 10 }}>
          💡 Os custos financeiros são calculados automaticamente a partir das planilhas importadas em /custos
        </p>
      </div>

      <div className="form-section">
        <div className="form-section-title">2. Avanço físico executado por disciplina (%)</div>
        <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12 }}>
          Informe o percentual de conclusão de cada disciplina até esta data.
        </p>
        <div className="disc-grid-hdr-simple">
          <div>Disciplina</div>
          <div>Orçado (R$ mil)</div>
          <div>% Executado</div>
        </div>
        {form.disc.map(d => (
          <div key={d.key} className="disc-grid-row-simple">
            <div style={{ color: 'var(--text)', fontSize: 12 }}>{d.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtMoeda(d.orc)}</div>
            <input 
              type="number" 
              placeholder="%" 
              min="0"
              max="100"
              value={d.fr} 
              onChange={e => setDisc(d.key, e.target.value)} 
            />
          </div>
        ))}
      </div>

      <div className="form-section">
        <div className="form-section-title">3. Observações do período (opcional)</div>
        <textarea 
          placeholder="Descreva os principais eventos, desvios ou ocorrências do período…" 
          value={form.notas} 
          onChange={e => setField('notas', e.target.value)} 
        />
      </div>

      <div className="btn-row">
        <button 
          className="btn-primary" 
          onClick={handleSubmit} 
          disabled={saving}
        >
          {saving ? 'Salvando…' : '✓ Salvar medição'}
        </button>
        <button 
          className="btn-secondary" 
          onClick={() => setForm(blank())}
        >
          Limpar
        </button>
      </div>
    </div>
  )
}