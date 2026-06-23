export const DISCIPLINAS = []

export function fmtMoeda(v) {
  if (v == null) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v)
}

export function fmtMoedaK(v) {
  if (v == null) return '-'
  return 'R\$\u00a0' + Number(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + 'k'
}

export function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')
}