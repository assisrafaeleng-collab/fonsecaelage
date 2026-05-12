import { useState } from 'react'
import { fmtMoeda } from '../lib/constants'

export default function History({ updates, onDelete, onView }) {
  const [delId, setDelId] = useState(null)

  const confirmDelete = async (id) => {
    const res = await fetch(`/api/updates/${id}`, { method: 'DELETE' })
    if (res.ok) { onDelete(); setDelId(null) }
  }

  if (!updates.length) {
    return (
      <div className="empty-state">
        <h3>Nenhuma atualização registrada ainda.</h3>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-title">{updates.length} atualizações registradas — mais recentes primeiro</div>
      <table>
        <thead>
          <tr>
            <th style={{ width: '14%' }}>Data</th>
            <th style={{ width: '7%' }}>Sem.</th>
            <th style={{ width: '11%' }}>Fís. real</th>
            <th style={{ width: '11%' }}>Fís. plan.</th>
            <th style={{ width: '13%' }}>Custo</th>
            <th style={{ width: '13%' }}>Projeção</th>
            <th style={{ width: '11%' }}>Desvio</th>
            <th style={{ width: '20%' }}></th>
          </tr>
        </thead>
        <tbody>
          {[...updates].reverse().map(u => {
            const diff = u.avanco_real - u.avanco_plan
            const cls  = diff >= 0 ? 'badge-ok' : diff >= -5 ? 'badge-warn' : 'badge-bad'
            return (
              <tr key={u.id}>
                <td>{new Date(u.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                <td>{u.semana || '—'}</td>
                <td>{u.avanco_real}%</td>
                <td>{u.avanco_plan}%</td>
                <td>{fmtMoeda(u.custo_real)}</td>
                <td>{fmtMoeda(u.projecao)}</td>
                <td><span className={`badge ${cls}`}>{diff >= 0 ? '+' : ''}{diff}%</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button className="btn-sm" onClick={() => onView(u.id)}>Ver no dashboard</button>
                    {delId === u.id
                      ? <button className="btn-danger" onClick={() => confirmDelete(u.id)}>Confirmar exclusão</button>
                      : <button className="btn-sm" onClick={() => setDelId(u.id)}>Excluir</button>
                    }
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
