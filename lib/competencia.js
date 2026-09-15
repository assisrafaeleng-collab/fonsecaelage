/* Le "2026-08" de uma data, SEM passar por new Date().
   O parse de 'YYYY-MM-DD' pelo Date assume meia-noite UTC; no Brasil
   (UTC-3) isso vira o dia anterior as 21h, e toda nota emitida no dia
   1o caia no mes anterior. Como o texto ja vem no formato certo do
   Postgres, basta recortar. */
export function getCompetenciaFromDate(value) {
  if (!value) return null

  const texto = String(value).trim()

  const iso = texto.match(/^(\d{4})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}`

  const d = new Date(texto)
  if (!Number.isNaN(d.getTime())) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  }

  return null
}

/* Le a competencia declarada, em qualquer formato usado na importacao:
   2026-08, 2026-08-15, "agosto/2026", "2026/8". */
export function parseCompetencia(competencia) {
  if (!competencia) return null

  const texto = String(competencia).trim()

  if (/^\d{4}-\d{2}$/.test(texto)) return texto
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto.slice(0, 7)

  const minusculo = texto.toLowerCase()
  const meses = {
    janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06',
    julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
  }

  const matchMes = minusculo.match(/(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/?\s*(\d{4})/i)
  if (matchMes) {
    const mes = meses[matchMes[1].toLowerCase()]
    return `${matchMes[2]}-${mes}`
  }

  const matchIso = minusculo.match(/(\d{4})[-/](\d{1,2})/)
  if (matchIso) {
    return `${matchIso[1]}-${String(Number(matchIso[2])).padStart(2, '0')}`
  }

  return null
}

/* A data de emissao continua mandando, como sempre foi — a correcao
   aqui e so de fuso. A competencia entra quando nao ha emissao. */
export function normalizeCompetencia(competencia, dataEmissao = null) {
  const daEmissao = getCompetenciaFromDate(dataEmissao)
  if (daEmissao) return daEmissao

  return parseCompetencia(competencia)
}

export function getProjectMonthFromDate(dataEmissao, projectStart = '2026-07-01') {
  const comp = getCompetenciaFromDate(dataEmissao)
  const inicio = getCompetenciaFromDate(projectStart)
  if (!comp || !inicio) return null

  const [anoC, mesC] = comp.split('-').map(Number)
  const [anoI, mesI] = inicio.split('-').map(Number)
  return Math.max(1, (anoC - anoI) * 12 + (mesC - mesI) + 1)
}

export function resolveProjectMonth({ competencia, dataEmissao, mes_ref, mes_numero, projectStart = '2026-07-01' }) {
  if (mes_numero) {
    const inicio = getCompetenciaFromDate(projectStart)
    const [anoI, mesI] = inicio.split('-').map(Number)
    const total = (mesI - 1) + Number(mes_numero) - 1
    const ano = anoI + Math.floor(total / 12)
    const mes = (total % 12 + 12) % 12
    return `${ano}-${String(mes + 1).padStart(2, '0')}`
  }

  if (mes_ref) {
    const normalized = normalizeCompetencia(String(mes_ref), dataEmissao)
    if (normalized) return normalized
  }

  const fromCompetencia = normalizeCompetencia(competencia, dataEmissao)
  if (fromCompetencia) return fromCompetencia

  return getCompetenciaFromDate(dataEmissao)
}

export function competenciaToDateKey(competencia) {
  return competencia ? `${competencia}-01` : null
}
