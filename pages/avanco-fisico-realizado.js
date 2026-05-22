import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

const ATIVIDADES = [
  'Serviços Preliminares e Gerais',
  'Movimento de Terra e Fundações',
  'Estrutura (Concreto + Fôrma + Aço)',
  'Alvenaria e Fechamentos',
  'Instalações Hidrossanitárias',
  'Instalações Elétricas e Telecom',
  'PPCI / SPDA / AVAC / GÁS',
  'Cobertura e Impermeabilização',
  'Esquadrias e Serralheria',
  'Revestimentos Internos e Externos',
  'Pintura',
  'Pisos e Rodapés',
  'Louças, Metais e Bancadas',
  'Elevadores e Equipamentos',
  'Urbanização, Paisagismo e Externos',
  'Limpeza Final e Entrega'
]

const MESES = Array.from({ length: 18 }, (_, i) => ({
  numero: i + 1,
  competencia: new Date(2025, 3 + i, 1).toISOString().slice(0, 10),
  label: new Date(2025, 3 + i, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}))

const fmtPerc = (val) => `${parseFloat(val || 0).toFixed(1)}%`
const fmtData = (data) => data ? new Date(data).toLocaleDateString('pt-BR') : '-'

export default function AvancoFisicoRealizado() {
  const router = useRouter()
  const [aba, setAba] = useState('lancar')
  const [mesSelecionado, setMesSelecionado] = useState(1)
  const [atividades, setAtividades] = useState(
    ATIVIDADES.map(nome => ({ nome, percentual: '', observacao: '' }))
  )
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState(null)

  useEffect(() => {
    fetchHistorico()
  }, [])

  async function fetchHistorico() {
    setLoading(true)
    try {
      const res = await fetch('/api/avanco-fisico-realizado')
      const data = await res.json()
      setHistorico(data.lancamentos || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSalvar() {
    const mes = MESES[mesSelecionado - 1]
    setSalvando(true)
    setMensagem(null)
    try {
      const res = await fetch('/api/avanco-fisico-realizado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competencia: mes.competencia,
          mes_numero: mes.numero,
          atividades: atividades.filter(a => a.percentual !== '')
        })
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setMensagem({ tipo: 'sucesso', texto: 'Avanço salvo com sucesso!' })
      fetchHistorico()
    } catch (err) {
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar. Tente novamente.' })
    } finally {
      setSalvando(false)
    }
  }

  const mes = MESES[mesSelecionado - 1]

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">AVANÇO FÍSICO REALIZADO</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">Lançamento por atividade</div>
          </div>
        </div>
        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>← Voltar ao Dashboard</button>
          <button className="nav-btn" style={{ marginLeft: 8, backgroundColor: aba === 'lancar' ? 'var(--accent)' : '' }} onClick={() => setAba('lancar')}>Lançar</button>
          <button className="nav-btn" style={{ marginLeft: 8, backgroundColor: aba === 'historico' ? 'var(--accent)' : '' }} onClick={() => setAba('historico')}>Histórico</button>
        </div>
      </div>

      {aba === 'lancar' && (
        <div className="card">
          <div className="card-title">📋 Lançar Avanço Físico</div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>Mês de Competência</label>
            <select className="periodo" value={mesSelecionado} onChange={e => setMesSelecionado(parseInt(e.target.value))}>
              {MESES.map(m => (
                <option key={m.numero} value={m.numero}>M{m.numero} — {m.label}</option>
              ))}
            </select>
          </div>

          {mensagem && (
            <div style={{ padding: '10px 16px', borderRadius: 6, marginBottom: 16, backgroundColor: mensagem.tipo === 'sucesso' ? '#1a3d2b' : '#3d1a1a', color: mensagem.tipo === 'sucesso' ? '#4D9B6A' : '#B03030' }}>
              {mensagem.texto}
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Atividade</th>
                <th style={{ textAlign: 'right', width: 140 }}>% Concluído</th>
                <th style={{ width: 200 }}>Observação</th>
              </tr>
            </thead>
            <tbody>
              {atividades.map((at, idx) => (
                <tr key={at.nome}>
                  <td>{at.nome}</td>
                  <td style={{ textAlign: 'right' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={at.percentual}
                      onChange={e => {
                        const nova = [...atividades]
                        nova[idx].percentual = e.target.value
                        setAtividades(nova)
                      }}
                      style={{ width: 80, textAlign: 'right', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', color: 'var(--text1)' }}
                      placeholder="0.0"
                    />
                    <span style={{ marginLeft: 4, color: 'var(--text2)' }}>%</span>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={at.observacao}
                      onChange={e => {
                        const nova = [...atividades]
                        nova[idx].observacao = e.target.value
                        setAtividades(nova)
                      }}
                      style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', color: 'var(--text1)' }}
                      placeholder="opcional"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 20, textAlign: 'right' }}>
            <button
              onClick={handleSalvar}
              disabled={salvando}
              style={{ backgroundColor: '#4D9B6A', color: 'white', border: 'none', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              {salvando ? 'Salvando...' : '💾 Salvar Avanço'}
            </button>
          </div>
        </div>
      )}

      {aba === 'historico' && (
        <div className="card">
          <div className="card-title">📊 Histórico de Lançamentos</div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center' }}>Carregando...</div>
          ) : historico.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Nenhum lançamento ainda</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th>Mês</th>
                    <th>Atividade</th>
                    <th style={{ textAlign: 'right' }}>% Realizado</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td>{fmtData(item.competencia)}</td>
                      <td>M{item.mes_numero}</td>
                      <td>{item.atividade_nome}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtPerc(item.percentual_realizado * 100)}</td>
                      <td>{item.observacao || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
