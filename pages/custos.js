// pages/custos.js
//
// Página de Controle de Custos — integra ao dashboard existente
// Duas seções: (1) Import de planilha; (2) Visualização por período

import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

// ── Paleta alinhada com o resto do dashboard ──────────────────
const C = {
  bg:      '#141414',
  black:   '#1A1A1A',
  dark:    '#E8E8E8',
  accent:  '#C8860A',
  white:   '#1E1E1E',
  border:  '#2A2A2A',
  green:   '#1a3d2b',
  amber:   '#3d2e1a',
  red:     '#3d1a1a',
  text:    '#E8E8E8',
}

const GRUPO_COLORS = {
  '1. Terreno':               '#1a2033',
  '2. Projetos e Consultoria':'#1a2d1a',
  '3. Serviços Jurídicos':    '#2d1a1a',
  '4. Taxas e Licenças':      '#2d2d1a',
  '5. Locações':              '#2d1a2d',
  '6. Canteiro de Obras':     '#1a2d2b',
  '7. Mão de Obra':           '#2d1a1a',
  '8. Ferramentas':           '#2d2010',
}

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

// ── Componente: KPI card ──────────────────────────────────────
function KPI({ label, value, sub, dark }) {
  return (
    <div style={{
      background: dark ? C.black : C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: '16px 20px',
      minWidth: 160,
    }}>
      <div style={{ fontSize: 11, color: dark ? '#AAA' : '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: dark ? '#AAA' : '#999', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Componente: barra de progresso por grupo ──────────────────
function GrupoBar({ grupo, valor, total }) {
  const pct = total > 0 ? (valor / total) * 100 : 0
  const cor  = GRUPO_COLORS[grupo] || '#EEE'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: C.dark, fontWeight: 600 }}>{grupo}</span>
        <span style={{ color: C.accent, fontWeight: 700 }}>{fmt(valor)}</span>
      </div>
      <div style={{ background: '#E8E4DF', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{ background: C.accent, width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontSize: 10, color: '#999', textAlign: 'right', marginTop: 2 }}>{pct.toFixed(1)}%</div>
    </div>
  )
}

// ── Seção 1: Import ───────────────────────────────────────────
function ImportSection({ onImported }) {
  const [competencia, setCompetencia] = useState('')
  const [file, setFile]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [preview, setPreview]         = useState(null)
  const [error, setError]             = useState(null)
  const [success, setSuccess]         = useState(null)
  const inputRef = useRef()

  async function handlePreview() {
    if (!file || !competencia.trim()) {
      setError('Selecione o arquivo e preencha a competência.')
      return
    }
    setLoading(true); setError(null); setSuccess(null)
    const fd = new FormData()
    fd.append('arquivo', file)
    fd.append('competencia', competencia.trim())
    try {
      const r = await fetch('/api/custos/import?preview=true', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setPreview(d)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleCommit() {
    if (!preview) return
    setLoading(true); setError(null)
    const fd = new FormData()
    fd.append('arquivo', file)
    fd.append('competencia', competencia.trim())
    try {
      const r = await fetch('/api/custos/import?preview=false', { method: 'POST', body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      setSuccess(`${d.inserted} lançamentos importados — ${fmt(d.total_valor)}`)
      setPreview(null); setFile(null)
      onImported()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const cardStyle = {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: 24,
    marginBottom: 24,
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, margin: '0 0 20px' }}>
        Importar Planilha Mensal
      </h2>

      <div style={cardStyle}>
        {/* Passo 1: Competência */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            1 — Competência (mês de referência)
          </label>
          <input
            type="text"
            placeholder="ex: Maio/2026"
            value={competencia}
            onChange={e => setCompetencia(e.target.value)}
            style={{
              border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px',
              fontSize: 14, width: 220, outline: 'none', fontFamily: 'inherit',
              color: C.dark, background: C.bg,
            }}
          />
        </div>

        {/* Passo 2: Upload */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.dark, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            2 — Arquivo .xlsx (aba "Lançamentos")
          </label>
          <div
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${file ? C.accent : C.border}`,
              borderRadius: 8, padding: '20px 24px', cursor: 'pointer',
              background: file ? '#F5F2EC' : '#FAFAF8',
              textAlign: 'center', transition: 'border-color 0.2s',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 13, color: file ? C.accent : '#999', fontWeight: file ? 700 : 400 }}>
              {file ? `✓ ${file.name}` : 'Clique para selecionar ou arraste o arquivo aqui'}
            </div>
            {file && <div style={{ fontSize: 11, color: '#AAA', marginTop: 4 }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>}
          </div>
          <input
            ref={inputRef} type="file" accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { setFile(e.target.files[0] || null); setPreview(null) }}
          />
        </div>

        {/* Botão: Pré-visualizar */}
        <button
          onClick={handlePreview}
          disabled={loading || !file || !competencia.trim()}
          style={{
            background: loading ? '#CCC' : C.accent,
            color: C.white, border: 'none', borderRadius: 6,
            padding: '11px 28px', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'background 0.2s',
          }}
        >
          {loading ? 'Processando…' : 'Pré-visualizar'}
        </button>
      </div>

      {/* Mensagens */}
      {error && (
        <div style={{ background: '#FFF0F0', border: '1px solid #F5C0C0', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#8B2020', fontSize: 13 }}>
          ⚠ {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#EFF7EA', border: '1px solid #B5D99B', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#2A6B1A', fontSize: 13, fontWeight: 600 }}>
          ✓ {success}
        </div>
      )}

      {/* Preview dos dados */}
      {preview && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.dark, margin: '0 0 16px' }}>
            Prévia — {preview.total} lançamentos · {fmt(preview.total_valor)}
          </h3>

          {preview.warnings?.length > 0 && (
            <div style={{ background: C.amber, borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
              {preview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}

          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['#', 'Data', 'Fornecedor', 'Histórico', 'Grupo', 'Fase', 'Valor', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', background: C.dark, color: C.white, textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.lancamentos.map((l, i) => {
                  const isDup = l.status !== 'Normal'
                  return (
                    <tr key={i} style={{ background: isDup ? C.red : i % 2 === 0 ? C.white : C.bg }}>
                      <td style={{ padding: '7px 10px' }}>{l.seq}</td>
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.data_emissao || '—'}</td>
                      <td style={{ padding: '7px 10px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.fornecedor}</td>
                      <td style={{ padding: '7px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.historico}</td>
                      <td style={{ padding: '7px 10px', background: GRUPO_COLORS[l.grupo_custo] || 'transparent', fontWeight: 600, whiteSpace: 'nowrap' }}>{l.grupo_custo}</td>
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.fase_obra}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(l.valor)}</td>
                      <td style={{ padding: '7px 10px' }}>{l.status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleCommit}
              disabled={loading}
              style={{
                background: '#2A6B1A', color: C.white, border: 'none', borderRadius: 6,
                padding: '11px 28px', fontSize: 14, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {loading ? 'Importando…' : `✓ Confirmar e Importar ${preview.total} lançamentos`}
            </button>
            <button
              onClick={() => setPreview(null)}
              style={{
                background: 'transparent', color: C.dark, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '11px 20px', fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Seção 2: Visualização ─────────────────────────────────────
function VisualizacaoSection({ refresh }) {
  const [competencias, setCompetencias] = useState([])
  const [selected, setSelected]         = useState('')
  const [data, setData]                 = useState(null)
  const [grupos, setGrupos]             = useState([])
  const [loading, setLoading]           = useState(false)

  useEffect(() => {
    fetch('/api/custos?resumo=competencias')
      .then(r => r.json())
      .then(list => {
        setCompetencias(list)
        if (list.length > 0) setSelected(list[list.length - 1])
      })
  }, [refresh])

  useEffect(() => {
    if (!selected) return
    setLoading(true)
    Promise.all([
      fetch(`/api/custos?competencia=${encodeURIComponent(selected)}`).then(r => r.json()),
      fetch(`/api/custos?resumo=grupo&competencia=${encodeURIComponent(selected)}`).then(r => r.json()),
    ]).then(([detail, grp]) => {
      setData(detail)
      setGrupos(grp.filter(g => g.competencia === selected))
      setLoading(false)
    })
  }, [selected, refresh])

  const totalValor = data?.meta?.total_valor || 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.dark, margin: 0 }}>
          Custos por Período
        </h2>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{
            border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 14px',
            fontSize: 14, fontFamily: 'inherit', color: C.dark, background: C.bg, cursor: 'pointer',
          }}
        >
          {competencias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading && <div style={{ color: '#999', fontSize: 13 }}>Carregando…</div>}

      {data && !loading && (
        <>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <KPI dark label="Total do Período" value={fmt(totalValor)} sub={`${data.meta.total_normal} lançamentos`} />
            {grupos.slice(0, 4).map(g => (
              <KPI
                key={g.grupo_custo}
                label={g.grupo_custo}
                value={fmt(g.total_normal)}
                sub={`${((g.total_normal / totalValor) * 100).toFixed(1)}%`}
              />
            ))}
          </div>

          {/* Barras por grupo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: '0 0 16px' }}>
                Por Grupo de Custo
              </h3>
              {grupos.map(g => (
                <GrupoBar key={g.grupo_custo} grupo={g.grupo_custo} valor={g.total_normal} total={totalValor} />
              ))}
            </div>

            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: '0 0 16px' }}>
                Lançamentos Recentes
              </h3>
              {(data.lancamentos || []).slice(0, 8).map((l, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12,
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: C.dark }}>{l.fornecedor}</div>
                    <div style={{ color: '#888', marginTop: 2 }}>{l.fase_obra}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: l.status === 'Normal' ? C.accent : '#AAA' }}>
                    {fmt(l.valor)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela completa */}
          <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.dark, margin: '0 0 16px' }}>
              Todos os Lançamentos — {selected}
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['#', 'Data', 'Fornecedor', 'Grupo', 'Fase', 'Valor', 'Status'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', background: C.dark, color: C.white, textAlign: 'left', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.lancamentos || []).map((l, i) => (
                    <tr key={i} style={{ background: l.status !== 'Normal' ? C.red : i % 2 === 0 ? C.white : C.bg }}>
                      <td style={{ padding: '7px 10px' }}>{l.seq}</td>
                      <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{l.data_emissao}</td>
                      <td style={{ padding: '7px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.fornecedor}</td>
                      <td style={{ padding: '7px 10px', background: GRUPO_COLORS[l.grupo_custo] || 'transparent', fontWeight: 600 }}>{l.grupo_custo}</td>
                      <td style={{ padding: '7px 10px' }}>{l.fase_obra}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>{fmt(l.valor)}</td>
                      <td style={{ padding: '7px 10px', color: l.status === 'Normal' ? '#2A6B1A' : '#8B2020', fontWeight: 600 }}>{l.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────
export default function CustosPage() {
  const [tab, setTab]       = useState('import')
  const [refresh, setRefresh] = useState(0)

  function handleImported() {
    setRefresh(r => r + 1)
    setTab('visualizar')
  }

  const tabStyle = (active) => ({
    padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: 'none', borderBottom: active ? `2px solid ${C.accent}` : '2px solid transparent',
    background: 'transparent', color: active ? C.accent : '#999',
    fontFamily: 'inherit', transition: 'color 0.2s',
  })

  return (
    <>
      <Head>
        <title>Custos da Obra — Flats Pampulha</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ fontFamily: "'Inter', Arial, sans-serif", background: C.bg, minHeight: '100vh', padding: '0 0 60px' }}>

        {/* Header */}
        <div style={{ background: C.black, padding: '20px 32px', marginBottom: 0 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.white, letterSpacing: '-0.02em' }}>
                Flats Pampulha — Controle de Custos
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                Edifício Cel. José Dias Bicalho · Fonseca & Lage
              </div>
            </div>
            <a
              href="/"
              style={{ fontSize: 12, color: '#AAA', textDecoration: 'none', border: '1px solid #444', borderRadius: 6, padding: '6px 14px' }}
            >
              ← Dashboard Principal
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, marginBottom: 32 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex' }}>
            <button style={tabStyle(tab === 'import')}     onClick={() => setTab('import')}>
              📥 Importar Planilha
            </button>
            <button style={tabStyle(tab === 'visualizar')} onClick={() => setTab('visualizar')}>
              📊 Visualizar Custos
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
          {tab === 'import'     && <ImportSection onImported={handleImported} />}
          {tab === 'visualizar' && <VisualizacaoSection refresh={refresh} />}
        </div>

      </div>
    </>
  )
}
