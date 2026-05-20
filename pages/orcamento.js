// pages/orcamento.js
//
// Página de Orçamento Planejado Detalhado com FILTRO DE PERÍODO
// TABELAS SEPARADAS: CUSTOS DIRETOS vs INDIRETOS (DETALHADOS)

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function OrcamentoPage() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mesAtual, setMesAtual] = useState(18) // Padrão: todos os 18 meses

  // Gerar opções de meses (1-18)
  const mesesOpcoes = Array.from({ length: 18 }, (_, i) => i + 1)

  useEffect(() => {
    async function fetchOrcamento() {
      try {
        setLoading(true)
        // Buscar dados filtrados pelo mês
        const res = await fetch(`/api/orcamento-detalhado?mes=${mesAtual}`)
        if (!res.ok) throw new Error('Erro ao carregar orçamento')
        const data = await res.json()
        setDados(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchOrcamento()
  }, [mesAtual]) // Recarrega quando muda o mês

  const fmtMoeda = (val) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(val)
  }

  const fmtPerc = (val) => `${val.toFixed(2)}%`

  if (loading) {
    return (
      <div className="page">
        <div className="header">
          <div className="header-top">
            <div>
              <div className="obra-eye">ORÇAMENTO PLANEJADO</div>
              <div className="obra-nome">Flats Pampulha</div>
            </div>
          </div>
        </div>
        <div className="loading">Carregando orçamento...</div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="page">
        <div className="empty-state">
          <h3>Erro ao carregar orçamento</h3>
        </div>
      </div>
    )
  }

  const { gruposDiretos, gruposIndiretos, total, custos_indiretos, periodo_label } = dados
  const totalDiretos = total - custos_indiretos

  return (
    <div className="page">
      {/* HEADER */}
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">ORÇAMENTO PLANEJADO — 18 MESES</div>
            <div className="obra-nome">Flats Pampulha</div>
            <div className="obra-info">{periodo_label}</div>
          </div>
          
          {/* SELETOR DE PERÍODO */}
          <div className="sel-wrap">
            <div className="sel-lbl">Período</div>
            <select 
              className="periodo"
              value={mesAtual}
              onChange={(e) => setMesAtual(parseInt(e.target.value))}
            >
              {mesesOpcoes.map(mes => (
                <option key={mes} value={mes}>
                  {mes === 18 ? 'Todos os 18 meses' : `Até M${mes}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="nav">
          <button className="nav-btn" onClick={() => router.push('/')}>
            ← Voltar ao Dashboard
          </button>
        </div>
      </div>

      {/* RESUMO */}
      <div className="kpi-grid">
        <div className="kpi" style={{ borderLeftColor: '#C8860A' }}>
          <div className="kpi-label">Orçamento {mesAtual === 18 ? 'Total' : `até M${mesAtual}`}</div>
          <div className="kpi-value">{fmtMoeda(total)}</div>
          <div className="kpi-sub">Diretos + Indiretos</div>
        </div>

        <div className="kpi" style={{ borderLeftColor: '#4D9B6A' }}>
          <div className="kpi-label">Custos Diretos ({gruposDiretos.length} grupos)</div>
          <div className="kpi-value">{fmtMoeda(totalDiretos)}</div>
          <div className="kpi-sub">{fmtPerc((totalDiretos / total) * 100)} do total</div>
        </div>

        <div className="kpi" style={{ borderLeftColor: '#5B9BD5' }}>
          <div className="kpi-label">Custos Indiretos ({gruposIndiretos.length} categorias)</div>
          <div className="kpi-value">{fmtMoeda(custos_indiretos)}</div>
          <div className="kpi-sub">{fmtPerc((custos_indiretos / total) * 100)} do total</div>
        </div>
      </div>

      {/* TABELA DE CUSTOS DIRETOS */}
      <div className="card">
        <div className="card-title">
          🏗️ Custos Diretos — {gruposDiretos.length} Macrogrupos {mesAtual === 18 ? '' : `(até M${mesAtual})`}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Grupo</th>
              <th style={{ textAlign: 'right' }}>Valor Acumulado</th>
              <th style={{ textAlign: 'right' }}>% do Orçamento</th>
              <th style={{ textAlign: 'right' }}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {gruposDiretos.map((grupo) => (
              <tr key={grupo.nome}>
                <td>
                  <span style={{ marginRight: '8px' }}>{grupo.icone}</span>
                  {grupo.nome}
                </td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>
                  {fmtMoeda(grupo.valor)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {fmtPerc((grupo.valor / total) * 100)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="badge badge-ok">Direto</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: '700' }}>
              <td>SUBTOTAL DIRETOS ({gruposDiretos.length} macrogrupos)</td>
              <td style={{ textAlign: 'right' }}>{fmtMoeda(totalDiretos)}</td>
              <td style={{ textAlign: 'right' }}>{fmtPerc((totalDiretos / total) * 100)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* TABELA DE CUSTOS INDIRETOS DETALHADOS */}
      <div className="card">
        <div className="card-title">
          💳 Custos Indiretos Previstos — {gruposIndiretos.length} Categorias
        </div>
        <div className="card-description" style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Despesas complementares necessárias ao projeto, não incluídas na construção física (terreno, projetos, aprovações, jurídico, taxas, contingências)
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th style={{ textAlign: 'right' }}>Valor Total</th>
              <th style={{ textAlign: 'right' }}>% do Orçamento</th>
              <th style={{ textAlign: 'right' }}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {gruposIndiretos.length > 0 ? (
              gruposIndiretos.map((grupo) => (
                <tr key={grupo.nome}>
                  <td>
                    <span style={{ marginRight: '8px' }}>{grupo.icone}</span>
                    {grupo.nome}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>
                    {fmtMoeda(grupo.valor)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {fmtPerc((grupo.valor / total) * 100)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="badge badge-blue">Indireto</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '20px' }}>
                  Nenhum custo indireto previsto
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: '700' }}>
              <td>SUBTOTAL INDIRETOS ({gruposIndiretos.length} categorias)</td>
              <td style={{ textAlign: 'right' }}>{fmtMoeda(custos_indiretos)}</td>
              <td style={{ textAlign: 'right' }}>{fmtPerc((custos_indiretos / total) * 100)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* RESUMO FINAL */}
      <div className="card">
        <div className="card-title">📊 Resumo Final do Orçamento</div>
        <table>
          <tbody>
            <tr>
              <td style={{ fontWeight: '600' }}>Custos Diretos ({gruposDiretos.length} macrogrupos)</td>
              <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmtMoeda(totalDiretos)}</td>
              <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                {fmtPerc((totalDiretos / total) * 100)}
              </td>
            </tr>
            <tr>
              <td style={{ fontWeight: '600' }}>Custos Indiretos ({gruposIndiretos.length} categorias)</td>
              <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmtMoeda(custos_indiretos)}</td>
              <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                {fmtPerc((custos_indiretos / total) * 100)}
              </td>
            </tr>
            <tr style={{ borderTop: '2px solid var(--border)', fontWeight: '700', fontSize: '16px', backgroundColor: 'var(--color-background-secondary)' }}>
              <td>TOTAL GERAL</td>
              <td style={{ textAlign: 'right' }}>{fmtMoeda(total)}</td>
              <td style={{ textAlign: 'right' }}>100,00%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* OBSERVAÇÕES */}
      <div className="card">
        <div className="card-title">📝 Observações</div>
        <div className="notas-box">
          <strong>Período selecionado:</strong> {periodo_label}
          <br /><br />
          <strong>Custos Diretos ({gruposDiretos.length} macrogrupos):</strong> Relacionados diretamente à execução da obra, conforme cronograma de desembolso. Incluem materiais, mão de obra, equipamentos e todas as despesas de construção.
          <br /><br />
          <strong>Custos Indiretos ({gruposIndiretos.length} categorias):</strong> Despesas complementares necessárias ao projeto, não incluídas na construção física. Englobam: aquisição de terreno, projetos técnicos, consultorias, aprovações e licenças, assessoria jurídica, taxas de registro, emolumentos cartorários, compensações ambientais e contingências.
          <br /><br />
          <strong>Total do Orçamento:</strong> {fmtMoeda(total)} — somatório dos custos diretos e indiretos, representando o investimento total previsto para a obra durante os 18 meses de execução.
        </div>
      </div>
    </div>
  )
}
