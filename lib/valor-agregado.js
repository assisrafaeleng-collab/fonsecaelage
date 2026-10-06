// Regra do valor agregado do MATERIAL (decisao out/26), num lugar so.
//
// Linhas "Apenas Material" de aco e de material de forma, fundacao inclusive.
// Concreto usinado fica fora (entra pela medicao). Agregado = o MAIOR entre
//   (a) avanco do servico x orcado (heranca) e
//   (b) custo da linha (pago + a pagar) limitado ao orcado.
// Linha executada mostra a economia real; material comprado antes da execucao
// fica neutro; o que passar do orcado aparece no IPC.
//
// Toda tela que calcula valor agregado passa por aqui (lib/painel-semanal.js
// e quem o usa: semanal, /valor-agregado e o dashboard mensal).

export const ehMaterialAgregado = (descricao) => {
  const d = String(descricao || '')
  return /apenas material/i.test(d) && /^\s*(a[çc]o\b|material forma)/i.test(d)
}

// orcado, heranca (R$), pago e aPagar (R$) da linha -> agregado e marcacoes
export function agregadoMaterial({ orcado, heranca, pago, aPagar }) {
  const custo = (Number(pago) || 0) + (Number(aPagar) || 0)
  const porCusto = Math.min(custo, orcado)
  return {
    heranca,
    custo,
    agregado: Math.max(heranca, porCusto),
    perc_orcado: orcado > 0 ? (custo / orcado) * 100 : null,
    // material comprado antes da execucao: o custo segura o agregado
    comprado: porCusto > heranca + 0.005,
  }
}
