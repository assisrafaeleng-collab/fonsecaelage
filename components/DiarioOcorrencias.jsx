// components/DiarioOcorrencias.jsx
// Card colapsável no final do dashboard: lista as ocorrências mais recentes
// da obra e permite registrar uma nova (protegido pela mesma senha do app).

import { useEffect, useState } from 'react'

const SENHA_CORRETA = 'fonseca2025'

const CATEGORIAS = [
  'Atraso de fornecedor',
  'Chuva / Clima',
  'Falta de mão de obra',
  'Falta de material',
  'Retrabalho',
  'Problema de projeto/especificação',
  'Falha de equipamento',
  'Segurança do trabalho',
  'Outro',
]

const IMPACTO_LABEL = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' }
const IMPACTO_BADGE = { baixo: 'badge-ok', medio: 'badge-warn', alto: 'badge-bad' }

const blank = () => ({
  data_ocorrencia: new Date().toISOString().slice(0, 10),
  categoria: CATEGORIAS[0],
  impacto: 'baixo',
  codigo_eap: '',
  grupo: '',
  dias_atraso_estimado: '',
  descricao: '',
})

function ModalSenha({ onConfirmar, onClose }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)

  function confirmar() {
    if (senha === SENHA_CORRETA) {
      onConfirmar()
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
          Digite a senha para registrar uma ocorrência.
        </div>
        <input
          type="password"
          value={senha}
          onChange={e => { setSenha(e.target.value); setErro(false) }}
          onKeyDown={e => e.key === 'Enter' && confirmar()}
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
            onClick={confirmar}
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

function FormOcorrencia({ onSaved, onCancelar, initialData = null }) {
  const [form, setForm] = useState(() => {
    if (initialData) {
      return {
        ...blank(),
        ...initialData,
        dias_atraso_estimado: initialData.dias_atraso_estimado ?? '',
      }
    }
    return blank()
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (initialData) {
      setForm({
        ...blank(),
        ...initialData,
        dias_atraso_estimado: initialData.dias_atraso_estimado ?? '',
      })
    } else {
      setForm(blank())
    }
  }, [initialData])

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.data_ocorrencia || !form.categoria || !form.impacto || !form.descricao.trim()) {
      setErr('Preencha data, categoria, impacto e descrição.')
      return
    }

    setSaving(true)
    setErr('')

    const payload = {
      data_ocorrencia: form.data_ocorrencia,
      categoria: form.categoria,
      impacto: form.impacto,
      codigo_eap: form.codigo_eap,
      grupo: form.grupo,
      dias_atraso_estimado: form.dias_atraso_estimado,
      descricao: form.descricao,
    }

    const url = initialData?.id ? `/api/ocorrencias/${initialData.id}` : '/api/ocorrencias'
    const method = initialData?.id ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErr(body.error || 'Erro ao salvar. Tente novamente.')
      setSaving(false)
      return
    }

    setSaving(false)
    setForm(blank())
    onSaved()
  }

  return (
    <div className="form-section">
      {err && <div className="toast toast-err">{err}</div>}

      <div className="form-grid-3">
        <div className="field">
          <label>Data</label>
          <input
            type="date"
            value={form.data_ocorrencia}
            onChange={e => setField('data_ocorrencia', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Categoria</label>
          <select
            className="styled"
            value={form.categoria}
            onChange={e => setField('categoria', e.target.value)}
          >
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Impacto</label>
          <select
            className="styled"
            value={form.impacto}
            onChange={e => setField('impacto', e.target.value)}
          >
            <option value="baixo">Baixo</option>
            <option value="medio">Médio</option>
            <option value="alto">Alto</option>
          </select>
        </div>
      </div>

      <div className="form-grid-3" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Código EAP (opcional)</label>
          <input
            type="text"
            placeholder="ex: 1.2.3"
            value={form.codigo_eap}
            onChange={e => setField('codigo_eap', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Grupo (opcional)</label>
          <input
            type="text"
            placeholder="ex: Estrutura"
            value={form.grupo}
            onChange={e => setField('grupo', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Dias de atraso estimado</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={form.dias_atraso_estimado}
            onChange={e => setField('dias_atraso_estimado', e.target.value)}
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Descrição</label>
        <textarea
          placeholder="Descreva a ocorrência…"
          value={form.descricao}
          onChange={e => setField('descricao', e.target.value)}
        />
      </div>

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Salvando…' : initialData?.id ? '✓ Salvar alterações' : '✓ Salvar ocorrência'}
        </button>
        <button className="btn-secondary" onClick={onCancelar} disabled={saving}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function DiarioOcorrencias() {
  const [aberto, setAberto] = useState(false)
  const [ocorrencias, setOcorrencias] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erroLista, setErroLista] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [ocorrenciaEditando, setOcorrenciaEditando] = useState(null)
  const [ocorrenciaExcluir, setOcorrenciaExcluir] = useState(null)
  const [excluindo, setExcluindo] = useState(false)

  function carregarOcorrencias() {
    setCarregando(true)
    setErroLista(null)
    fetch('/api/ocorrencias?limite=20')
      .then(r => {
        if (!r.ok) throw new Error('Erro ao carregar ocorrências')
        return r.json()
      })
      .then(d => setOcorrencias(d))
      .catch(err => setErroLista(err.message))
      .finally(() => setCarregando(false))
  }

  function toggleAberto() {
    const novoEstado = !aberto
    setAberto(novoEstado)
    if (novoEstado && ocorrencias === null) {
      carregarOcorrencias()
    }
  }

  function exigirAutenticacao(action) {
    const autenticado = typeof window !== 'undefined' && sessionStorage.getItem('autenticado') === 'true'
    if (autenticado) {
      action()
      return
    }

    setPendingAction(() => action)
    setMostrarSenha(true)
  }

  function handleNovaOcorrencia() {
    exigirAutenticacao(() => {
      setOcorrenciaEditando(null)
      setMostrarForm(true)
    })
  }

  function handleEditarOcorrencia(ocorrencia) {
    exigirAutenticacao(() => {
      setOcorrenciaEditando(ocorrencia)
      setMostrarForm(true)
    })
  }

  function handleExcluirOcorrencia(ocorrencia) {
    exigirAutenticacao(() => {
      setOcorrenciaExcluir(ocorrencia)
    })
  }

  function handleSenhaConfirmada() {
    sessionStorage.setItem('autenticado', 'true')
    setMostrarSenha(false)
    if (pendingAction) {
      const action = pendingAction
      setPendingAction(null)
      action()
    }
  }

  async function confirmarExclusao() {
    if (!ocorrenciaExcluir) return

    setExcluindo(true)
    try {
      const res = await fetch(`/api/ocorrencias/${ocorrenciaExcluir.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao excluir ocorrência.')
      }

      setOcorrenciaExcluir(null)
      setMostrarForm(false)
      setOcorrenciaEditando(null)
      carregarOcorrencias()
    } catch (error) {
      setErroLista(error.message)
    } finally {
      setExcluindo(false)
    }
  }

  function handleSalvo() {
    setMostrarForm(false)
    setOcorrenciaEditando(null)
    carregarOcorrencias()
  }

  return (
    <div className="card">
      {mostrarSenha && (
        <ModalSenha
          onConfirmar={handleSenhaConfirmada}
          onClose={() => {
            setMostrarSenha(false)
            setPendingAction(null)
          }}
        />
      )}

      {ocorrenciaExcluir && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#1b1b20', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12,
            padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#eeeef2', marginBottom: 10 }}>
              Excluir ocorrência?
            </div>
            <div style={{ color: '#b7b7c2', fontSize: 14, marginBottom: 18, whiteSpace: 'pre-wrap' }}>
              {ocorrenciaExcluir.descricao || 'Deseja remover esta ocorrência do diário?'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-primary"
                onClick={confirmarExclusao}
                disabled={excluindo}
                style={{ flex: 1 }}
              >
                {excluindo ? 'Excluindo…' : 'Excluir'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setOcorrenciaExcluir(null)}
                disabled={excluindo}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="card-title"
        onClick={toggleAberto}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
      >
        <span>📓 Diário de Ocorrências</span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{aberto ? '▲' : '▼'}</span>
      </div>

      {aberto && (
        <>
          <div className="btn-row" style={{ marginBottom: 16 }}>
            {!mostrarForm && (
              <button className="btn-primary" onClick={handleNovaOcorrencia}>
                + Nova ocorrência
              </button>
            )}
          </div>

          {mostrarForm && (
            <FormOcorrencia
              initialData={ocorrenciaEditando}
              onSaved={handleSalvo}
              onCancelar={() => {
                setMostrarForm(false)
                setOcorrenciaEditando(null)
              }}
            />
          )}

          {carregando && <div className="loading">Carregando ocorrências...</div>}
          {erroLista && <div className="toast toast-err">{erroLista}</div>}

          {!carregando && !erroLista && ocorrencias && ocorrencias.length === 0 && (
            <div className="empty-state">
              <h3>Nenhuma ocorrência registrada ainda.</h3>
            </div>
          )}

          {!carregando && !erroLista && ocorrencias && ocorrencias.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th style={{ width: '11%' }}>Data</th>
                  <th style={{ width: '20%' }}>Categoria</th>
                  <th style={{ width: '9%' }}>Impacto</th>
                  <th style={{ width: '12%' }}>EAP / Grupo</th>
                  <th style={{ width: '11%' }}>Atraso est.</th>
                  <th>Descrição</th>
                  <th style={{ width: '12%' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ocorrencias.map(o => (
                  <tr key={o.id}>
                    <td>{new Date(o.data_ocorrencia + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td>{o.categoria}</td>
                    <td><span className={`badge ${IMPACTO_BADGE[o.impacto] || 'badge-gray'}`}>{IMPACTO_LABEL[o.impacto] || o.impacto}</span></td>
                    <td>{[o.codigo_eap, o.grupo].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{o.dias_atraso_estimado ? `${o.dias_atraso_estimado} dia(s)` : '—'}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{o.descricao}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleEditarOcorrencia(o)}
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleExcluirOcorrencia(o)}
                          style={{ padding: '6px 10px', fontSize: 12, color: '#f7b0a7', borderColor: 'rgba(247,176,167,0.45)' }}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
