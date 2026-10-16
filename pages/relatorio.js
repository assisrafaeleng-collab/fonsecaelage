// Relatório gerencial por período (decisão de 16/10/2026; mesmo do Sirius 60, adaptado) — para os gestores, em
// linguagem simples. /relatorio?de=AAAA-MM-DD&ate=AAAA-MM-DD, aberto pelo botão "Gerar relatório" da semanal.
// Página pronta para imprimir: A4 retrato, cabeçalho e rodapé "Flats Pampulha · período · página X de Y" (@page),
// um bloco por página; "Baixar PDF" chama a impressão do navegador ("Salvar como PDF"). Sem pacote novo.
// Os números vêm das MESMAS rotas dos cards e painéis do site (lib/relatorio.js organiza):
//   custo, valor do que foi feito, grupos, indiretos, curva e a pagar da semana: /api/dashboard-semanal;
//   prazo (adiantamento), situação das atividades, janela projetada, caixa de 30 dias: /api/pontos-atencao;
//   títulos a pagar: /api/contas-a-pagar da carga usada na semana final.
// Sem siglas: "valor do que foi feito" (valor agregado), "rendimento do custo", "avanço físico".
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react'
import { hojeSaoPaulo } from '../components/GerarRelatorio'
import { periodoEmSemanas, ultimaMedicao, custoDireto, custoIndireto, prazo, custoFinal, fisicoDoPeriodo,
  financeiroPorGrupo, riscoDeEstouro, caixa30, produtividadeBaixa, situacao, corRendimento, corPrazo, corSaldoPct,
  dmy, dm, diasEntre } from '../lib/relatorio'

const OBRA = { nome: 'Flats Pampulha', endereco: 'Av. Coronel José Dias Bicalho, 635 · São José · Belo Horizonte' }
const COR = { verde: '#2f7d4a', amarelo: '#b98200', vermelho: '#b3261e', cinza: '#8a9099', azul: '#2f6db3' }
const TXT = '#1d232b'
const SUAVE = '#5b6470'
const LINHA = '#d9dde3'
const FUNDO = '#f4f6f8'
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const fmt2 = (v) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const pc1 = (v) => (v == null || !isFinite(v) ? '—' : `${Number(v).toFixed(1).replace('.', ',')}%`)
const virg = (v, c = 2) => (v == null || !isFinite(v) ? '—' : Number(v).toFixed(c).replace('.', ','))
function mil(v) {
  if (v == null || !isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e6) return `R$ ${(a / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} milhões`
  if (a >= 1e3) return `R$ ${Math.round(a / 1e3).toLocaleString('pt-BR')} mil`
  return `R$ ${Math.round(a).toLocaleString('pt-BR')}`
}
const S2 = (n) => `S${String(n).padStart(2, '0')}`
const descCurta = (d) => String(d || '').replace(/\s*-\s*(Apenas MO|Apenas Material|\(Apenas Material\).*)$/i, '').trim()
const custoTxt = (pago, ap, f = fmt2) => `${f((pago || 0) + (ap || 0))} (pago ${f(pago || 0)} + a pagar ${f(ap || 0)})`
const semanasTxt = (s) => `${virg(Math.abs(s), 1)} semana${Math.abs(s) >= 1.95 ? 's' : ''}`

async function pegar(url) {
  const r = await fetch(url, { cache: 'no-store' })
  const j = await r.json()
  if (!r.ok || j.error) throw new Error(`${url}: ${j.message || j.error || r.status}`)
  return j
}

export default function Relatorio() {
  const router = useRouter()
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!router.isReady) return
    const de = String(router.query.de || '')
    const ate = String(router.query.ate || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
      setErro('Período inválido. Volte ao acompanhamento semanal e escolha a data inicial e a final.')
      return
    }
    ;(async () => {
      try {
        const base = await pegar('/api/dashboard-semanal') // calendário de semanas da obra
        const per = periodoEmSemanas(de, ate, base.curva)
        if (!per) throw new Error(`o período termina antes do início da obra (${dmy(base.curva[0].data_inicio)})`)
        const [pFim, pAntes, pa] = await Promise.all([
          per.sFim === base.semana_atual ? Promise.resolve(base) : pegar(`/api/dashboard-semanal?semana=${per.sFim}`),
          per.sAntes >= 1 ? pegar(`/api/dashboard-semanal?semana=${per.sAntes}`) : Promise.resolve(null),
          pegar(`/api/pontos-atencao?semana=${per.sFim}`),
        ])
        const cp = pFim.contas_a_pagar
        const contas = cp && cp.disponivel && cp.fechamento ? await pegar(`/api/contas-a-pagar?fechamento=${cp.fechamento}`) : null
        setD({ per, pFim, pAntes, pa, contas, med: ultimaMedicao(pFim), gerado: hojeSaoPaulo() })
      } catch (e) {
        setErro(e.message)
      }
    })()
  }, [router.isReady, router.query.de, router.query.ate])

  const cab = d ? `${OBRA.nome} · ${dmy(d.per.de)} a ${dmy(d.per.ate)}` : OBRA.nome
  return (
    <>
      <Head>
        <title>{d ? `Relatório Flats Pampulha - ${d.per.de} a ${d.per.ate}` : 'Relatório da obra'}</title>
      </Head>
      {/* CSS como HTML: em texto, as aspas do @page saem diferentes no servidor e no navegador (erro de hidratação) */}
      <style dangerouslySetInnerHTML={{ __html: css(cab) }} />
      <div className="barra nao-imprime">
        <a onClick={() => router.push('/semanal')} style={{ cursor: 'pointer' }}>← Acompanhamento semanal</a>
        <span style={{ flex: 1 }} />
        <span className="dica">No destino da impressão, escolha "Salvar como PDF"</span>
        <button onClick={() => window.print()} disabled={!d}>Baixar PDF</button>
      </div>
      {erro && <div className="folha"><p>Não foi possível montar o relatório: {erro}</p></div>}
      {!erro && !d && <div className="folha"><p>Montando o relatório… (leva alguns segundos)</p></div>}
      {d && <Conteudo d={d} />}
      {d && <div id="relatorio-pronto" style={{ display: 'none' }} />}
    </>
  )
}

/* ─── CONTAS (todas pelas rotas e funções do site) ─────────────────────────────── */
function montar(d) {
  const { per, pFim, pAntes, pa, med } = d
  const medNoPeriodo = !!med && med.semana >= per.sIni
  const dir = custoDireto(pFim, pAntes, per)
  const ind = custoIndireto(pFim, per)
  const prz = prazo(pFim, pa, med)
  const fin = financeiroPorGrupo(pFim, pAntes)
  return { medNoPeriodo, dir, ind, prz, fin, final: custoFinal(pFim, dir, prz), cx: caixa30(pa),
    fis: fisicoDoPeriodo(pFim, pAntes, pa, !!med && !medNoPeriodo), risco: riscoDeEstouro(fin), lenta: produtividadeBaixa(pa) }
}

function Conteudo({ d }) {
  const m = montar(d)
  return (
    <>
      <Capa d={d} />
      <Resumo d={d} m={m} />
      <Fisico d={d} m={m} />
      <Financeiro d={d} m={m} />
      <Graficos d={d} />
      <Proximos d={d} m={m} />
      <Atencao d={d} m={m} />
    </>
  )
}

/* ─── PEÇAS ─────────────────────────────────────────────────────────────────────── */
// Semáforo em SVG (sai colorido na impressão) + a palavra ao lado (lê também em preto e branco)
const PALAVRA = { verde: 'OK', amarelo: 'atenção', vermelho: 'problema', cinza: 'sem dado', azul: 'informação' }
function Sinal({ cor, grande, semPalavra, palavra }) {
  const t = grande ? 16 : 10
  return (
    <span className="sinal">
      <svg width={t} height={t} viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill={COR[cor] || COR.cinza} /></svg>
      {!semPalavra && <span className="palavra" style={{ color: COR[cor] || COR.cinza }}>{palavra || PALAVRA[cor] || ''}</span>}
    </span>
  )
}
const Nota = ({ children }) => <div className="nota">{children}</div>

/* 1. CAPA */
function Capa({ d }) {
  const { per, med } = d
  return (
    <section className="folha capa">
      <div className="capa-topo">{OBRA.endereco}</div>
      <h1>{OBRA.nome}</h1>
      <h2>Relatório da obra — {dmy(per.de)} a {dmy(per.ate)}</h2>
      <div className="capa-dados">
        <div><b>Gerado em</b> {dmy(d.gerado)}</div>
        <div><b>Última medição até {dmy(per.ate)}</b> {med ? `${S2(med.semana)} · ${dmy(med.data)}` : 'nenhuma'}</div>
        <div><b>Semanas do período</b> {S2(per.sIni)} a {S2(per.sFim)} ({dmy(per.iniReal)} a {dmy(per.fimReal)})</div>
        <div><b>Obra</b> {dmy(per.inicioObra)} a {dmy(per.fimObra)} · {d.pFim.curva.length} semanas</div>
      </div>
      {(per.ajusteFim || per.ajusteIni) && (
        <Nota>
          As contas da obra são fechadas por semana. Este relatório usa as semanas {S2(per.sIni)} a {S2(per.sFim)}
          {per.ajusteFim ? `; a data final vai até o fim da semana (${dmy(per.fimReal)})` : ''}
          {per.ajusteIni ? `; a data inicial vai do começo da semana (${dmy(per.iniReal)})` : ''}.
        </Nota>
      )}
      <div className="capa-legenda">
        <div><Sinal cor="verde" semPalavra /> verde = OK</div>
        <div><Sinal cor="amarelo" semPalavra /> amarelo = atenção</div>
        <div><Sinal cor="vermelho" semPalavra /> vermelho = problema</div>
        <div><Sinal cor="cinza" semPalavra /> cinza = sem dado no período</div>
      </div>
    </section>
  )
}

/* 2. RESUMO EM 4 PERGUNTAS */
function Pergunta({ q, cor, grande, frase, children }) {
  return (
    <div className="pergunta">
      <div className="pq">{q}</div>
      <div className="pr"><Sinal cor={cor} grande /><span className="grande" style={{ color: COR[cor] || TXT }}>{grande}</span></div>
      <div className="frase">{frase}</div>
      {children}
    </div>
  )
}
function Resumo({ d, m }) {
  const { per, med } = d
  const fim = dmy(per.fimReal)
  const { dir, ind, prz, final: f, cx } = m
  const p = dir.periodo
  // a) custo direto (acumulado decide o semáforo; o período é a informação do foco)
  const a = dir.feito > 0.005
    ? { cor: corRendimento(dir.rendimento), grande: `${mil(dir.saldo)} de ${dir.saldo >= 0 ? 'economia' : 'estouro'}`,
        frase: <>
          <b>No período</b>: o cronograma previa {mil(p.previsto)} de serviço; foi feito <b>{mil(p.feito)}</b> (a preço de orçamento),
          que custou <b>{mil(p.custo)}</b> (pago {mil(p.pago)} + variação do a pagar {mil(p.a_pagar_fim - p.a_pagar_ini)}).
          <div style={{ marginTop: 4 }}><b>Desde o início, até {fim}</b>: o serviço feito vale {mil(dir.feito)} e custou {custoTxt(dir.pago, dir.a_pagar, mil)}:
            {' '}gastamos <b>{mil(dir.saldo)} a {dir.saldo >= 0 ? 'menos' : 'mais'}</b> do que ele vale. Para cada R$ 1,00 gasto, a obra entregou
            {' '}<b>R$ {virg(dir.rendimento)}</b> de serviço.</div>
          <div className="motivo" style={{ marginTop: 4 }}>Pagamentos de um período podem se referir a serviços medidos antes; por isso o semáforo é o do acumulado.</div>
        </> }
    : { cor: 'cinza', grande: 'sem dado', frase: 'Ainda não há serviço medido até a data final.' }
  const ci = !(ind.plan > 0) ? 'cinza' : ind.pendencias > 0 ? 'amarelo' : corSaldoPct((100 * ind.economia_real) / ind.plan)
  const nomes = (ls) => {
    const n = ls.map((c) => String(c.categoria || '').replace(/\s*\(.*\)\s*/g, ' ').trim().toLowerCase())
    return n.length ? n.slice(0, 3).join(', ') + (n.length > 3 ? '…' : '') : 'nenhum'
  }
  // b) prazo
  const mesDepois = med && med.data ? MESES[(Number(med.data.slice(5, 7)) % 12)] : ''
  const avisoMed = med ? <div className="motivo" style={{ marginTop: 4 }}>Última medição em {dm(med.data)}. Sem medição depois disso, o relatório não
    mostra o atraso que pode ter acontecido depois{mesDepois ? ` (em ${mesDepois})` : ''}.</div> : null
  const situPrazo = prz.semanas == null ? '' : `${prz.semanas >= 0 ? 'adiantada' : 'atrasada'} ${semanasTxt(prz.semanas)}`
  const b = !med ? { cor: 'cinza', grande: 'sem medição', frase: 'Ainda não há medição de serviço até a data final.' }
    : !m.medNoPeriodo ? { cor: 'amarelo', grande: 'medição desatualizada',
        frase: <>Sem medição desde {dmy(med.data)} — atualizar. Na última medição: {pc1(prz.real)} feito × {pc1(prz.plan)} previsto
          {situPrazo ? `; ${situPrazo}` : ''}.{avisoMed}</> }
    : { cor: corPrazo(prz.semanas), grande: situPrazo || 'sem cálculo',
        frase: <>Avanço físico (horas de trabalho): <b>{pc1(prz.real)}</b> feito × {pc1(prz.plan)} previsto na medição de {dmy(med.data)}.
          {prz.termino ? <> Término projetado <b>{dmy(prz.termino)}</b> (cronograma: {dmy(prz.fimCronograma)}), se o ritmo for mantido.</> : ''}{avisoMed}</> }
  // d) custo final
  const pouco = prz.real != null && prz.real < 15
  return (
    <section className="folha">
      <h3>Resumo do período</h3>
      <div className="perguntas">
        <Pergunta q="Estamos gastando menos do que deveríamos? (custo direto)" cor={a.cor} grande={a.grande} frase={a.frase}>
          <div className="frase" style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${LINHA}` }}>
            <Sinal cor={ci} /> <b>Custo indireto</b> (administração, projetos, taxas, terreno): {ind.plan > 0
              ? <>previsto {mil(ind.plan)} × custo {custoTxt(ind.pago, ind.a_pagar, mil)} até {fim}. Diferença {mil(ind.saldo)} =
                {' '}<b>{mil(ind.a_pagar_previsto)} ainda a pagar</b> ({nomes(ind.naoPago)})
                {' '}+ <b>{mil(ind.sem_lancamento)} sem lançamento</b> ({nomes(ind.semLanc)})
                {' '}+ <b>{mil(ind.economia_real)} de {ind.economia_real >= -0.005 ? 'economia' : 'estouro'} real</b>.
                {ind.pendencias > 0 && <> Há custos fixos sem nenhum lançamento: pendência a lançar.</>}</>
              : 'sem previsão até a data final.'}
          </div>
        </Pergunta>
        <Pergunta q="A obra está no prazo?" cor={b.cor} grande={b.grande} frase={b.frase} />
        <Pergunta q="Quanto vamos precisar no próximo mês?" cor="azul" grande={mil(cx.total)}
          frase={<>Dinheiro previsto de {dmy(cx.de)} a {dmy(cx.ate)} (30 dias depois do fim da semana da data final), na mesma conta do painel
            “Pontos de atenção”. As atividades contam pela data projetada (as datas andam junto com a obra adiantada ou atrasada no cronograma).</>}>
          <table className="mini"><tbody>
            <tr><td>Serviços e materiais das atividades</td><td className="n">{mil(cx.servicos)}</td></tr>
            <tr><td>Contas já lançadas a pagar que vencem no período ({cx.titulos.length})</td><td className="n">{mil(cx.contas)}</td></tr>
            <tr><td>Custos fixos diretos (locação, funcionários, limpeza e EPI)</td><td className="n">{mil(cx.recorrentes)}</td></tr>
            <tr><td>Custo indireto do período</td><td className="n">{mil(cx.indiretos)}</td></tr>
          </tbody></table>
        </Pergunta>
        <Pergunta q="Quanto a obra vai custar no final?" cor={dir.feito > 0.005 ? corSaldoPct(f.pct) : 'cinza'} grande={mil(f.total)}
          frase={<>
            Se o que falta custar o que está orçado, a obra termina em <b>{mil(f.total)}</b>: <b>{f.saldo >= 0 ? 'economia' : 'estouro'} de
            {' '}{mil(f.saldo)} ({pc1(Math.abs(f.pct))})</b> sobre o orçamento de {mil(f.orcTotal)}.
            <div className="motivo" style={{ marginTop: 4 }}>Conta: custo direto até {fim} {mil(dir.custo)} (inclui {mil(dir.a_pagar)} já lançados a pagar)
              {' '}+ o que falta do direto pelo orçado {mil(f.falta)} + indireto pelo orçamento {mil(f.orcIndireto)}
              {Math.abs(f.semanasAtraso) > 0.05
                ? <> {f.ajustePrazo >= 0 ? '+' : '−'} custos fixos de {semanasTxt(f.semanasAtraso)} {f.semanasAtraso > 0 ? 'a mais (obra atrasada no cronograma)' : 'a menos (obra adiantada no cronograma)'}
                  {' '}× {mil(f.porSemana)} por semana = {mil(Math.abs(f.ajustePrazo))}</> : ' (obra no prazo: sem ajuste de custos fixos)'}.
              {' '}Não há reserva separada neste orçamento.</div>
            {pouco && <div className="motivo" style={{ color: COR.amarelo }}>Projeção pouco confiável com menos de 15% de avanço físico (hoje {pc1(prz.real)}).</div>}
          </>} />
      </div>
      <Nota>Semáforo: rendimento do custo verde a partir de R$ 1,00 de serviço por R$ 1,00 gasto, amarelo de R$ 0,95 a R$ 1,00, vermelho
        abaixo de R$ 0,95. Prazo: verde em dia ou adiantada, amarelo até 2 semanas de atraso, vermelho acima disso. Indireto e custo final:
        verde sem estouro, amarelo estouro até 5%, vermelho acima de 5%. Valores do resumo arredondados; nas tabelas, com centavos.</Nota>
    </section>
  )
}

/* 3. PREVISTO × FEITO NO PERÍODO (FÍSICO) */
function Fisico({ d, m }) {
  const { per, med, pFim } = d
  const f = m.fis
  const pt = (pn, s) => pn && pn.curva.find((c) => c.semana === s)
  const fimP = pt(pFim, per.sFim)
  const iniP = per.sAntes >= 1 ? pt(pFim, per.sAntes) : null
  const prevObra = (fimP ? fimP.avanco_plan_hh : 0) - (iniP ? iniP.avanco_plan_hh : 0)
  const feitoObra = (fimP ? fimP.avanco_real_hh : 0) - (iniP ? iniP.avanco_real_hh : 0)
  const preoc = f.atrasadas.slice(0, 3)
  return (
    <section className="folha quebra">
      <h3>O que estava previsto no período e o que foi feito</h3>
      <p className="conclusao" style={{ marginTop: 0 }}>
        Entre {dmy(per.iniReal)} e {dmy(per.fimReal)} o cronograma previa a obra avançar <b>{virg(prevObra, 1)} pontos</b> do total de horas de trabalho;
        {' '}{m.medNoPeriodo ? <>ela avançou <b>{virg(feitoObra, 1)} pontos</b> ({feitoObra >= prevObra ? 'à frente do previsto' : 'abaixo do previsto'}).</>
          : <>não houve medição no período (última em {med ? dmy(med.data) : '—'}).</>}
      </p>
      {!m.medNoPeriodo && <Nota><b>Sem medição no período.</b> {med ? `O feito é o da última medição (${dmy(med.data)}); medir para atualizar.` : 'Nenhuma medição ainda.'}</Nota>}
      {f.linhas.length === 0 ? <p>Nenhuma atividade prevista ou medida neste período.</p> : (
        <table className="tab">
          <thead><tr><th>Atividade</th><th className="n">Previsto no período</th><th className="n">Feito no período</th>
            <th className="n">Acumulado (feito / previsto)</th><th>Situação</th></tr></thead>
          {f.grupos.map((g) => (
            <tbody key={g.grupo}>
              <tr className="grupo"><td colSpan={5}>{g.grupo} {g.nome}</td></tr>
              {g.itens.map((l) => (
                <tr key={l.chave}>
                  <td>{l.cod_eap} · {descCurta(l.descricao)}{l.pavimento ? ` · ${l.pavimento}` : ''}</td>
                  <td className="n">{pc1(l.prev_periodo)}</td>
                  <td className="n">{pc1(l.feito_periodo)}</td>
                  <td className="n">{pc1(l.perc_realizado)} / {pc1(l.perc_planejado)}</td>
                  <td><Sinal cor={l.situacao.cor} semPalavra /> {l.situacao.texto}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}
      {f.linhas.length > 0 && (
        <p className="conclusao">
          <b>{f.emDia} de {f.linhas.length}</b> atividades estão em dia (concluídas, em dia ou adiantadas).{' '}
          {preoc.length ? <>As maiores preocupações: {preoc.map((l, i) => <span key={l.chave}>{i ? (i === preoc.length - 1 ? ' e ' : ', ') : ''}<b>{descCurta(l.descricao)} ({l.pavimento})</b>, {l.situacao.texto}</span>)}.</>
            : 'Nenhuma atividade do período está atrasada.'}
        </p>
      )}
      <Nota>Previsto e feito em % da atividade inteira. Situação pela mesma regra do painel “Pontos de atenção” do site (atrasada = feito abaixo do
        previsto); os dias = diferença entre previsto e feito vezes os dias da atividade no cronograma. Amarelo até 7 dias de atraso; vermelho acima.</Nota>
    </section>
  )
}

/* 4. QUANTO CUSTOU O QUE FOI FEITO */
function Financeiro({ d, m }) {
  const { per, contas } = d
  const { dir, fin, ind } = m
  const fim = dmy(per.fimReal)
  const cor = (feito, custo) => (custo > 0.005 ? corRendimento(feito / custo) : feito > 0.005 ? 'verde' : 'cinza')
  const dif = (saldo) => (Math.abs(saldo) < 0.005 ? <span style={{ color: SUAVE }}>sem diferença</span>
    : <span style={{ color: saldo > 0 ? COR.verde : COR.vermelho }}>{saldo > 0 ? 'economia' : 'estouro'} {fmt2(Math.abs(saldo))}</span>)
  const Custo = ({ pago, ap }) => <>{fmt2((pago || 0) + (ap || 0))}<div className="motivo">pago {fmt2(pago || 0)} + a pagar {fmt2(ap || 0)}</div></>
  const gs = fin.grupos.filter((g) => g.tem)
  const titulos = (contas && contas.titulos) || []
  const classe = (x) => {
    const c = new Set((x.eaps || []).map((e) => e.classe))
    return c.has('direto') ? 'direto' : c.has('indireto') ? 'indireto' : [...c][0] || '—'
  }
  const linhaDif = (l) => (
    <tr key={`${l.cod_eap}|${l.pavimento}`}>
      <td>{l.cod_eap} · {descCurta(l.descricao)}{l.pavimento ? ` · ${l.pavimento}` : ''}</td>
      <td className="n">{fmt2(l.agregado)}</td>
      <td className="n"><Custo pago={l.pago} ap={l.a_pagar} /></td>
      <td className="n">{dif(l.saldo)}</td>
    </tr>
  )
  return (
    <section className="folha quebra">
      <h3>Quanto custou o que foi feito</h3>
      <p className="intro"><b>Valor do que foi feito</b> = serviço executado a preço de orçamento (quanto deveria ter custado).
        {' '}<b>Custo</b> = pago + lançado a pagar; é sempre a soma que entra na comparação.</p>
      <p className="conclusao" style={{ marginTop: 0 }}>Até {fim}: o serviço feito vale {fmt2(dir.feito)} e custou {custoTxt(dir.pago, dir.a_pagar)} —
        {' '}<b>{fmt2(Math.abs(dir.saldo))} a {dir.saldo >= 0 ? 'menos' : 'mais'}</b>. No período: feito {fmt2(dir.periodo.feito)}, custo {fmt2(dir.periodo.custo)}.</p>
      <table className="tab">
        <thead><tr><th>Grupo</th><th className="n">Orçado</th><th className="n">Feito no período</th><th className="n">Custo no período</th>
          <th className="n">Feito acumulado</th><th className="n">Custo acumulado</th><th className="n">Economia / estouro acumulado</th><th /></tr></thead>
        <tbody>
          {gs.map((g) => (
            <tr key={g.grupo}>
              <td>{g.grupo} {g.nome}</td><td className="n">{fmt2(g.orcado)}</td>
              <td className="n">{fmt2(g.feito_p)}</td><td className="n">{fmt2(g.custo_p)}</td>
              <td className="n">{fmt2(g.feito)}</td><td className="n"><Custo pago={g.pago} ap={g.a_pagar} /></td>
              <td className="n">{dif(g.saldo)}</td><td><Sinal cor={cor(g.feito, g.custo)} /></td>
            </tr>
          ))}
          <tr className="total">
            <td>Total do custo direto</td><td className="n">{fmt2(fin.grupos.reduce((t, g) => t + g.orcado, 0))}</td>
            <td className="n">{fmt2(dir.periodo.feito)}</td><td className="n">{fmt2(dir.periodo.custo)}</td>
            <td className="n">{fmt2(dir.feito)}</td><td className="n"><Custo pago={dir.pago} ap={dir.a_pagar} /></td>
            <td className="n">{dif(dir.saldo)}</td><td><Sinal cor={cor(dir.feito, dir.custo)} /></td>
          </tr>
        </tbody>
      </table>
      <Nota>Locação e funcionários (grupos 17 e 18) contam o custo até a verba como valor do feito; acima da verba é estouro. Material comprado
        antes da execução fica neutro até ser aplicado. A soma dos grupos pode diferir do total por custo lançado fora das linhas do orçamento.</Nota>

      <h4>Custo indireto até {fim}</h4>
      <p>Previsto {fmt2(ind.plan)} × custo {custoTxt(ind.pago, ind.a_pagar)}: diferença {fmt2(ind.saldo)} = {fmt2(ind.a_pagar_previsto)} ainda a pagar
        {' '}+ {fmt2(ind.sem_lancamento)} sem lançamento + <b>{fmt2(ind.economia_real)} de {ind.economia_real >= -0.005 ? 'economia' : 'estouro'} real</b>.</p>

      <h4>Contas a pagar lançadas{contas && contas.fechamento ? ` (carga de ${contas.fechamento})` : ''}</h4>
      {titulos.length ? (
        <table className="tab peq">
          <thead><tr><th>Fornecedor</th><th>Documento</th><th>Vencimento</th><th className="n">Valor</th><th>Tipo</th></tr></thead>
          <tbody>
            {titulos.map((x) => (
              <tr key={x.chave}>
                <td>{x.fornecedor || '—'}{x.natureza === 'previsto_sem_nf' ? <div className="motivo">previsto, ainda sem nota</div> : null}</td>
                <td>{x.num_documento || '—'}</td><td>{dmy(x.data_vencimento)}</td><td className="n">{fmt2(x.valor)}</td><td>{classe(x)}</td>
              </tr>
            ))}
            <tr className="total"><td colSpan={3}>Total ({contas.n_titulos} títulos) · no custo direto: {fmt2(contas.totais.ipc_direto)}</td>
              <td className="n">{fmt2(contas.totais.total)}</td><td /></tr>
          </tbody>
        </table>
      ) : <p>Nenhuma conta a pagar lançada até {fim}.</p>}

      <div className="duas">
        <div>
          <h4>Maiores economias (acumulado)</h4>
          {fin.economias.length ? <table className="tab peq"><thead><tr><th>Atividade</th><th className="n">Feito</th><th className="n">Custo</th><th className="n">Diferença</th></tr></thead>
            <tbody>{fin.economias.map(linhaDif)}</tbody></table> : <p>Nenhuma.</p>}
        </div>
        <div>
          <h4>Maiores estouros (acumulado)</h4>
          {fin.estouros.length ? <table className="tab peq"><thead><tr><th>Atividade</th><th className="n">Feito</th><th className="n">Custo</th><th className="n">Diferença</th></tr></thead>
            <tbody>{fin.estouros.map(linhaDif)}</tbody></table> : <p>Nenhum.</p>}
        </div>
      </div>
      <Nota>Semáforo do grupo pelo rendimento do custo (feito ÷ custo), nas mesmas faixas do resumo. Custo no período = pago no período + a pagar
        no fim − a pagar no início (cada semana usa a carga de contas a pagar do próprio mês).</Nota>
    </section>
  )
}

/* 5. GRÁFICOS (SVG, imprime nítido) */
function Grafico({ titulo, series, xMax, yMax, yFmt, marca, marcaTxt, legenda }) {
  const W = 680
  const H = 250
  const L = 64
  const R = 14
  const T = 14
  const B = 34
  const x = (s) => L + ((s - 1) / Math.max(xMax - 1, 1)) * (W - L - R)
  const y = (v) => T + (1 - v / yMax) * (H - T - B)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)
  const passoX = xMax > 60 ? 12 : xMax > 24 ? 4 : 2
  return (
    <div className="grafico">
      <h4>{titulo}</h4>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={LINHA} />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill={SUAVE}>{yFmt(t)}</text></g>)}
        {Array.from({ length: xMax }, (_, i) => i + 1).filter((s) => s === 1 || s % passoX === 0).map((s) => (
          <text key={s} x={x(s)} y={H - B + 14} textAnchor="middle" fontSize="10" fill={SUAVE}>{S2(s)}</text>))}
        {marca && <g><line x1={x(marca)} x2={x(marca)} y1={T} y2={H - B} stroke={TXT} strokeDasharray="3,3" />
          <text x={x(marca) + 4} y={T + 10} fontSize="10" fill={TXT}>{marcaTxt}</text></g>}
        {series.map((s) => {
          const pts = s.pontos.filter((p) => p.v != null && isFinite(p.v) && p.s <= xMax)
          if (!pts.length) return null
          return <polyline key={s.nome} fill="none" stroke={s.cor} strokeWidth={s.largura || 2} strokeDasharray={s.tracejado || undefined} strokeLinecap="round"
            points={pts.map((p) => `${x(p.s).toFixed(1)},${y(Math.min(p.v, yMax)).toFixed(1)}`).join(' ')} />
        })}
      </svg>
      <div className="legenda">{series.map((s) => (
        <span key={s.nome}><svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" stroke={s.cor} strokeWidth="2.5" strokeDasharray={s.tracejado || undefined} /></svg> {s.nome}</span>))}</div>
      {legenda && <Nota>{legenda}</Nota>}
    </div>
  )
}
const teto = (v) => {
  if (!(v > 0)) return 1
  const bruto = (v * 1.05) / 4
  const p = Math.pow(10, Math.floor(Math.log10(bruto)))
  return 4 * ([1, 1.5, 2, 2.5, 3, 4, 5, 10].map((k) => k * p).find((k) => k >= bruto) || 10 * p)
}
function Graficos({ d }) {
  const { per, pFim, med } = d
  const cv = pFim.curva
  const xMax = Math.min(cv.length, Math.max(per.sFim + 8, 16))
  const fisPlan = cv.map((c) => ({ s: c.semana, v: c.avanco_plan_hh }))
  const fisReal = cv.filter((c) => med && c.semana <= med.semana).map((c) => ({ s: c.semana, v: c.avanco_real_hh }))
  const yFis = teto(Math.max(...fisPlan.filter((p) => p.s <= xMax).map((p) => p.v || 0), ...fisReal.map((p) => p.v || 0)))
  const ate = cv.filter((c) => c.semana <= per.sFim)
  const finPlan = ate.map((c) => ({ s: c.semana, v: c.bcws }))
  const feito = ate.map((c) => ({ s: c.semana, v: c.bcwp_a_custo == null ? null : c.bcwp_a_custo + (c.bcwp_b || 0) + (c.bcwp_c || 0) }))
  const pago = ate.map((c) => ({ s: c.semana, v: c.acwp }))
  const yFin = teto(Math.max(...finPlan.map((p) => p.v || 0), ...feito.map((p) => p.v || 0), ...pago.map((p) => p.v || 0)))
  const fmtK = (v) => (v >= 1e6 ? `${virg(v / 1e6, 1)} mi` : `${Math.round(v / 1e3)} mil`)
  const ap = pFim.contas_a_pagar && pFim.contas_a_pagar.direto
  return (
    <section className="folha quebra">
      <h3>Gráficos</h3>
      <Grafico titulo="Avanço da obra — previsto × feito (% das horas de trabalho da obra)" xMax={xMax} yMax={yFis}
        yFmt={(v) => `${virg(v, 1)}%`} marca={per.sFim} marcaTxt={`fim do período ${dm(per.fimReal)}`}
        series={[{ nome: 'Previsto no cronograma (tracejada)', cor: COR.azul, tracejado: '6,4', pontos: fisPlan },
          { nome: 'Feito nas medições (contínua)', cor: TXT, largura: 2.5, pontos: fisReal }]}
        legenda={`Semanas da obra (S01 = ${dmy(per.inicioObra)}); mostra até ${S2(xMax)}. A obra toda tem ${cv.length} semanas.`} />
      <Grafico titulo="Dinheiro do custo direto — previsto × valor do que foi feito × pago (acumulado)" xMax={per.sFim} yMax={yFin}
        yFmt={(v) => (v ? `R$ ${fmtK(v)}` : '0')} marca={null}
        series={[{ nome: 'Previsto no cronograma (tracejada)', cor: COR.cinza, tracejado: '6,4', pontos: finPlan },
          { nome: 'Valor do que foi feito (contínua)', cor: COR.verde, largura: 2.5, pontos: feito },
          { nome: 'Pago (pontilhada)', cor: COR.vermelho, largura: 2.5, tracejado: '1.5,3', pontos: pago }]}
        legenda={`Quando a linha do valor do que foi feito fica acima da linha do pago, a obra está custando menos do que vale o que foi feito. Além do pago, há ${fmt2(ap)} lançados a pagar em ${dmy(per.fimReal)}.`} />
    </section>
  )
}

/* 6. PRÓXIMOS 30 DIAS (datas pela janela PROJETADA: o cronograma anda com o adiantamento ou o atraso) */
function Proximos({ d, m }) {
  const { pa } = d
  const cx = m.cx
  const quando = (a) => (a.proj ? a.proj.inicio : a.inicio_crono) || ''
  const ativs = pa.atividades.filter((a) => a.em_30)
    .sort((a, b) => (b.atrasada - a.atrasada) || quando(a).localeCompare(quando(b)))
  const top = ativs.slice(0, 14)
  const compras = (pa.compras || []).filter((c) => c.pedir_ate).sort((a, b) => a.pedir_ate.localeCompare(b.pedir_ate)).slice(0, 6)
  const fonte = (a) => (a.proj ? (a.proj.fonte === 'frente' ? 'pelo ritmo do pavimento' : 'pela obra adiantada no cronograma') : 'cronograma')
  return (
    <section className="folha quebra">
      <h3>Próximos 30 dias ({dmy(cx.de)} a {dmy(cx.ate)})</h3>
      <p className="intro">{ativs.length} atividades previstas, em andamento ou atrasadas; as {top.length} primeiras (atrasadas primeiro, depois pela data de
        início). As datas acompanham a obra adiantada ou atrasada no cronograma (data projetada), não ficam presas ao cronograma original.</p>
      <table className="tab">
        <thead><tr><th>Atividade</th><th>Quando</th><th className="n">Falta</th><th>Equipes</th><th>Término com as equipes</th><th className="n">Dinheiro</th></tr></thead>
        <tbody>
          {top.map((a) => {
            const t = a.termino || {}
            const sit = situacao(a) || { cor: 'cinza', texto: '—' }
            const ini = a.proj ? a.proj.inicio : a.inicio_crono
            const fimJ = a.proj ? a.proj.fim : a.fim_crono
            const eq = t.usadas || t.sugeridas
            return (
              <tr key={a.chave}>
                <td><Sinal cor={sit.cor} palavra={sit.texto} /><div>{a.cod_eap} {descCurta(a.descricao)} · {a.pavimento}</div>
                  {a.atrasada && <div className="motivo">previsto {pc1(a.plan_hoje)}, feito {pc1(a.real)}</div>}</td>
                <td>{dm(ini)} → {dm(fimJ)}<div className="motivo">{fonte(a)}{a.proj ? ` (cronograma ${dm(a.inicio_crono)} → ${dm(a.fim_crono)})` : ''}</div></td>
                <td className="n">{pc1(100 - (a.real || 0))}</td>
                <td>{eq ? `${Math.ceil(eq)} equipe${Math.ceil(eq) > 1 ? 's' : ''}` : 'a definir'}{a.equipe && a.equipe.composicao ? <div className="motivo">{a.equipe.composicao}</div> : null}</td>
                <td>{t.termino ? dmy(t.termino) : '—'}<div className="motivo">{t.termino ? (t.cumpre ? 'dentro do prazo' : `${t.atrasa} dia(s) depois do fim previsto`) : 'sem índice ou equipe'}</div></td>
                <td className="n">{fmt2(a.caixa_mes ? a.caixa_mes.total : 0)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="duas">
        <div>
          <h4>Dinheiro necessário: {fmt2(cx.total)}</h4>
          <table className="tab peq"><tbody>
            {cx.grupos.map((g) => <tr key={g.grupo}><td>{g.grupo} {g.nome}</td><td className="n">{fmt2(g.total)}</td></tr>)}
            <tr><td>Contas já lançadas a pagar ({cx.titulos.length})</td><td className="n">{fmt2(cx.contas)}</td></tr>
            <tr><td>Custos fixos diretos (locação, funcionários, limpeza e EPI)</td><td className="n">{fmt2(cx.recorrentes)}</td></tr>
            <tr><td>Custo indireto do período</td><td className="n">{fmt2(cx.indiretos)}</td></tr>
            <tr className="total"><td>Total</td><td className="n">{fmt2(cx.total)}</td></tr>
          </tbody></table>
          {cx.titulos.length > 0 && (
            <table className="tab peq"><thead><tr><th>Conta a pagar</th><th>Vence</th><th className="n">Valor</th></tr></thead><tbody>
              {cx.titulos.map((x) => <tr key={x.chave}><td>{x.fornecedor}<div className="motivo">{x.documento}</div></td><td>{dmy(x.vencimento)}</td><td className="n">{fmt2(x.valor)}</td></tr>)}
            </tbody></table>
          )}
          <Nota>Pelo cronograma original seriam {fmt2(cx.curva)}. Serviço pelo valor a executar no período; prazos de pagamento de fornecedores ainda não considerados.</Nota>
        </div>
        <div>
          <h4>Compras com prazo</h4>
          {compras.length ? <table className="tab peq"><thead><tr><th>Item</th><th>Pedir até</th></tr></thead><tbody>
            {compras.map((c) => <tr key={c.cod_eap}><td>{c.categoria} · {descCurta(c.descricao)}<div className="motivo">usar em {dmy(c.necessidade)}</div></td>
              <td style={{ color: c.status === 'vencido' ? COR.vermelho : TXT }}>{dmy(c.pedir_ate)}<div className="motivo">{c.status}</div></td></tr>)}
          </tbody></table> : <p>Nenhuma compra de prazo longo cadastrada.</p>}
        </div>
      </div>
    </section>
  )
}

/* 7. PONTOS DE ATENÇÃO (produtividade baixa, custo que pode estourar, pendências) */
function Atencao({ d, m }) {
  const { per, pa, med } = d
  const itens = []
  const atr = pa.atividades.filter((a) => a.atrasada)
  if (atr.length) itens.push({ cor: 'vermelho', txt: <>{atr.length} atividade{atr.length > 1 ? 's' : ''} atrasada{atr.length > 1 ? 's' : ''} em {dmy(per.fimReal)}: {atr.slice(0, 5).map((a) => `${descCurta(a.descricao)} (${a.pavimento}, ${(situacao(a) || {}).texto})`).join('; ')}.</> })
  m.lenta.slice(0, 5).forEach((a) => {
    const t = a.termino || {}
    if (t.termino && t.cumpre === false)
      itens.push({ cor: 'amarelo', txt: <>Produtividade abaixo do necessário: {descCurta(a.descricao)} ({a.pavimento}) — no ritmo atual{t.usadas ? ` com ${Math.ceil(t.usadas)} equipe(s)` : ''} termina em {dmy(t.termino)}, {t.atrasa} dia(s) depois do previsto. Reforçar a equipe ou rever o prazo.</> })
    else if (a.cronograma_curto)
      itens.push({ cor: 'amarelo', txt: <>Cronograma curto: {descCurta(a.descricao)} ({a.pavimento}) tem {Math.round(a.cronograma_curto.horas_cronograma)} h no cronograma, mas pela produtividade real precisa de {Math.round(a.cronograma_curto.horas_indice)} h (+{pc1(a.cronograma_curto.excesso_pct)}).</> })
  })
  const concl = m.risco.filter((l) => l.exec >= 99.95)
  const andam = m.risco.filter((l) => l.exec < 99.95)
  andam.slice(0, 5).forEach((l) => itens.push({ cor: l.saldo < -0.5 ? 'vermelho' : 'amarelo', txt: <>Custo pode estourar: {l.cod_eap} {descCurta(l.descricao)}{l.pavimento ? ` (${l.pavimento})` : ''} — já custou {fmt2(l.custo)} ({pc1(l.usado)} do orçado) com só {pc1(l.exec)} executado{l.saldo < -0.5 ? `; ${fmt2(Math.abs(l.saldo))} acima do valor do que foi feito` : ''}.</> }))
  if (concl.length) itens.push({ cor: 'vermelho', txt: <>Já estouraram (concluídas acima do orçado): {concl.slice(0, 5).map((l) => `${l.cod_eap} ${descCurta(l.descricao)} (${fmt2(Math.abs(l.saldo))} acima, ${pc1(l.usado)} do orçado)`).join('; ')}.</> })
  if (!med) itens.push({ cor: 'cinza', txt: 'Nenhuma medição de serviço até a data final.' })
  else if (!m.medNoPeriodo) itens.push({ cor: 'amarelo', txt: <>Medição desatualizada: última em {dmy(med.data)}, antes do período. Medir para atualizar avanço, prazo e custo final.</> })
  if (m.ind.semLanc.length) itens.push({ cor: 'amarelo', txt: <>Custos fixos indiretos previstos e sem nenhum lançamento: {m.ind.semLanc.map((c) => c.categoria).join(', ')} ({fmt2(m.ind.sem_lancamento)} previstos até {dmy(per.fimReal)}).</> })
  const vencidas = (pa.compras || []).filter((c) => c.status === 'vencido')
  if (vencidas.length) itens.push({ cor: 'vermelho', txt: <>Compras com prazo de pedido vencido: {vencidas.slice(0, 4).map((c) => `${c.categoria} (pedir até ${dmy(c.pedir_ate)})`).join('; ')}.</> })
  if (pa.pendencias && pa.pendencias.length) itens.push({ cor: 'cinza', txt: <>{pa.pendencias.length} dado(s) pendente(s) de cadastro (índice, equipe ou duração): equipes e término dessas atividades ficam “a definir”.</> })
  return (
    <section className="folha quebra">
      <h3>Pontos de atenção</h3>
      {itens.length ? <ul className="pontos">{itens.map((i, n) => <li key={n}><Sinal cor={i.cor} /> <span>{i.txt}</span></li>)}</ul> : <p>Nenhum ponto de atenção.</p>}
      <Nota>Produtividade abaixo do necessário: pelo ritmo real (ou pelas equipes cadastradas) a atividade termina depois do fim previsto. Custo pode
        estourar: o custo (pago + a pagar) já passou do valor do que foi feito, ou consumiu do orçado da linha mais de 10 pontos acima do que foi executado.</Nota>
      <Glossario d={d} m={m} />
    </section>
  )
}

/* 8. GLOSSÁRIO */
function Glossario({ d, m }) {
  const fim = dmy(d.per.fimReal)
  return (
    <div className="glossario">
      <h3 style={{ marginTop: 22 }}>Glossário</h3>
      <dl>
        <dt>Valor do que foi feito</dt>
        <dd>Quanto vale, a preço de orçamento, o serviço já executado — quanto ele deveria ter custado. Até {fim}: {fmt2(m.dir.feito)}.</dd>
        <dt>Custo (pago + a pagar)</dt>
        <dd>O que já foi pago mais o que está lançado a pagar; é o custo usado em todas as comparações. Até {fim}: {custoTxt(m.dir.pago, m.dir.a_pagar)}.</dd>
        <dt>Economia / estouro</dt>
        <dd>Valor do que foi feito menos o custo. Positivo é economia; negativo, estouro. Até {fim}: {fmt2(m.dir.saldo)}.</dd>
        <dt>Rendimento do custo</dt>
        <dd>Quanto de serviço a obra entregou para cada R$ 1,00 gasto. Até {fim}: R$ {virg(m.dir.rendimento)}.</dd>
        <dt>Avanço físico</dt>
        <dd>Horas de trabalho já executadas ÷ horas de trabalho da obra inteira. Na última medição: {pc1(m.prz.real)}.</dd>
        <dt>Data projetada</dt>
        <dd>Início e fim da atividade deslocados pelo quanto o pavimento (ou a obra) está adiantado ou atrasado no cronograma, em vez da data fixa do cronograma.</dd>
        <dt>Obra adiantada no cronograma</dt>
        <dd>Quantas semanas a obra está à frente do cronograma (prazo, não pagamento antecipado a fornecedor). No custo final, desconta os custos fixos dessas semanas.</dd>
        <dt>Custo final</dt>
        <dd>Custo de hoje + o que falta pelo orçado + custos fixos (locação, funcionários, administração) da diferença de prazo: {fmt2(m.final.total)}.</dd>
        <dt>Caixa</dt>
        <dd>Dinheiro que a obra deve precisar: serviços e materiais previstos, contas a pagar que vencem, custos fixos e indireto. Próximos 30 dias: {fmt2(m.cx.total)}.</dd>
      </dl>
    </div>
  )
}

/* ─── CSS (tela e impressão A4) ─────────────────────────────────────────────────── */
function css(cabecalho) {
  const c = cabecalho.replace(/"/g, '')
  return `
html, body { background: #e6e9ed !important; color: ${TXT} !important; }
:root { color-scheme: light !important; }
.barra { position: sticky; top: 0; z-index: 5; display: flex; gap: 14px; align-items: center; padding: 10px 24px; flex-wrap: wrap;
  background: #fff; border-bottom: 1px solid ${LINHA}; font: 500 13px 'IBM Plex Sans', sans-serif; }
.barra a { color: ${COR.azul}; }
.barra .dica { color: ${SUAVE}; font-size: 12px; }
.barra button { background: ${COR.azul}; color: #fff; border: 0; border-radius: 6px; padding: 8px 16px; font: 600 13px 'IBM Plex Sans', sans-serif; cursor: pointer; }
.barra button:disabled { opacity: .5; }
.folha { background: #fff; width: 210mm; min-height: 297mm; margin: 18px auto; padding: 16mm 14mm; box-shadow: 0 2px 10px rgba(0,0,0,.12);
  font: 10.5pt/1.45 'IBM Plex Sans', sans-serif; color: ${TXT}; box-sizing: border-box; }
.folha h3 { font: 600 16pt 'IBM Plex Sans', sans-serif; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 2px solid ${TXT}; color: ${TXT}; }
.folha h4 { font: 600 11.5pt 'IBM Plex Sans', sans-serif; margin: 14px 0 6px; break-after: avoid; color: ${TXT}; }
.folha p { margin: 0 0 8px; }
.intro { color: ${SUAVE}; }
.nota { font-size: 8.5pt; color: ${SUAVE}; margin: 8px 0; line-height: 1.4; }
.sinal { display: inline-flex; align-items: center; gap: 3px; vertical-align: middle; flex-shrink: 0; }
.sinal svg { display: block; }
.palavra { font-size: 8pt; font-weight: 600; }
.pr .palavra { font-size: 9pt; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.capa { display: flex; flex-direction: column; justify-content: center; }
.capa-topo { font: 500 10pt 'IBM Plex Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: ${SUAVE}; }
.capa h1 { font: 700 34pt/1.1 'IBM Plex Sans', sans-serif; margin: 10px 0 14px; color: ${TXT}; }
.capa h2 { font: 500 18pt 'IBM Plex Sans', sans-serif; margin: 0 0 40px; color: ${TXT}; }
.capa-dados div { margin: 6px 0; font-size: 11pt; } .capa-dados b { display: inline-block; min-width: 72mm; color: ${SUAVE}; font-weight: 500; }
.capa-legenda { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 48px; font-size: 10pt; color: ${SUAVE}; }
.perguntas { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pergunta { border: 1px solid ${LINHA}; border-radius: 8px; padding: 12px 14px; break-inside: avoid; }
.pq { font: 600 10.5pt 'IBM Plex Sans', sans-serif; margin-bottom: 8px; }
.pr { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.grande { font: 700 17pt/1.15 'IBM Plex Sans', sans-serif; }
.frase { font-size: 9.5pt; line-height: 1.45; }
table.mini { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9pt; }
table.mini td { padding: 2px 0; border-bottom: 1px solid ${FUNDO}; color: ${TXT}; }
table.tab { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 6px 0; }
table.tab th { text-align: left; font: 600 8pt 'IBM Plex Sans', sans-serif; text-transform: uppercase; letter-spacing: .04em; color: ${SUAVE} !important;
  border-bottom: 1.5px solid ${TXT}; padding: 4px 5px; }
table.tab td { padding: 4px 5px; border-bottom: 1px solid ${LINHA}; vertical-align: top; color: ${TXT}; }
.folha tr:hover td { background: transparent; }
table.tab tr { break-inside: avoid; }
table.tab thead { display: table-header-group; }
table.tab tr.grupo td { background: ${FUNDO}; font-weight: 600; padding-top: 6px; }
table.tab tr.total td { font-weight: 700; border-top: 1.5px solid ${TXT}; background: ${FUNDO}; }
table.peq { font-size: 8.5pt; }
.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.motivo { font-size: 8pt; color: ${SUAVE}; }
.conclusao { margin-top: 10px; padding: 8px 10px; background: ${FUNDO}; border-radius: 6px; }
.duas { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.grafico { break-inside: avoid; margin-bottom: 12px; }
.legenda { display: flex; gap: 16px; flex-wrap: wrap; font-size: 9pt; color: ${TXT}; margin-top: 2px; }
ul.pontos { list-style: none; padding: 0; margin: 0; }
ul.pontos li { display: flex; gap: 8px; align-items: baseline; padding: 6px 0; border-bottom: 1px solid ${LINHA}; font-size: 10pt; }
.glossario { break-inside: avoid; }
.glossario dl { display: grid; grid-template-columns: 46mm 1fr; gap: 6px 12px; font-size: 10pt; }
.glossario dt { font-weight: 600; }
@media screen and (max-width: 820px) {
  .folha { width: auto; min-height: 0; margin: 12px 8px; padding: 16px; }
  .perguntas, .duas { grid-template-columns: 1fr; }
  .glossario dl { grid-template-columns: 1fr; }
  table.tab { display: block; overflow-x: auto; }
  .barra { padding: 10px 12px; }
  .capa h1 { font-size: 26pt; }
}
@page { size: A4 portrait; margin: 16mm 13mm 15mm 13mm;
  @top-left { content: "${c}"; font: 8pt 'IBM Plex Sans', sans-serif; color: #6b7480; }
  @bottom-left { content: "${c}"; font: 8pt 'IBM Plex Sans', sans-serif; color: #6b7480; }
  @bottom-right { content: "página " counter(page) " de " counter(pages); font: 8pt 'IBM Plex Sans', sans-serif; color: #6b7480; } }
@page :first { @top-left { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
@media print {
  html, body { background: #fff !important; }
  .nao-imprime { display: none !important; }
  .folha { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; break-after: page; }
  .folha:last-of-type { break-after: auto; }
  .capa { min-height: 250mm; }
  table.tab { display: table; }
}
`
}
