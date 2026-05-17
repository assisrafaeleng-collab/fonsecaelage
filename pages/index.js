import { useState, useEffect } from 'react'
import Head from 'next/head'
import Dashboard from '../components/Dashboard'
import UpdateForm from '../components/UpdateForm'
import History from '../components/History'
import { fmtMoeda } from '../lib/constants'

const TABS = [
  { key: 'dash', label: '📊 Dashboard' },
  { key: 'form', label: '➕ Lançar atualização' },
  { key: 'hist', label: '📜 Histórico' },
]

export default function Home() {
  const [updates, setUpdates] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState('dash')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const fetchUpdates = async () => {
    const res = await fetch('/api/updates')
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

  return (
    <>
      <Head>
        <title>Obra Predial — Torre A</title>
        <meta name="description" content="Controle de execução física e financeira" />
      </Head>
      <div className="container">
        <header className="header">
          <div>
            <h1>OBRA PREDIAL - TORRE A</h1>
            <div className="header-meta">
              Orçamento: {updates.length ? fmtMoeda(updates.at(-1).orcamento) : '—'} · 
              Prazo: Out/2025 · {updates.length ? updates.at(-1).semana : '—'} / {updates.length ? updates.at(-1).avanco_real : '—'}% físico
            </div>
          </div>
          <div className="period-sel">
            <span>{updates.length ? new Date(updates.at(-1).data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} - Sem {updates.length ? updates.at(-1).semana : '—'}</span>
            <span className="status-badge">{updates.length ? updates.at(-1).avanco_real : '—'}% físico</span>
          </div>
        </header>

        {toast && <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>{toast.msg}</div>}

        <nav className="tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={view === t.key ? 'tab active' : 'tab'}
              onClick={() => setView(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="main">
          {loading && <div className="loading">Carregando…</div>}
          {!loading && view === 'dash' && (
            <Dashboard updates={updates} selectedId={selectedId} onSelectId={setSelectedId} />
          )}
          {!loading && view === 'form' && (
            <UpdateForm
              onSaved={() => {
                fetchUpdates()
                showToast('✓ Atualização salva com sucesso!')
                setView('dash')
              }}
            />
          )}
          {!loading && view === 'hist' && (
            <History
              updates={updates}
              onDelete={() => { fetchUpdates(); showToast('✓ Excluído') }}
              onView={id => { setSelectedId(id); setView('dash') }}
            />
          )}
        </main>
      </div>
    </>
  )
}