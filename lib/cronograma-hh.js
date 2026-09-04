// Matriz HH planejada por atividade x mês.
// Fonte: Cronograma_FLAT_BH_-_VERSAO_FINAL.xlsx (aba Cronograma), coluna "Horais Totais",
// distribuida igualmente entre as semanas marcadas na timeline.
// Ajustes manuais definidos pelo engenheiro para itens sem semana marcada:
//   2.1.11 Lastro de concreto magro ....... 51,0 Hh -> M3
//   2.1.12 Impermeabilizacao baldrame ..... 25,6 Hh -> M2
//   8.1.16 Elevador de passageiros ........ 40,0 Hh -> M20 (revisado de 320 para 40 Hh)
// Linhas removidas por duplicacao (mesma atividade e quantidade das 16.1.1 a 16.1.3):
//   16.1.4 Revestimento fachada ACM ....... 60,0 Hh
//   16.1.5 Brise metalico ................. 30,0 Hh
//   16.1.6 Limpeza geral final ............ 122,4 Hh
// Total: 29.754,8 Hh
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
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')   // tira parenteses, virgulas, barras e hifens
  .trim()

const PLANEJAMENTO_HH = {
  'servicos preliminares e gerais': [128.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'movimento de terra e fundacoes': [316.6, 615.9, 51, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'estrutura concreto formas armacao': [51.5, 258.6, 1718, 536.9, 637.6, 1197.8, 852.8, 715.1, 735.6, 859.5, 966.8, 801.4, 773.2, 461.3, 0, 0, 0, 0, 0, 0],
  'alvenaria e fechamentos': [0, 0, 0, 0, 0, 0, 0, 191.3, 382.2, 381.8, 357.9, 357.9, 357.9, 355.1, 353.7, 319.3, 55.2, 0, 0, 0],
  'reboco emboço': [0, 0, 0, 0, 0, 0, 0, 0, 194.2, 423.4, 423.4, 423.4, 423.4, 423.4, 158.4, 175.4, 438.5, 210.5, 0, 0],
  'instalacoes hidrossanitarias': [0, 0, 0, 0, 0, 0, 0, 0, 40, 80.3, 180.2, 180.2, 180.2, 180.2, 180.2, 268.9, 106.3, 0, 0, 0],
  'instalacoes eletricas e telecomunicacoes': [0, 0, 0, 0, 0, 0, 0, 0, 0, 80.4, 223.2, 223.2, 223.2, 223.2, 223.2, 210.9, 173.9, 0, 0, 0],
  'instalacoes especiais': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16.1, 49.2, 56.7, 66.5, 69.8, 276.8, 59, 0, 40],
  'cobertura e impermeabilizacao': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12.1, 48.6, 48.6, 110.5, 131.2, 131.2, 120.3, 118, 0, 0],
  'aplicacao de gesso': [0, 0, 0, 0, 0, 0, 0, 0, 0, 47.5, 189.9, 189.9, 189.9, 189.9, 263.3, 336.7, 146.8, 73.4, 0, 0],
  'pisos e rodapes': [0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 156.5, 274.9, 274.9, 274.9, 337.8, 360.6, 368.5, 214.9, 9.1, 0],
  'esquadrias portas janelas vidros': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 36, 36, 84, 142.5, 86.4, 388.6],
  'pintura': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 121.7, 162.3, 162.3, 162.3, 162.3, 255.6, 492.3, 278.4],
  'loucas metais e bancadas': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 68.5, 91.3, 91.3, 91.3, 91.3, 91.3, 22.8, 0],
  'urbanizacao paisagismo e servicos externos': [0, 0, 0, 18.8, 18.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.8, 11.2, 0],
  'servicos finais': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 99, 114.3, 45.9],
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
  return Math.min(total, getTotalPlanejadoHH())
}

export function getPercentualPlanejadoAcumulado(mes) {
  const total = getTotalPlanejadoHH()
  const acumulado = getHHPlanejadoAcumulado(mes)
  if (!total) return 0
  return Math.min(1, Math.max(0, acumulado / total))
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
  const total = values.slice(0, limite).reduce((sum, value) => sum + toNumber(value), 0)
  return Math.min(total, Number(item.hh || 0))
}

export function getPlanejadoPercentualItem(item, mes) {
  const total = Number(item.hh || 0)
  if (!total) return 0
  return Math.min(1, Math.max(0, getPlanejadoAcumuladoItem(item, mes) / total))
}

// Matriz no nivel de subgrupo (grupo.pavimento), extraida do mesmo cronograma.
// Necessaria porque os grupos 3 (Estrutura) e 4 (Alvenaria) sao executados
// pavimento a pavimento: sem isso, um item do 7o pavimento herdava a janela
// do grupo inteiro e aparecia como iniciado no M1.
const PLANEJAMENTO_HH_SUB = {
  '1.1': [128.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1': [316.6, 615.9, 51, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.1': [51.5, 258.6, 304.1, 0, 0, 13.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.2': [0, 0, 1413.9, 536.9, 536.9, 577, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.3': [0, 0, 0, 0, 100.7, 606.8, 666.7, 77.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.4': [0, 0, 0, 0, 0, 0, 186.2, 637.7, 525.9, 27, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.5': [0, 0, 0, 0, 0, 0, 0, 0, 209.7, 832.4, 434.8, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.6': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 532.1, 620, 186.9, 0, 0, 0, 0, 0, 0, 0],
  '3.7': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 181.4, 586.3, 461.3, 0, 0, 0, 0, 0, 0],
  '4.1': [0, 0, 0, 0, 0, 0, 0, 191.3, 191.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '4.2': [0, 0, 0, 0, 0, 0, 0, 0, 190.9, 381.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '4.3': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 357.9, 179, 0, 0, 0, 0, 0, 0, 0, 0],
  '4.4': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 179, 357.9, 0, 0, 0, 0, 0, 0, 0],
  '4.5': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 355.1, 177.5, 0, 0, 0, 0, 0],
  '4.6': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 176.1, 264.2, 0, 0, 0, 0],
  '4.7': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 55.2, 55.2, 0, 0, 0],
  '5.1': [0, 0, 0, 0, 0, 0, 0, 0, 194.2, 423.4, 423.4, 423.4, 423.4, 423.4, 158.4, 175.4, 438.5, 210.5, 0, 0],
  '6.1': [0, 0, 0, 0, 0, 0, 0, 0, 40, 80.3, 180.2, 180.2, 180.2, 180.2, 180.2, 268.9, 106.3, 0, 0, 0],
  '7.1': [0, 0, 0, 0, 0, 0, 0, 0, 0, 80.4, 223.2, 223.2, 223.2, 223.2, 223.2, 210.9, 173.9, 0, 0, 0],
  '8.1': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16.1, 49.2, 56.7, 66.5, 69.8, 276.8, 59, 0, 40],
  '9.1': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12.1, 48.6, 48.6, 110.5, 131.2, 131.2, 120.3, 118, 0, 0],
  '10.1': [0, 0, 0, 0, 0, 0, 0, 0, 0, 47.5, 189.9, 189.9, 189.9, 189.9, 263.3, 336.7, 146.8, 73.4, 0, 0],
  '11.1': [0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 156.5, 274.9, 274.9, 274.9, 337.8, 360.6, 368.5, 214.9, 9.1, 0],
  '12.1': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 36, 36, 84, 142.5, 86.4, 388.6],
  '13.1': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 121.7, 162.3, 162.3, 162.3, 162.3, 255.6, 492.3, 278.4],
  '14.1': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 68.5, 91.3, 91.3, 91.3, 91.3, 91.3, 22.8, 0],
  '15.1': [0, 0, 0, 18.8, 18.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.8, 11.2, 0],
  '16.1': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 99, 114.3, 45.9],
}

// Recebe o cod_eap do item (ex.: '3.7.4') e devolve a distribuicao mensal do
// subgrupo correspondente ('3.7'), ou null se nao houver.
export function getPlanejadoHhBySubgrupo(codEap) {
  const partes = String(codEap || '').split('.')
  if (partes.length < 2) return null
  const chave = partes[0] + '.' + partes[1]
  return PLANEJAMENTO_HH_SUB[chave] || null
}
