// Matriz HH planejada por atividade x mês conforme a realidade do cronograma anexado.
// A partir dessa base, o avanço planejado de todos os gráficos usa o mesmo cálculo.

const toNumber = (raw) => {
  if (raw == null || raw === '') return 0
  const str = String(raw).trim().replace(/\./g, '').replace(',', '.')
  const n = Number(str)
  return Number.isFinite(n) ? n : 0
}

const normalizeKey = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const PLANEJAMENTO_HH = {
  'servicos preliminares e gerais': [128.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'movimento de terra e fundacoes': [446.1, 306.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'estrutura concreto formas armacao': [103, 259.1, 1867.3, 543, 744.4, 1681, 861.6, 519.9, 594.8, 1254.8, 1434.8, 482.3, 767, 284.8, 0, 0, 0, 0, 0, 0],
  'alvenaria e fechamentos': [0, 0, 0, 0, 0, 0, 0, 0, 186.8, 465.7, 278.9, 261.6, 523.2, 261.6, 259.6, 474.3, 268.8, 54, 0, 0],
  'reboco emboço': [0, 0, 0, 0, 0, 0, 0, 0, 0, 117.3, 422.3, 408.3, 408.3, 366.8, 350.5, 299.8, 292, 383.1, 245.6, 0],
  'instalacoes hidrossanitarias': [0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 88.4, 181, 157.7, 201, 181, 144.3, 247.3, 155.9, 0, 0],
  'instalacoes eletricas e telecomunicacoes': [0, 0, 0, 0, 0, 20, 20, 20, 20, 20, 114.3, 211.8, 214.6, 137, 137, 137, 205.5, 319.4, 0, 0],
  'instalacoes especiais': [0, 0, 0, 0, 0, 0, 0, 12.7, 12.7, 0, 0, 0, 0, 63, 66.9, 51.6, 74.2, 102.3, 520.9, 10],
  'cobertura e impermeabilizacao': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11.6, 54.9, 125.1, 125.1, 159.2, 148.6, 148.6],
  'aplicacao de gesso': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 153, 225.6, 210, 210, 200.4, 290.7, 255.5, 81.6, 0],
  'pisos e rodapes': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 160.3, 198.6, 353.3, 312.5, 416.1, 321.3, 323.8, 175.5],
  'esquadrias portas janelas vidros': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 49.5, 145.5, 136],
  'pintura': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 113, 113, 113.5, 113.5, 101.9, 101.9, 101.9],
  'loucas metais e bancadas': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 22.5, 22.5, 55.2, 55.2, 55.2, 55.2],
  'urbanizacao paisagismo e servicos externos': [0, 0, 0, 0, 18.8, 18.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7.5, 7.5],
  'servicos finais': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 129.6, 129.6]
}

const FALLBACK_HH_BY_MONTH = (item) => {
  const inicio = Number(item.mes_inicio || 1)
  const fim = Number(item.mes_fim || inicio)
  const total = Number(item.hh || 0)
  const months = Array.from({ length: 20 }, (_, idx) => idx + 1)
  const dist = months.map((mes) => {
    if (mes < inicio || mes > fim) return 0
    const span = Math.max(1, fim - inicio + 1)
    const pct = 1 / span
    return total * pct
  })
  return dist
}

export function getTotalPlanejadoHH() {
  const values = Object.values(PLANEJAMENTO_HH).flat()
  return values.reduce((sum, value) => sum + value, 0)
}

export function getHHPlanejadoPorMes(mes) {
  const idx = Math.max(1, Number(mes || 1)) - 1
  let total = 0
  Object.values(PLANEJAMENTO_HH).forEach((values) => {
    total += Number(values[idx] || 0)
  })
  return total
}

export function getHHPlanejadoAcumulado(mes) {
  let total = 0
  const limite = Math.max(1, Math.min(20, Number(mes || 1)))
  for (let i = 1; i <= limite; i++) {
    total += getHHPlanejadoPorMes(i)
  }
  return total
}

export function getPercentualPlanejadoAcumulado(mes) {
  const total = getTotalPlanejadoHH()
  const acumulado = getHHPlanejadoAcumulado(mes)
  if (!total) return 0
  return Math.min(1, acumulado / total)
}

export function getPlanejadoHhByItem(item) {
  const key = normalizeKey(item.grupo_nome || item.grupo || item.atividade || item.descricao || '')
  const matrix = Object.keys(PLANEJAMENTO_HH).find((name) => normalizeKey(name) === key)
  if (matrix && PLANEJAMENTO_HH[matrix]) {
    return PLANEJAMENTO_HH[matrix]
  }
  return FALLBACK_HH_BY_MONTH(item)
}

export function getPlanejadoAcumuladoItem(item, mes) {
  const values = getPlanejadoHhByItem(item)
  const limite = Math.max(1, Math.min(20, Number(mes || 1)))
  return values.slice(0, limite).reduce((sum, value) => sum + toNumber(value), 0)
}

export function getPlanejadoPercentualItem(item, mes) {
  const total = Number(item.hh || 0)
  if (!total) return 0
  return Math.min(1, getPlanejadoAcumuladoItem(item, mes) / total)
}
