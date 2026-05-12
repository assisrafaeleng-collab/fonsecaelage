import { useState } from 'react'
import { DISCIPLINAS, fmtMoeda } from '../lib/constants'

const blank = () => ({
  data: new Date().toISOString().slice(0, 10),
  semana: '',
  orcamento: 15000,
  avanco_real: '',
  avanco_plan: '',
  desvio_dias: '',
  custo_real: '',
  projecao: '',
  notas: '',
  disc: DISCIPLINAS.map(d => ({ ...d, fr: '', fp: '', fn: '' })),
})

export default function UpdateForm({ onSaved }) {
  const [form, setForm] = useState(blank())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setDisc  = (key, field, v) => setForm(f => ({ ...f, disc: f.disc.map(d => d.key === key ? { ...d, [field]: v } : d) }))

  const handleSubmit = async () => {
    if (!form.data || form.avanco_real === '' || form.custo_real === '') {
      setErr('Preencha pelo menos: data, avanço físico realizado e custo realizado.')
      return
    }
    setSaving(true)
    setErr('')

    const payload = {
      data:        form.data,
      semana:      parseInt(form.semana) || null,
      orcamento:   parseFloat(form.orcamento) || 15000,
      avanco_real: parseFloat(form.avanco_real),
      avanco_plan: parseFloat(form.avanco_plan) || 0,
      desvio_dias: parseInt(form.desvio_dias) || 0,
      custo_real:  parseFloat(form.custo_real),
      projecao:    parseFloat(form.projecao) || parseFloat(form.custo_real),
      notas:       form.notas,
      disciplinas: form.disc.map(d => ({
        key: d.key, label: d.label, orc: d.orc,
        fr: parseFloat(d.fr) || 0,
        fp: parseFloat(d.fp) || 0,
        fn: parseFloat(d.fn) || 0,
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
        <div className="form-section-title">1. Identificação</div>
        <div className="form-grid-3">
          <div className="field"><label>Data da atualização</label><input type="date" value={form.data} onChange={e => setField('data', e.target.value)} /></div>
          <div className="field"><label>Semana da obra</label><input type="number" placeholder="ex: 38" value={form.semana} onChange={e => setField('semana', e.target.value)} /></div>
          <div className="field"><label>Orçamento total (R$ mil)</label><input type="number" value={form.orcamento} onChange={e => setField('orcamento', e.target.value)} /></div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">2. Avanço físico geral</div>
        <div className="form-grid-3">
          <div className="field"><label>Avanço realizado (%)*</label><input type="number" placeholder="ex: 62" value={form.avanco_real} onChange={e => setField('avanco_real', e.target.value)} /></div>
          <div className="field"><label>Avanço planejado para esta data (%)</label><input type="number" placeholder="ex: 68" value={form.avanco_plan} onChange={e => setField('avanco_plan', e.target.value)} /></div>
          <div className="field"><label>Desvio de prazo (dias — use − para atraso)</label><input type="number" placeholder="ex: -18" value={form.desvio_dias} onChange={e => setField('desvio_dias', e.target.value)} /></div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">3. Avanço físico por disciplina (%)</div>
        <div className="disc-grid-hdr"><div>Disciplina</div><div>% Realizado</div><div>% Planejado</div><div></div></div>
        {form.disc.map(d => (
          <div key={d.key} className="disc-grid-row">
            <div style={{ color: 'var(--text)' }}>{d.label}</div>
            <input type="number" placeholder="Realizado %" value={d.fr} onChange={e => setDisc(d.key, 'fr', e.target.value)} />
            <input type="number" placeholder="Planejado %" value={d.fp} onChange={e => setDisc(d.key, 'fp', e.target.value)} />
            <div></div>
          </div>
        ))}
      </div>

      <div className="form-section">
        <div className="form-section-title">4. Avanço financeiro</div>
        <div className="form-grid-2" style={{ marginBottom: 14 }}>
          <div className="field"><label>Custo total realizado até esta data (R$ mil)*</label><input type="number" placeholder="ex: 8700" value={form.custo_real} onChange={e => setField('custo_real', e.target.value)} /></div>
          <div className="field"><label>Projeção de custo final da obra (R$ mil)</label><input type="number" placeholder="ex: 15900" value={form.projecao} onChange={e => setField('projecao', e.target.value)} /></div>
        </div>
        <div className="disc-grid-hdr"><div>Disciplina</div><div>Orçado</div><div>Realizado (R$ mil)</div><div></div></div>
        {form.disc.map(d => (
          <div key={d.key} className="disc-grid-row">
            <div style={{ color: 'var(--text)' }}>{d.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmtMoeda(d.orc)}</div>
            <input type="number" placeholder="R$ mil" value={d.fn} onChange={e => setDisc(d.key, 'fn', e.target.value)} />
            <div></div>
          </div>
        ))}
      </div>

      <div className="form-section">
        <div className="form-section-title">5. Observações do período</div>
        <textarea placeholder="Descreva os principais desvios, riscos ou ocorrências do período…" value={form.notas} onChange={e => setField('notas', e.target.value)} />
      </div>

      <div className="btn-row">
        <button className="btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Salvando…' : 'Salvar atualização'}</button>
        <button className="btn-secondary" onClick={() => setForm(blank())}>Limpar</button>
      </div>
    </div>
  )
}
