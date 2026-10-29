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

// Material EMBUTIDO numa linha de servico (decisao de 29/10/2026): a alvenaria
// em bloco ceramico (4.x.1) tem material e MO na mesma linha. A regra acima vale
// so para a parte do material: orcado do material = orcado da linha x fracao
// (orcamento.csv: 52,04 de material em 95,04/m2), e o custo que conta e so o dos
// fornecedores do material (pagamento de MO da alvenaria nao segura agregado).
// Bloco comprado antes da execucao fica neutro, como aco e forma.
const MATERIAL_EMBUTIDO = [
  { eap: /^4\.\d+\.1$/, fracao: 52.04 / 95.04, fornecedor: /cer[aâ]mica|tijolo|bloco/i },
]
export const materialEmbutido = (eap) => MATERIAL_EMBUTIDO.find((m) => m.eap.test(String(eap || ''))) || null
export const ehFornecedorDoMaterial = (eap, fornecedor) => {
  const m = materialEmbutido(eap)
  return !m || m.fornecedor.test(String(fornecedor || ''))
}

// Linha de material (fracao 1) ou com material embutido: perc = avanco do
// servico (%), pago e aPagar = custo do material. A heranca devolvida e a da
// linha inteira; o agregado = MO pela heranca + material pela regra acima.
export function agregadoDaLinhaComMaterial({ orcado, perc, pago, aPagar, fracao = 1 }) {
  const heranca = (orcado * perc) / 100
  if (fracao >= 1) return agregadoMaterial({ orcado, heranca, pago, aPagar })
  const orcadoMaterial = orcado * fracao
  const mat = agregadoMaterial({ orcado: orcadoMaterial, heranca: heranca * fracao, pago, aPagar })
  return { ...mat, heranca, agregado: heranca - mat.heranca + mat.agregado }
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
    // compra antecipada (material comprado antes da execucao): o custo
    // segura o agregado

    comprado: porCusto > heranca + 0.005,
  }
}
