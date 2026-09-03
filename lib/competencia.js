export function getCompetenciaFromDate(value) {
  if (!value) return null

  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  return null
}

export function normalizeCompetencia(competencia, dataEmissao = null) {
  const fromDate = getCompetenciaFromDate(dataEmissao)
  if (fromDate) return fromDate

  if (!competencia) return null

  if (/^\d{4}-\d{2}$/.test(String(competencia).trim())) {
    return String(competencia).trim()
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(competencia).trim())) {
    return String(competencia).trim().slice(0, 7)
  }

  const texto = String(competencia).trim().toLowerCase()
  const meses = {
    janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06',
    julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
  }

  const matchMes = texto.match(/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/?\s*(\d{4})/i)
  if (matchMes) {
    const mes = meses[matchMes[1].toLowerCase()]
    return `${matchMes[2]}-${mes}`
  }

  const matchIso = texto.match(/(\d{4})[-/](\d{1,2})/)
  if (matchIso) {
    return `${matchIso[1]}-${String(Number(matchIso[2])).padStart(2, '0')}`
  }

  return null
}

export function getProjectMonthFromDate(dataEmissao, projectStart = '2026-07-01') {
  if (!dataEmissao) return null

  const start = new Date(projectStart)
  const current = new Date(dataEmissao)
  if (Number.isNaN(start.getTime()) || Number.isNaN(current.getTime())) return null

  const diffMonths = (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth()) + 1
  return Math.max(1, diffMonths)
}

export function resolveProjectMonth({ competencia, dataEmissao, mes_ref, mes_numero, projectStart = '2026-07-01' }) {
  if (mes_numero) {
    const start = new Date(projectStart)
    const y = start.getFullYear()
    const m = start.getMonth() + Number(mes_numero) - 1
    const year = y + Math.floor(m / 12)
    const month = (m % 12 + 12) % 12
    return `${year}-${String(month + 1).padStart(2, '0')}`
  }

  if (mes_ref) {
    const normalized = normalizeCompetencia(String(mes_ref), dataEmissao)
    if (normalized) return normalized
  }

  const fromCompetencia = normalizeCompetencia(competencia, dataEmissao)
  if (fromCompetencia) return fromCompetencia

  const fromDate = getCompetenciaFromDate(dataEmissao)
  if (fromDate) return fromDate

  return null
}

export function competenciaToDateKey(competencia) {
  return competencia ? `${competencia}-01` : null
}
