// Detalhe do contas a pagar: a lista que forma o total do card, agrupada por
// mes de vencimento, com subtotal do mes por tipo (direto / indireto /
// previsto sem NF). Usado no dashboard mensal e na pagina semanal.
import { useEffect, useState } from 'react'
import { fmtMoeda } from '../lib/constants'

const AMBAR = '#c9a45c'
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rotuloMes = (c) => (c ? `${NOMES_MES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}` : '—')
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—')
const ROTULO_CLASSE = { direto: 'Direto', indireto: 'Indireto', pendente: 'Pendente' }

export default function ContasAPagarDetalhe() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    fetch('/api/contas-a-pagar', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => (d.error ? setErro(d.error) : setDados(d)))
      .catch((e) => setErro(e.message))
  }, [])

  if (erro) return <div className="empty-state"><p>Erro ao carregar o contas a pagar: {erro}</p></div>
  if (!dados) return <div className="loading">Carregando títulos...</div>
  if (!dados.disponivel) return <div className="empty-state"><p>Sem dados: {dados.motivo}.</p></div>

  const dir = { textAlign: 'right', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }
  const topo = { verticalAlign: 'top' }
  const tipo = (t) =>
    t.natureza === 'previsto_sem_nf'
      ? 'Previsto sem NF'
      : [...new Set(t.eaps.map((e) => ROTULO_CLASSE[e.classe] || e.classe))].join(' + ')

  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table>
        <thead>
          <tr>
            <th>Fornecedor</th>
            <th>Documento</th>
            <th>Parcela</th>
            <th>Vencimento</th>
            <th>EAP</th>
            <th>Tipo</th>
            <th style={{ textAlign: 'right' }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {dados.por_mes.map((m) => {
            const titulos = dados.titulos.filter((t) => t.competencia_vencimento === m.mes)
            return [
              <tr key={`cab-${m.mes}`}>
                <td colSpan={7} style={{ background: 'var(--bg3)', fontWeight: 600, paddingLeft: 8 }}>
                  Vencimento em {rotuloMes(m.mes)} · {titulos.length} título(s)
                </td>
              </tr>,
              ...titulos.map((t) => (
                <tr key={t.chave}>
                  <td style={topo}>
                    {t.fornecedor}
                    {t.alertas.map((a, k) => (
                      <div key={k} style={{ color: AMBAR, fontSize: 11, marginTop: 3 }}>⚠ {a}</div>
                    ))}
                  </td>
                  <td style={{ ...topo, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{t.num_documento}</td>
                  <td style={{ ...topo, fontFamily: 'var(--mono)' }}>{t.parcela || '—'}</td>
                  <td style={{ ...topo, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{dmy(t.data_vencimento)}</td>
                  <td style={{ ...topo, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                    {t.eaps.map((e) => (
                      <div key={e.codigo_eap || 'pend'}>
                        {e.codigo_eap || '—'}
                        {t.eaps.length > 1 ? ` · ${fmtMoeda(e.valor)}` : ''}
                      </div>
                    ))}
                  </td>
                  <td style={topo}>{tipo(t)}</td>
                  <td style={{ ...dir, ...topo }}>{fmtMoeda(t.valor)}</td>
                </tr>
              )),
              <tr key={`sub-${m.mes}`}>
                <td colSpan={6} style={{ color: 'var(--text2)', fontSize: 11 }}>
                  Subtotal {rotuloMes(m.mes)} · direto {fmtMoeda(m.direto)} · indireto {fmtMoeda(m.indireto)} · previsto sem NF{' '}
                  {fmtMoeda(m.previsto_sem_nf)}
                  {m.pendente > 0 ? ` · pendente ${fmtMoeda(m.pendente)}` : ''}
                </td>
                <td style={{ ...dir, fontWeight: 600 }}>{fmtMoeda(m.total)}</td>
              </tr>,
            ]
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} style={{ fontWeight: 600 }}>
              Total · direto {fmtMoeda(dados.totais.direto)} · indireto {fmtMoeda(dados.totais.indireto)} · previsto sem NF{' '}
              {fmtMoeda(dados.totais.previsto_sem_nf)}
            </td>
            <td style={{ ...dir, fontWeight: 600 }}>{fmtMoeda(dados.totais.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
