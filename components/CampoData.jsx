// Campo de data no formato brasileiro dd/mm/aaaa (decisão de 16/10/2026).
// O <input type="date"> segue o idioma do navegador: num Chrome em inglês mostra mm/dd/aaaa e uma medição de
// 12/10 foi gravada como 10/12. Aqui o texto é sempre dd/mm/aaaa (as barras entram sozinhas) e o valor para o
// resto da tela continua ISO (AAAA-MM-DD): onChange(iso) só com data completa e válida, senão onChange('').
import React, { useEffect, useState } from 'react'

const paraTexto = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')

export const isoDeTexto = (t) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t || '')
  if (!m) return ''
  const [, d, mes, a] = m
  const dt = new Date(Date.UTC(+a, +mes - 1, +d))
  return dt.getUTCFullYear() === +a && dt.getUTCMonth() === +mes - 1 && dt.getUTCDate() === +d ? `${a}-${mes}-${d}` : ''
}

const mascarar = (t) => {
  const n = String(t || '').replace(/\D/g, '').slice(0, 8)
  return [n.slice(0, 2), n.slice(2, 4), n.slice(4, 8)].filter(Boolean).join('/')
}

export default function CampoData({ value, onChange, style, ...resto }) {
  const [texto, setTexto] = useState(paraTexto(value))
  // valor trocado de fora (editar uma medição, limpar o formulário)
  useEffect(() => {
    if (isoDeTexto(texto) !== (value || '')) setTexto(paraTexto(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const completo = texto.length === 10
  const invalido = completo && !isoDeTexto(texto)
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      maxLength={10}
      value={texto}
      title={invalido ? 'Data inválida' : 'Data no formato dd/mm/aaaa'}
      onChange={(e) => {
        const t = mascarar(e.target.value)
        setTexto(t)
        onChange(isoDeTexto(t))
      }}
      style={{ ...style, ...(invalido ? { borderColor: '#c77b74' } : null) }}
      {...resto}
    />
  )
}
