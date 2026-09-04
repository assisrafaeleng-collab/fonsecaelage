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
  'movimento de terra e fundacoes': [316.6, 666.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'estrutura concreto formas armacao': [51.5, 258.6, 1731.9, 536.9, 637.6, 1183.9, 852.8, 715.1, 735.6, 859.5, 966.8, 801.4, 773.2, 461.3, 0, 0, 0, 0, 0, 0],
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

// ---------------------------------------------------------------------------
// Niveis mais finos da mesma matriz, extraidos do mesmo cronograma.
//
// SUB  = grupo.pavimento (ex.: '3.7'). Necessario porque Estrutura e Alvenaria
//        sao executadas pavimento a pavimento.
// ITEM = subgrupo + descricao normalizada da atividade. Da a janela real de
//        cada servico: a armacao do 1o pavimento vai de M1 a M2, a forma de
//        M2 a M3 — sem isso a tela distribui o peso igualmente pela janela do
//        grupo e mostra a mesma porcentagem para todos os itens.
//
// O casamento e por descricao, e nao por codigo, porque a numeracao do
// orcamento e a do cronograma divergem dentro do grupo 3.
// ---------------------------------------------------------------------------

const PLANEJAMENTO_HH_SUB = {
  '1.1': [128.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1': [316.6, 666.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.1': [51.5, 258.6, 318, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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

const PLANEJAMENTO_HH_ITEM = {
  '1.1|barracao de obra em chapa compensada escritor': [80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '1.1|instalacoes sanitarias provisorias sanitario ': [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '1.1|ligacao provisoria de agua energia e esgoto': [8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '1.1|locacao convencional de obra gabarito prancho': [31.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '1.1|placa de obra em chapa galvanizada 4 00 2 00 ': [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '10.1|forro de gesso rebaixado em placas flats e ar': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 73.4, 146.8, 146.8, 73.4, 0, 0],
  '10.1|revestimento de gesso liso em parede interna ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 47.5, 189.9, 189.9, 189.9, 189.9, 189.9, 189.9, 0, 0, 0, 0],
  '11.1|azulejo ceramico 3040 cm paredes h 2 70 m': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 65.4, 130.8, 130.8, 130.8, 130.8, 130.8, 130.8, 65.4, 0, 0],
  '11.1|contrapiso autonivelante e 3 cm todas as area': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 73.4, 73.4, 73.4, 73.4, 73.4, 73.4, 73.4, 0, 0, 0],
  '11.1|laminado de madeira ac4 c rodape de 5cm quart': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 62.8, 83.7, 83.7, 83.7, 0, 0],
  '11.1|peitoris de granito verde ubatuba': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.1, 24.3, 0, 0],
  '11.1|piso polido': [0, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '11.1|piso tatil direcional alerta passeio publico': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2.4, 7.2, 0],
  '11.1|porcelanato 6060 cm retificado cor clara area': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16.5, 65.9, 65.9, 65.9, 65.9, 65.9, 65.9, 32.9, 0, 0],
  '11.1|rodape porcelanato h 7 cm sobre piso porcelan': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.9, 3.8, 3.8, 1.9, 0],
  '11.1|soleira de granito verde ubatuba e 2 cm': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.2, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8, 2.4, 0, 0],
  '12.1|alcapao metalico de acesso a cobertura': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6],
  '12.1|box de banheiro em vidro temperado 8 mm incol': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 196.6],
  '12.1|escada marinheiro': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6],
  '12.1|guarda corpo em ferro circular h 1 10m sacada': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 180],
  '12.1|janela de aluminio anodizado linha veneziana ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 115, 25, 0],
  '12.1|kit porta de madeira 60210 cm': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4.5, 0, 0],
  '12.1|kit porta de madeira 80210 cm entrada apto fo': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 36, 36, 36, 9, 0, 0],
  '12.1|kit porta de madeira 85210 cm': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 27, 0, 0, 0],
  '12.1|porta 100x250 cm blindex': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.5, 0, 0],
  '12.1|porta 205x250 cm blindex': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.5, 0, 0],
  '12.1|porta 220x250 cm blindex': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.5, 0],
  '12.1|porta 270x250 cm blindex': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.5, 0, 0],
  '12.1|porta 350x250 cm blindex': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.5, 0, 0],
  '12.1|porta 90210 cm blindex correr': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 21, 0, 0, 0],
  '12.1|porta basculante metalica loja pintura esmalt': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 0],
  '12.1|vidro fixo 160x250': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0],
  '12.1|vidro fixo 553x250': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0],
  '12.1|vidro fixo 632x250': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0],
  '13.1|massa corrida pva sobre gesso 2 demaos': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 47.2, 62.9, 62.9, 62.9, 62.9, 62.9, 62.9, 15.7],
  '13.1|pintura esmalte sintetico corrimao': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 3.3, 0],
  '13.1|pintura esmalte sintetico portas metalicas e ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14.4, 14.4, 3.6],
  '13.1|pintura latex pva selador 2 demaos cor branca': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 74.5, 99.3, 99.3, 99.3, 99.3, 99.3, 99.3, 24.8],
  '13.1|textura rolada acrilica selador fachadas 3 fa': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 78.1, 312.3, 234.2],
  '14.1|acessorios para bwc padrao r8 papeleira sabon': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.6, 4.8, 4.8, 4.8, 4.8, 4.8, 1.2, 0],
  '14.1|bacia sanitaria branca com caixa acoplada pad': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8.1, 10.8, 10.8, 10.8, 10.8, 10.8, 2.7, 0],
  '14.1|bancada de granito verde ubatuba banheiros la': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.9, 9.2, 9.2, 9.2, 9.2, 9.2, 2.3, 0],
  '14.1|bancada de granito verde ubatuba cozinhas': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 18.1, 24.2, 24.2, 24.2, 24.2, 24.2, 6, 0],
  '14.1|cuba inox 403417 cm para bancada cozinhas': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.2, 8.3, 8.3, 8.3, 8.3, 8.3, 2.1, 0],
  '14.1|lavatorio com coluna ou cuba de embutir padra': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7.2, 9.5, 9.5, 9.5, 9.5, 9.5, 2.4, 0],
  '14.1|registro de gaveta chuveiro padrao r8 conjunt': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.4, 4.5, 4.5, 4.5, 4.5, 4.5, 1.1, 0],
  '14.1|sifao pvc ligacao flexivel kit': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4.5, 6, 6, 6, 6, 6, 1.5, 0],
  '14.1|tanque de pvc 40 cm area de servico': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 5.4, 5.4, 5.4, 5.4, 5.4, 1.3, 0],
  '14.1|torneira de cozinha padrao r8': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2.7, 2.7, 2.7, 2.7, 2.7, 0.7, 0],
  '14.1|torneira de lavatorio padrao r8': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2.6, 3.5, 3.5, 3.5, 3.5, 3.5, 0.9, 0],
  '14.1|torneira de tanque padrao r8': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.8, 2.4, 2.4, 2.4, 2.4, 2.4, 0.6, 0],
  '15.1|drenagem externa canaleta pre moldada caixa d': [0, 0, 0, 18.8, 18.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '15.1|iluminacao externa led 20w em luminarias padr': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.8, 11.2, 0],
  '16.1|brise metalico': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 33, 33, 0],
  '16.1|limpeza geral final de obra': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15.3, 45.9],
  '16.1|revestimento de fachada em acm placas alumini': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 66, 66, 0],
  '2.1|arrasamento de estacas': [52, 52, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|bloco de coroamento concreto armado fck 25 mp': [0, 116.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|caminhao de terra': [13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|concreto usinado fck 25 mpa estrutural bombea': [45, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|escavacao manual em material 1 categoria ate ': [148.6, 297.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|escavacao mecanizada': [17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|estaca helice continua 40 cm e 50 cm': [40.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|impermeabilizacao baldrame com emulsao asfalt': [0, 25.6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|lastro de concreto magro fck 10 mpa e 5 cm': [0, 51, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|retroescavadeira movimentacao de terra da hel': [0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '2.1|viga baldrame de concreto armado fck 25 mpa s': [0, 124.4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.1|armacao aco ca 50 incl corte dobra montagem e': [51.5, 154.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.1|concreto usinado fck 25 mpa estrutural bombea': [0, 0, 17.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.1|execucao escadas': [0, 0, 13.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.1|forma de chapa compensada plastificada 18 mm ': [0, 104.1, 208.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.1|lancamento adensamento e acabamento de concre': [0, 0, 78.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.2|armacao aco ca 50 incl corte dobra montagem e': [0, 0, 1279.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.2|concreto usinado fck 25 mpa estrutural bombea': [0, 0, 0, 0, 0, 75.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.2|execucao escadas': [0, 0, 0, 0, 0, 20.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.2|forma de chapa compensada plastificada 18 mm ': [0, 0, 134.2, 536.9, 536.9, 134.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.2|lancamento adensamento e acabamento de concre': [0, 0, 0, 0, 0, 346.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.3|armacao aco ca 50 incl corte dobra montagem e': [0, 0, 0, 0, 100.7, 302.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.3|concreto usinado fck 25 mpa estrutural bombea': [0, 0, 0, 0, 0, 5.1, 20.5, 10.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.3|execucao escadas': [0, 0, 0, 0, 0, 0, 0, 20.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.3|forma de chapa compensada plastificada 18 mm ': [0, 0, 0, 0, 0, 276.2, 552.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.3|lancamento adensamento e acabamento de concre': [0, 0, 0, 0, 0, 23.4, 93.8, 46.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.4|armacao aco ca 50 incl corte dobra montagem e': [0, 0, 0, 0, 0, 0, 186.2, 186.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.4|concreto usinado fck 25 mpa estrutural bombea': [0, 0, 0, 0, 0, 0, 0, 9.7, 19.4, 4.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.4|execucao escadas': [0, 0, 0, 0, 0, 0, 0, 0, 20.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.4|forma de chapa compensada plastificada 18 mm ': [0, 0, 0, 0, 0, 0, 0, 397.5, 397.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.4|lancamento adensamento e acabamento de concre': [0, 0, 0, 0, 0, 0, 0, 44.4, 88.8, 22.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.5|armacao aco ca 50 incl corte dobra montagem e': [0, 0, 0, 0, 0, 0, 0, 0, 209.7, 209.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.5|concreto usinado fck 25 mpa estrutural bombea': [0, 0, 0, 0, 0, 0, 0, 0, 0, 12.3, 24.6, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.5|execucao escadas': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20.2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.5|forma de chapa compensada plastificada 18 mm ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 554, 277, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.5|lancamento adensamento e acabamento de concre': [0, 0, 0, 0, 0, 0, 0, 0, 0, 56.4, 112.9, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.6|armacao aco ca 50 incl corte dobra montagem e': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 409, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '3.6|concreto usinado fck 25 mpa estrutural bombea': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 22.9, 11.4, 0, 0, 0, 0, 0, 0, 0],
  '3.6|forma de chapa compensada plastificada 18 mm ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 123.1, 492.3, 123.1, 0, 0, 0, 0, 0, 0, 0],
  '3.6|lancamento adensamento e acabamento de concre': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 104.8, 52.4, 0, 0, 0, 0, 0, 0, 0],
  '3.7|armacao aco ca 50 incl corte dobra montagem e': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 181.4, 181.4, 0, 0, 0, 0, 0, 0, 0],
  '3.7|concreto usinado fck 25 mpa estrutural bombea': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10.1, 20.2, 0, 0, 0, 0, 0, 0],
  '3.7|forma de chapa compensada plastificada 18 mm ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 348.4, 348.4, 0, 0, 0, 0, 0, 0],
  '3.7|lancamento adensamento e acabamento de concre': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 46.3, 92.7, 0, 0, 0, 0, 0, 0],
  '4.1|alvenaria de vedacao bloco ceramico 141929 cm': [0, 0, 0, 0, 0, 0, 0, 185.5, 185.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '4.1|execucao de verga e contra verga': [0, 0, 0, 0, 0, 0, 0, 5.8, 5.8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '4.2|alvenaria de vedacao bloco ceramico 141929 cm': [0, 0, 0, 0, 0, 0, 0, 0, 185.1, 370.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '4.2|execucao de verga e contra verga': [0, 0, 0, 0, 0, 0, 0, 0, 5.8, 11.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '4.3|alvenaria de vedacao bloco ceramico 141929 cm': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 347.1, 173.6, 0, 0, 0, 0, 0, 0, 0, 0],
  '4.3|execucao de verga e contra verga': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10.8, 5.4, 0, 0, 0, 0, 0, 0, 0, 0],
  '4.4|alvenaria de vedacao bloco ceramico 141929 cm': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 173.6, 347.1, 0, 0, 0, 0, 0, 0, 0],
  '4.4|execucao de verga e contra verga': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5.4, 10.8, 0, 0, 0, 0, 0, 0, 0],
  '4.5|alvenaria de vedacao bloco ceramico 141929 cm': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 344.4, 172.2, 0, 0, 0, 0, 0],
  '4.5|execucao de verga e contra verga': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10.7, 5.4, 0, 0, 0, 0, 0],
  '4.6|alvenaria de vedacao bloco ceramico 141929 cm': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 170.8, 256.2, 0, 0, 0, 0],
  '4.6|execucao de verga e contra verga': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5.3, 8, 0, 0, 0, 0],
  '4.7|alvenaria de vedacao bloco ceramico 141929 cm': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 52.8, 52.8, 0, 0, 0],
  '4.7|execucao de verga e contra verga': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2.4, 2.4, 0, 0, 0],
  '5.1|chapisco para alvenaria cimento areia 1 3 tod': [0, 0, 0, 0, 0, 0, 0, 0, 176.6, 353.2, 353.2, 353.2, 353.2, 353.2, 88.3, 0, 0, 0, 0, 0],
  '5.1|emboco': [0, 0, 0, 0, 0, 0, 0, 0, 17.5, 70.1, 70.1, 70.1, 70.1, 70.1, 70.1, 70.1, 17.5, 0, 0, 0],
  '5.1|reboco externo e 2 0 cm areas externas e am': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 105.2, 421, 210.5, 0, 0],
  '6.1|caixa de gordura coletiva alvenaria 6060 cm t': [0, 0, 0, 0, 0, 0, 0, 0, 0, 3.8, 5.1, 5.1, 5.1, 5.1, 5.1, 2.6, 0, 0, 0, 0],
  '6.1|caixa de inspecao alvenaria 6060 cm tampa con': [0, 0, 0, 0, 0, 0, 0, 0, 0, 5.8, 7.7, 7.7, 7.7, 7.7, 7.7, 3.8, 0, 0, 0, 0],
  '6.1|cisterna de concreto armado 10 000 l inferior': [0, 0, 0, 0, 0, 0, 0, 0, 40, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  '6.1|coluna de prumada agua fria pvc dn32 incluind': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7.3, 7.3, 7.3, 7.3, 7.3, 7.3, 5.5, 0, 0, 0],
  '6.1|coluna de prumada esgoto pvc dn100 incluindo ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 4.1, 0, 0, 0],
  '6.1|conjunto moto bomba de recalque 5 cv q 20 m h': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0],
  '6.1|hidrometro individual caixa de protecao': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 0, 0, 0, 0],
  '6.1|infra para hidraulica': [0, 0, 0, 0, 0, 0, 0, 0, 0, 11.4, 45.7, 45.7, 45.7, 45.7, 45.7, 45.7, 34.3, 0, 0, 0],
  '6.1|ponto de agua fria tubulacao pvc soldavel dn2': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 38.1, 38.1, 38.1, 38.1, 38.1, 38.1, 28.6, 0, 0, 0],
  '6.1|ponto de agua quente ppr dn20 25': [0, 0, 0, 0, 0, 0, 0, 0, 0, 12.1, 16.1, 16.1, 16.1, 16.1, 16.1, 8.1, 0, 0, 0, 0],
  '6.1|ponto de aguas pluviais pvc serie reforcada d': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 4, 0, 0, 0],
  '6.1|ponto de esgoto primario pvc serie normal dn4': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 39.7, 39.7, 39.7, 39.7, 39.7, 39.7, 29.8, 0, 0, 0],
  '6.1|ramal de ligacao a rede publica agua esgoto': [0, 0, 0, 0, 0, 0, 0, 0, 0, 7.2, 9.6, 9.6, 9.6, 9.6, 9.6, 4.8, 0, 0, 0, 0],
  '6.1|reservatorio de combate a incendio 2 000 l em': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0],
  '6.1|reservatorio superior em fibra de vidro 20 00': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0],
  '7.1|disjuntor termomagnetico din unipolar 10 a 32': [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 7.9, 7.9, 7.9, 7.9, 7.9, 7.9, 7.9, 0, 0, 0],
  '7.1|eletroduto pvc rigido 3 4 incluindo conexoes': [0, 0, 0, 0, 0, 0, 0, 0, 0, 25.3, 101.4, 101.4, 101.4, 101.4, 101.4, 101.4, 101.4, 0, 0, 0],
  '7.1|infra para eletrica': [0, 0, 0, 0, 0, 0, 0, 0, 0, 36.9, 49.2, 49.2, 49.2, 49.2, 49.2, 36.9, 0, 0, 0, 0],
  '7.1|padrao de entrada cemig trifasico caixa medid': [0, 0, 0, 0, 0, 0, 0, 0, 0, 2.8, 11, 11, 11, 11, 11, 11, 11, 0, 0, 0],
  '7.1|ponto de iluminacao eletroduto caixa condutor': [0, 0, 0, 0, 0, 0, 0, 0, 0, 2.8, 11.2, 11.2, 11.2, 11.2, 11.2, 11.2, 11.2, 0, 0, 0],
  '7.1|ponto de interruptor simples paralelo eletrod': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 2.9, 2.9, 2.9, 2.9, 2.9, 2.9, 2.9, 0, 0, 0],
  '7.1|ponto de telefone dados cabeamento estruturad': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 0, 0, 0],
  '7.1|ponto de tomada 2p t 10a eletroduto caixa con': [0, 0, 0, 0, 0, 0, 0, 0, 0, 2.7, 10.8, 10.8, 10.8, 10.8, 10.8, 10.8, 10.8, 0, 0, 0],
  '7.1|ponto de tv antena coletiva': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 2.8, 2.8, 2.8, 2.8, 2.8, 2.8, 2.8, 0, 0, 0],
  '7.1|quadro de distribuicao qdl embutido 12 a 24 d': [0, 0, 0, 0, 0, 0, 0, 0, 0, 3.1, 12.4, 12.4, 12.4, 12.4, 12.4, 12.4, 12.4, 0, 0, 0],
  '7.1|sistema de controle de acesso facial cameras ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.1, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 4.4, 0, 0, 0],
  '7.1|sistema de interfone com video porteiro centr': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.4, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 0, 0, 0],
  '8.1|bomba de incendio acessorios': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 25.6, 6.4, 0, 0],
  '8.1|central glp p 13 com abrigo ventilado terreo': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2.9, 5.8, 5.8, 5.8, 5.8, 5.8, 0, 0, 0],
  '8.1|elevador de passageiros': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40],
  '8.1|extintor co2 6 kg': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.2, 0.8, 0, 0],
  '8.1|extintor pqs 6 kg': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12.8, 3.2, 0, 0],
  '8.1|hidrante de parede completo mangotinho abrigo': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.1, 4.6, 4.6, 4.6, 4.6, 4.6, 0, 0, 0],
  '8.1|iluminacao de emergencia em bloco autonomo le': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 19.2, 4.8, 0, 0],
  '8.1|infraestrutura split ponto eletrico dreno sup': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64.1, 21.4, 0, 0],
  '8.1|medidor de gas individual': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3.1, 6.2, 6.2, 6.2, 6.2, 6.2, 0, 0, 0],
  '8.1|ponto de gas cozinha': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2.6, 5.2, 5.2, 5.2, 5.2, 5.2, 0, 0, 0],
  '8.1|porta corta fogo p 90 escada': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9.8, 13.1, 13.1, 0, 0, 0],
  '8.1|sinalizacao fotoluminescente placas': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 25.6, 6.4, 0, 0],
  '8.1|sistema de alarme deteccao de incendio centra': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 64, 16, 0, 0],
  '8.1|sistema spda captor franklin malha descidas a': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7.5, 15, 15, 15, 7.5, 0, 0, 0],
  '8.1|tubulacao de gas em cobre rigido tipo l 22mm': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.4, 12.7, 12.7, 12.7, 12.7, 12.7, 0, 0, 0],
  '8.1|tubulacao de incendio aco galvanizado 65 mm 2': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7.2, 7.2, 7.2, 7.2, 7.2, 0, 0, 0],
  '9.1|calha em chapa galvanizada 24 desenvolvimento': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8.8, 26.2, 0, 0],
  '9.1|condutor de aguas pluviais tubo pvc dn100': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7.2, 21.6, 0, 0],
  '9.1|impermeabilizacao banheiros viaplus 1000 sobr': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6.7, 26.8, 26.8, 26.8, 26.8, 26.8, 6.7, 0, 0, 0],
  '9.1|impermeabilizacao cozinhas e area de servico ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 11.9, 11.9, 11.9, 11.9, 11.9, 3, 0, 0, 0],
  '9.1|impermeabilizacao laje cobertura manta asfalt': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 61.9, 82.6, 82.6, 82.6, 41.3, 0, 0],
  '9.1|impermeabilizacao reservatorios viaplus 5000': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2.5, 9.9, 9.9, 9.9, 9.9, 9.9, 2.5, 0, 0, 0],
  '9.1|rufo em chapa galvanizada 24 desenvolvimento ': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9.6, 28.9, 0, 0],
}

const chaveSubgrupo = (codEap) => {
  const partes = String(codEap || '').split('.')
  return partes.length >= 2 ? partes[0] + '.' + partes[1] : ''
}

const normDesc = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .slice(0, 45)

// Distribuicao mensal do subgrupo do item, ou null.
export function getPlanejadoHhBySubgrupo(codEap) {
  const chave = chaveSubgrupo(codEap)
  return chave ? (PLANEJAMENTO_HH_SUB[chave] || null) : null
}

// Distribuicao mensal da atividade especifica, ou null se nao houver par.
// Tenta a descricao exata e depois por prefixo, para absorver sufixos como
// "- Apenas MO" ou "- Concreto + MO" que existem so em uma das bases.
export function getCurvaItem(codEap, descricao) {
  const sub = chaveSubgrupo(codEap)
  if (!sub) return null
  const alvo = normDesc(descricao)
  if (!alvo) return null
  const exata = PLANEJAMENTO_HH_ITEM[sub + '|' + alvo]
  if (exata) return exata
  const prefixo = sub + '|'
  const chaves = Object.keys(PLANEJAMENTO_HH_ITEM).filter((k) => k.startsWith(prefixo))
  for (const k of chaves) {
    const desc = k.slice(prefixo.length)
    if (desc.startsWith(alvo) || alvo.startsWith(desc)) return PLANEJAMENTO_HH_ITEM[k]
  }
  return null
}

// Fracao (0 a 1) do servico prevista ate o mes informado, na curva mais fina
// disponivel: item, depois subgrupo. Devolve null se nao houver curva.
export function getFracaoPlanejada(codEap, descricao, mes) {
  const curva = getCurvaItem(codEap, descricao) || getPlanejadoHhBySubgrupo(codEap)
  if (!curva) return null
  const total = curva.reduce((s, v) => s + (Number(v) || 0), 0)
  if (!total) return null
  const limite = Math.max(0, Math.min(20, Number(mes) || 0))
  const acum = curva.slice(0, limite).reduce((s, v) => s + (Number(v) || 0), 0)
  return Math.min(1, Math.max(0, acum / total))
}
