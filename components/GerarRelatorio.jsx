// Botão "Gerar relatório" (decisão de 16/10/2026; mesmo do Sirius 60): escolhe a data inicial e a final (padrão: mês
// anterior fechado; atalhos última semana, último mês, desde o início) e abre o relatório gerencial
// (pages/relatorio.js) numa aba nova, pronto para "Baixar PDF". Fica ao lado de "Avanço físico" na semanal.
// curva: dados.curva da semanal (semanas do calendário da obra, com data_inicio e data_fim). Datas no fuso de
// São Paulo e no formato dd/mm/aaaa (components/CampoData.jsx).
import { useState } from 'react'
import CampoData from './CampoData'

export const hojeSaoPaulo = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const ultimoDiaMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate() // mes 1–12

function mesAnterior() {
  const [y, m] = hojeSaoPaulo().split('-').map(Number)
  const ano = m === 1 ? y - 1 : y
  const mes = m === 1 ? 12 : m - 1
  const mm = String(mes).padStart(2, '0')
  return { de: `${ano}-${mm}-01`, ate: `${ano}-${mm}-${String(ultimoDiaMes(ano, mes)).padStart(2, '0')}` }
}
// última semana já encerrada do calendário da obra
function ultimaSemana(curva) {
  const hoje = hojeSaoPaulo()
  const fechadas = (curva || []).filter((c) => String(c.data_fim).slice(0, 10) < hoje)
  const s = fechadas[fechadas.length - 1] || (curva || [])[0]
  return s ? { de: String(s.data_inicio).slice(0, 10), ate: String(s.data_fim).slice(0, 10) } : mesAnterior()
}
const desdeInicio = (curva) => ({ de: curva && curva[0] ? String(curva[0].data_inicio).slice(0, 10) : '', ate: hojeSaoPaulo() })

export default function GerarRelatorio({ curva }) {
  const [aberto, setAberto] = useState(false)
  const [p, setP] = useState(mesAnterior)
  const ok = p.de && p.ate && p.de <= p.ate
  const abrir = () => ok && window.open(`/relatorio?de=${p.de}&ate=${p.ate}`, '_blank')
  return (
    <span style={{ position: 'relative' }}>
      <button className="btn-sm" onClick={() => setAberto((v) => !v)} title="Relatório da obra para os gestores, em PDF">
        Gerar relatório {aberto ? '▴' : '▾'}
      </button>
      {aberto && (
        <div className="card" style={{ position: 'absolute', zIndex: 20, top: 30, left: 0, width: 'min(330px, 86vw)', margin: 0, padding: 16 }}>
          <div style={{ font: "600 13px 'IBM Plex Sans'", marginBottom: 10 }}>Relatório da obra</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 1, fontSize: 11, color: 'var(--text2)' }}>
              Data inicial
              <CampoData value={p.de} onChange={(iso) => setP({ ...p, de: iso })} style={{ width: '100%' }} />
            </label>
            <label style={{ flex: 1, fontSize: 11, color: 'var(--text2)' }}>
              Data final
              <CampoData value={p.ate} onChange={(iso) => setP({ ...p, ate: iso })} style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn-sm" onClick={() => setP(ultimaSemana(curva))}>Última semana</button>
            <button className="btn-sm" onClick={() => setP(mesAnterior())}>Último mês</button>
            <button className="btn-sm" onClick={() => setP(desdeInicio(curva))}>Desde o início</button>
          </div>
          <button className="btn-primary" disabled={!ok} onClick={abrir} style={{ width: '100%' }}>
            Abrir relatório
          </button>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>
            {p.de && p.ate && p.de > p.ate ? 'A data inicial é depois da final. ' : ''}
            Abre numa aba nova. Lá, "Baixar PDF" → destino "Salvar como PDF".
          </div>
        </div>
      )}
    </span>
  )
}
