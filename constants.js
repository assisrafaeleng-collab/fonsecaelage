export const DISCIPLINAS = [
  { key: 'estrutura',    label: 'Estrutura',       orc: 3200 },
  { key: 'alvenaria',    label: 'Alvenaria',        orc: 1400 },
  { key: 'eletrica',     label: 'Inst. Elétrica',   orc: 980  },
  { key: 'hidraulica',   label: 'Hidráulica',       orc: 860  },
  { key: 'revestimento', label: 'Revestimento',     orc: 1100 },
  { key: 'fachada',      label: 'Fachada',          orc: 1250 },
  { key: 'arcond',       label: 'Ar-cond./Elev.',   orc: 900  },
]

// Curva planejada — % acumulado físico e financeiro por mês (Jan–Dez 2026)
// Ajuste esses valores de acordo com o cronograma real da sua obra
export const CURVA_PLANEJADA = [
  { mes: 'Jan/26', idx: 0,  pf: 5,   pn: 4   },
  { mes: 'Fev/26', idx: 1,  pf: 12,  pn: 10  },
  { mes: 'Mar/26', idx: 2,  pf: 20,  pn: 18  },
  { mes: 'Abr/26', idx: 3,  pf: 30,  pn: 28  },
  { mes: 'Mai/26', idx: 4,  pf: 40,  pn: 37  },
  { mes: 'Jun/26', idx: 5,  pf: 52,  pn: 49  },
  { mes: 'Jul/26', idx: 6,  pf: 68,  pn: 65  },
  { mes: 'Ago/26', idx: 7,  pf: 78,  pn: 76  },
  { mes: 'Set/26', idx: 8,  pf: 86,  pn: 84  },
  { mes: 'Out/26', idx: 9,  pf: 93,  pn: 91  },
  { mes: 'Nov/26', idx: 10, pf: 98,  pn: 97  },
  { mes: 'Dez/26', idx: 11, pf: 100, pn: 100 },
]

export function monthIdx(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return (d.getFullYear() - 2026) * 12 + d.getMonth()
}

export function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')
}

export function fmtMoeda(v) {
  if (v == null) return '—'
  return 'R$\u00a0' + Number(v).toLocaleString('pt-BR') + 'k'
}
