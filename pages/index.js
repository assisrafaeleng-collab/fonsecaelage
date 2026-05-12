import { useState, useEffect } from 'react'
import Head from 'next/head'
import Dashboard  from '../components/Dashboard'
import UpdateForm from '../components/UpdateForm'
import History    from '../components/History'
import { fmtMoeda } from '../lib/constants'

const TABS = [
  { key: 'dash', label: '📊 Dashboard' },
  { key: 'form', label: '➕ Lançar atualização' },
  { key: 'hist', label: '📋 Histórico' },
]

export default function Home() {
  const [updates,    setUpdates]    = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [view,       setView]       = useState('dash')
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState(null)

  const fetchUpdates = async () => {
    const res  = await fetch('/api/updates')
    const data = await res.json()
    setUpdates(data)
    if (!selectedId && data.length) setSelectedId(data.at(-1).id)
    setLoading(false)
  }

  useEffect(() => { fetchUpdates() }, [])

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2800)
  }

  const handleSaved = () => {
    showToast('Atualização salva com sucesso!')
    fetchUpdates()
    setTimeout(() => setView('dash'), 1800)
  }

  const handleDelete = () => {
    showToast('Atualização excluída.')
    fetchUpdates()
  }

  const handleView = (id) => {
    setSelectedId(id)
    setView('dash')
  }

  const cur = updates.find(u => u.id === selectedId) || updates.at(-1)

  return (
    <>
      <Head>
        <title>Dashboard de Obra — Edifício Alameda</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="page">
        {/* Header */}
        <div className="header">
          <div className="header-top">
            <div>
              <div className="obra-eye">Obra predial · Torre A</div>
              <div className="obra-nome">Edifício Alameda Comercial</div>
              <div className="obra-info">Orçamento: R$&nbsp;15.000k &nbsp;·&nbsp; Prazo: Out/2026</div>
            </div>

            {view === 'dash' && updates.length > 0 && (
              <div className="sel-wrap">
                <div className="sel-lbl">Filtrar por período</div>
                <select
                  className="periodo"
                  value={selectedId || ''}
                  onChange={e => setSelectedId(e.target.value)}
                >
                  {[...updates].reverse().map(u => (
                    <option key={u.id} value={u.id}>
                      {new Date(u.data + 'T12:00:00').toLocaleDateString('pt-BR')} · Sem&nbsp;{u.semana} · {u.avanco_real}% físico
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <nav className="nav">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`nav-btn ${view === t.key ? 'active' : ''}`}
                onClick={() => setView(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>{toast.msg}</div>
        )}

        {/* Conteúdo */}
        {loading ? (
          <div className="loading">Carregando dados da obra…</div>
        ) : (
          <>
            {view === 'dash' && (
              <Dashboard
                updates={updates}
                selectedId={selectedId}
                onSelectId={setSelectedId}
              />
            )}
            {view === 'form' && <UpdateForm onSaved={handleSaved} />}
            {view === 'hist' && (
              <History
                updates={updates}
                onDelete={handleDelete}
                onView={handleView}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
