// Painel "Pontos de atenção" (cópia do Sirius 60, pedidos 14C e 14D). Na página semanal, logo abaixo do Diário de
// ocorrências, recolhido. Topo: 4 números (atrasadas, a executar na semana e em 30 dias, equipes sugeridas) + caixa da
// próxima semana e de 30 dias (clicar abre a composição, com a curva do cronograma em cinza). Abas: Atrasadas | Próxima
// semana | Próximos 30 dias, com as atividades dentro do GRUPO do orçamento (recolhido; na Estrutura, por pavimento se
// houver mais de um). Por atividade: índice (ou duração) e nº de equipes editáveis — término, datas e caixa recalculam
// na hora (as mesmas funções de lib/pontos-atencao.js) —, coluna DATAS e CAIXA (mão de obra | material). Compras só no
// botão discreto. Clique na atividade = memória de cálculo e histórico. Campo vazio em amarelo para preencher.
// Hooks sempre no topo (no Sirius um hook depois de "return" derrubou o site: erro #310). Gravação com a senha no
// cabeçalho e confirmação DENTRO da página (sem alert/confirm/prompt).
import React, { useEffect, useState } from 'react'
import { fmtMoeda } from '../lib/constants'
import { calcularTermino, planoPeriodo, horasDaLinha, aplicarCicloEstrutura, PREMISSA } from '../lib/pontos-atencao'
import { fetchComSenhaSemJanela, temSenha } from '../lib/fetch-com-senha'
import Desbloqueio from './Desbloqueio'

const VERMELHO = 'var(--red)'
const VERDE = 'var(--green)'
const AMBAR = 'var(--amber)'
const CINZA = 'var(--text3)'
const AMARELO_FUNDO = 'rgba(201,164,92,.18)'
const dm = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—')
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—')
const nf = (v, d = 1) => (v == null || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }))
const pc = (v) => (v == null ? '—' : `${nf(v, 1)}%`)
const rs = (v) => (v == null ? '—' : fmtMoeda(v))
const ixTxt = (v) => String(Number(Number(v).toFixed(4))).replace('.', ',')   // até 4 casas, sem zeros à direita
const pav = (p) => (!p ? '' : /^\d/.test(p) ? `${p} pav.` : p)
const ORIGEM = { cronograma: 'cronograma', rafael: 'Rafael', 'rafael-site': 'Rafael (site)', historico: 'histórico' }
// "histórico (2º e 3º pav): 14,9 m²/dia por equipe · 0,537 Hh/m²"
const txtHist = (H, ix, und) => `histórico (${H.pavimentos_validos.join(' e ')} pav): ${nf(H.ritmo_equipe, 1)} ${und}/dia por equipe${ix != null ? ` · ${ixTxt(ix)} Hh/${und}` : ''}`
const ABAS = [['atrasadas', 'Atrasadas'], ['semana', 'Próxima semana'], ['mes', 'Próximos 30 dias']]
const inp = (pend, w = 70) => ({ width: w, padding: '3px 6px', fontFamily: 'var(--mono)', fontSize: 12, background: pend ? AMARELO_FUNDO : undefined })
const btnMini = { fontSize: 10, padding: '1px 6px' }
const num = { textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, whiteSpace: 'nowrap' }
const diasUt = (n) => `${n} dia${n === 1 ? '' : 's'} út${n === 1 ? 'il' : 'eis'}`
const NCOL = 10

export default function PontosAtencao({ semana }) {
  // ---- hooks: todos aqui em cima, antes de qualquer return ----
  const [aberto, setAberto] = useState(false)
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)
  const [aba, setAba] = useState('atrasadas')
  const [verCompras, setVerCompras] = useState(false)
  const [verCaixa, setVerCaixa] = useState(null)               // 'semana' | 'mes' | null
  const [cxAbertos, setCxAbertos] = useState(() => new Set())  // blocos abertos na composição do caixa
  const [grupos, setGrupos] = useState(() => new Set())        // grupos/pavimentos abertos (aba|grupo|pav)
  const [linhaAberta, setLinhaAberta] = useState(null)
  const [edit, setEdit] = useState({})                         // { chave: { indice, duracao, equipes, oficiais, ajudantes, funcao } }
  const [editCompra, setEditCompra] = useState({})             // { cod_eap: dias }
  const [confirmar, setConfirmar] = useState(null)             // { corpo, texto }
  const [pedirSenha, setPedirSenha] = useState(false)
  const [quem, setQuem] = useState('')
  const [msg, setMsg] = useState(null)
  const [gravando, setGravando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!aberto || semana == null) return
    let vivo = true
    setErro(null)
    fetch(`/api/pontos-atencao?semana=${semana}`).then((r) => r.json())
      .then((j) => { if (vivo) (j.error ? setErro(j.message || j.error) : setD(j)) })
      .catch((e) => vivo && setErro(e.message))
    return () => { vivo = false }
  }, [aberto, semana, recarga])

  const ed = (k) => edit[k] || {}
  const setCampo = (k, campo, v) => setEdit((e) => ({ ...e, [k]: { ...(e[k] || {}), [campo]: v } }))
  const limpar = (k, campos) => setEdit((e) => { const x = { ...(e[k] || {}) }; campos.forEach((c) => delete x[c]); return { ...e, [k]: x } })
  const alternar = (k) => setGrupos((g) => { const n = new Set(g); n.has(k) ? n.delete(k) : n.add(k); return n })

  async function gravar() {
    const c = confirmar
    if (!c) return
    if (!temSenha()) { setPedirSenha(true); return }
    setGravando(true)
    try {
      const r = await fetchComSenhaSemJanela('/api/pontos-atencao', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c.corpo, quem }) })
      if (r.status === 401) { setPedirSenha(true); return }
      const j = await r.json()
      if (!r.ok) { setMsg({ tipo: 'err', txt: j.error || 'Falha ao gravar' }); setConfirmar(null); return }
      setMsg({ tipo: 'ok', txt: 'Gravado.' })
      setConfirmar(null)
      if (c.corpo.campo === 'antecedencia') setEditCompra((x) => { const n = { ...x }; delete n[c.corpo.cod_eap]; return n })
      else limpar(c.chave, c.corpo.campo === 'equipe' ? ['oficiais', 'ajudantes', 'funcao'] : [c.corpo.campo])
      setRecarga((x) => x + 1)
    } catch (e) {
      setMsg({ tipo: 'err', txt: e.message })
    } finally { setGravando(false) }
  }

  if (!aberto || !d || erro) {
    return (
      <div className="card">
        <div className="card-title" onClick={() => setAberto(!aberto)}
             style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}>
          <span>⚠️ Pontos de atenção</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="kpi-sub">{aberto ? (erro ? '' : 'carregando…') : semana ? `a partir da S${String(semana).padStart(2, '0')}` : ''}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{aberto ? '▲' : '▼'}</span>
          </span>
        </div>
        {aberto && erro && <div className="kpi-sub">Não foi possível carregar: {erro}</div>}
        {aberto && !erro && <div className="loading">Analisando…</div>}
      </div>
    )
  }

  const J = d.jornada
  // valores efetivos (edição na tela > salvo > sugerido): término e caixa recalculados com as funções do servidor
  const efetivo = (a) => {
    const e = ed(a.chave)
    const mudouIx = e.indice !== undefined && e.indice !== ''
    const mudouDur = e.duracao !== undefined && e.duracao !== ''
    const regra = mudouIx ? 'indice' : mudouDur ? 'duracao' : a.regra
    const oficiais = e.oficiais !== undefined ? Number(e.oficiais) || 0 : a.equipe ? a.equipe.oficiais : null
    // índice: editado agora > salvo no site > histórico real (convertido pelos oficiais desta linha) > tabela
    const H = a.produtividade_hist
    const usaHist = !mudouIx && regra === 'indice' && a.indice_origem !== 'rafael-site' && H && H.ritmo_equipe > 0 && oficiais > 0 && J
    const indiceEf = mudouIx ? e.indice : usaHist ? (oficiais * J.horas_dia) / H.ritmo_equipe : a.indice
    const base = horasDaLinha({ regra, quantidade: a.quantidade, indice: indiceEf,
      duracaoDias: mudouDur ? Number(e.duracao) : a.duracao_dias, oficiais, horasDia: J ? J.horas_dia : null })
    const equipes = e.equipes !== undefined && e.equipes !== '' ? e.equipes : a.equipes_definidas
    const x = a.calc   // percentuais sem arredondar (a mesma conta do servidor)
    const proj = a.modo === 'projecao'
    const t = calcularTermino({ base, real: x.real, oficiais, equipes, equipesCronograma: a.equipes_cronograma,
      fimCrono: a.fim_crono, hoje: d.hoje, jornada: J, feriados: d.feriados,
      inicio: proj ? x.inicio_trabalho : null, alvoFim: proj ? (a.proj ? a.proj.fim : a.fim_crono) : null,
      // ritmo histórico (ordem do caixa, item b): só sem índice digitado agora; equipes salvas/digitadas vêm antes dele
      ritmoHist: !mudouIx && x.ritmo_hist > 0 ? { ritmo: x.ritmo_hist, equipes: x.equipes_hist } : null, quantidade: a.quantidade })
    const xCx = mudouIx ? { ...x, ritmo_hist: null } : x
    const caixa = (per) => {
      const M = d.periodos.mes
      const det = planoPeriodo({ modo: a.modo, calc: xCx, per, periodo: d.periodos[per], diasMes: J ? M.dias_uteis : M.dias_corridos,
        termino: t, oficiais, jornada: J, feriados: d.feriados })
      return { pct: det.pct, detalhe: det, ...caixaAtividade({ pct: det.pct, orcado: a.orcado, excessoProprio: a.excesso_proprio,
        materiais: a.materiais, proprioEhMaterial: a.proprio_material }) }
    }
    return { t, regra, oficiais, indice: indiceEf, origem: mudouIx ? 'digitado' : usaHist ? 'historico' : a.indice_origem, cxSemana: caixa('semana'), cxMes: caixa('mes') }
  }

  const ativs = d.atividades.map((a) => ({ ...a, ef: efetivo(a) }))
  // ciclo do pavimento na Estrutura (forma dita ritmo e término; armação acompanha; concretagem no dia seguinte ao fim
  // da forma) — a mesma função do servidor, também quando o Rafael muda as equipes da forma na tela
  const recsCiclo = ativs.map((a) => ({ a, t: a.ef.t, cx: { semana: a.ef.cxSemana, mes: a.ef.cxMes } }))
  aplicarCicloEstrutura(recsCiclo, { periodos: d.periodos, jornada: J, feriados: d.feriados })
  recsCiclo.forEach((r) => { if (r.ciclo) r.a.ef = { ...r.a.ef, t: r.t, cxSemana: r.cx.semana, cxMes: r.cx.mes, ciclo: r.ciclo } })
  const naAba = (a, k) => (k === 'atrasadas' ? a.atrasada : k === 'semana' ? a.na_semana : a.em_30)
  const perDaAba = aba === 'semana' ? 'semana' : 'mes'
  const cxDe = (a, per) => (per === 'semana' ? a.ef.cxSemana : a.ef.cxMes)
  const somaCx = (ls, per) => ls.reduce((s, a) => { const c = cxDe(a, per); return { mo: s.mo + c.mo, material: s.material + c.material, total: s.total + c.total } }, { mo: 0, material: 0, total: 0 })
  const caixaTopo = (per) => {
    const ls = ativs.filter((a) => naAba(a, per))
    const serv = somaCx(ls, per)
    const T = d.caixa[per].totais
    const extras = T.contas + T.recorrentes_diretos + T.indiretos_recorrentes + T.indiretos_pontuais
    return { serv, T, total: Math.round((serv.total + extras) * 100) / 100, curva: d.caixa[per].curva, ls }
  }
  const cxS = caixaTopo('semana'), cxM = caixaTopo('mes')
  const equipesTopo = ativs.filter((a) => a.em_30).reduce((s, a) => s + (a.ef.t.usadas || 0), 0)
  // exibição arredondada para cima (o ritmo histórico dá fração de equipe); a conta continua exata — fração no title
  const equipesTopoTxt = Math.ceil(equipesTopo - 1e-9)
  const equipesTopoTitle = `${nf(equipesTopo, 1)} equipes (exato, somando o ritmo histórico de cada serviço)`
  const em6m = new Date(Date.parse(d.hoje + 'T00:00:00Z') + 183 * 864e5).toISOString().slice(0, 10)
  const alertasCompra = d.compras.filter((c) => c.pedir_ate && c.pedir_ate <= em6m)
  const atrasoDe = (a) => Math.max(a.ritmo ? a.ritmo.atrasa || 0 : 0, a.ef.t.atrasa || 0)

  // grupos da aba (ordem: com atraso primeiro, pelo maior atraso; depois pelo início planejado)
  const lista = ativs.filter((a) => naAba(a, aba))
  const porGrupo = {}
  lista.forEach((a) => { (porGrupo[a.grupo_num] = porGrupo[a.grupo_num] || { num: a.grupo_num, nome: a.grupo_nome, itens: [] }).itens.push(a) })
  const resumoGrupo = (itens) => {
    const fimsRitmo = itens.map((a) => (a.ritmo && a.ritmo.fim_ritmo) || null)
    return {
      n: itens.length, atrasadas: itens.filter((a) => a.atrasada).length,
      atraso: Math.max(0, ...itens.map(atrasoDe)),
      equipes: itens.reduce((s, a) => s + (a.ef.t.usadas || 0), 0),
      fimPlan: itens.map((a) => a.fim_crono).filter(Boolean).sort().pop(),
      fimRitmo: fimsRitmo.some((x) => !x) ? null : fimsRitmo.sort().pop(),
      naoIniciadas: itens.filter((a) => a.ritmo && a.ritmo.nao_iniciada).length,
      cx: somaCx(itens, perDaAba),
      inicio: itens.map((a) => a.inicio_crono).filter(Boolean).sort()[0],
    }
  }
  const gruposAba = Object.values(porGrupo).map((g) => ({ ...g, r: resumoGrupo(g.itens) }))
    .sort((a, b) => (b.r.atraso > 0) - (a.r.atraso > 0) || b.r.atraso - a.r.atraso || String(a.r.inicio).localeCompare(String(b.r.inicio)))

  const numero = (l, v, cor, onClick, sub, title) => (
    <div key={l} className={'kpi' + (onClick ? ' kpi-clickable' : '')} style={{ flex: 1, minWidth: 140 }} onClick={onClick} title={title}>
      <div className="kpi-label">{l}</div>
      <div className="kpi-value" style={{ fontSize: 20, color: cor }}>{v}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )

  const cabGrupo = (k, titulo, r, nivel) => (
    <tr key={'g' + k} onClick={() => alternar(k)} style={{ cursor: 'pointer', background: nivel === 0 ? 'var(--bg3)' : 'transparent' }}>
      <td colSpan={NCOL} style={{ fontSize: 12, padding: nivel === 0 ? '9px 8px' : '7px 8px 7px 28px' }}>
        <span style={{ color: CINZA, marginRight: 6 }}>{grupos.has(k) ? '▾' : '▸'}</span>
        <b style={nivel === 0 ? { textTransform: 'uppercase' } : null}>{titulo}</b>
        <span style={{ color: CINZA }}>
          {' · '}{r.n} atividade{r.n === 1 ? '' : 's'} ({r.atrasadas} atrasada{r.atrasadas === 1 ? '' : 's'})
          {r.atraso > 0 && <span style={{ color: VERMELHO }}> · maior atraso {diasUt(r.atraso)}</span>}
          {' · '}{r.equipes} equipe{r.equipes === 1 ? '' : 's'}
          {' · '}fim planejado {dm(r.fimPlan)}
          {' · '}no ritmo atual {r.fimRitmo ? dm(r.fimRitmo) : r.naoIniciadas ? `— (${r.naoIniciadas} não iniciada${r.naoIniciadas === 1 ? '' : 's'})` : '—'}
          {' · '}caixa {perDaAba === 'semana' ? 'da semana' : 'em 30 dias'} <b style={{ color: 'var(--text)' }}>{rs(r.cx.total)}</b>
        </span>
      </td>
    </tr>
  )

  const nomeLinha = (a) => `${a.cod_eap} ${pav(a.pavimento)}`.trim()
  const pedir = (a, corpo, texto) => setConfirmar({ chave: a.chave, corpo: { cod_eap: a.cod_eap, pavimento: a.pavimento, ...corpo }, texto })

  const linhaAtividade = (a) => {
    const e = ed(a.chave)
    const { t, regra } = a.ef
    const cx = cxDe(a, perDaAba)
    const mudouIx = e.indice !== undefined
    const mudouDur = e.duracao !== undefined
    const mudouEq = e.equipes !== undefined
    const porDuracao = regra === 'duracao' && !mudouIx
    const semIndice = porDuracao ? a.duracao_dias == null && !(Number(e.duracao) > 0) : a.indice == null && !(Number(e.indice) > 0)
    const semEquipe = !a.equipe
    const on = linhaAberta === a.chave
    const rt = a.ritmo || {}
    const det = cx.detalhe || {}
    return (
      <React.Fragment key={a.chave}>
        <tr>
          <td style={{ fontSize: 12, cursor: 'pointer', paddingLeft: 30 }} onClick={() => setLinhaAberta(on ? null : a.chave)} title="Ver memória de cálculo e alterações">
            <span style={{ color: CINZA, marginRight: 4 }}>{on ? '▾' : '▸'}</span>
            <span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{a.cod_eap}</span> {a.descricao.length > 40 ? a.descricao.slice(0, 38) + '…' : a.descricao}
            <span style={{ color: CINZA }}> · {pav(a.pavimento)}</span>
            {a.aguarda_medicao && <span style={{ color: AMBAR }}> · aguardando medição</span>}
            {a.status === 'ADIANTADA' && <span style={{ color: VERDE }}> · adiantada</span>}
            {a.ciclo && <span style={{ color: CINZA }} title="Estrutura: o pavimento anda junto — mesmo % no período da linha que dita o ritmo"> · segue {a.ciclo.lider_cod}</span>}
            {!a.atrasada && a.motivo && a.motivo !== 'planejada no período' && <span style={{ color: CINZA }}> · {a.motivo}</span>}
            {a.conferir && <span style={{ color: AMBAR }} title={a.observacao || ''}> · conferir índice</span>}
          </td>
          <td style={num}>{nf(a.quantidade, 2)} {a.unidade}</td>
          <td style={num}>{pc(a.real)}</td>
          <td style={num}>{pc(a.plan_hoje)}</td>
          <td style={{ ...num, color: a.desvio < -0.05 ? VERMELHO : a.desvio > 0.05 ? VERDE : CINZA }}>{(a.desvio > 0 ? '+' : '') + nf(a.desvio, 1)} p.p.</td>
          <td style={num}>{nf(a.falta_qtd, 2)} {a.unidade}<div style={{ color: CINZA }}>{t.horas == null ? '—' : `${nf(t.horas, 0)} Hh`}</div></td>
          <td style={{ textAlign: 'right', fontSize: 11 }}>
            {porDuracao ? (
              <span>
                <input type="text" inputMode="decimal" style={inp(semIndice, 52)} placeholder="dias"
                       value={mudouDur ? String(e.duracao).replace('.', ',') : a.duracao_dias == null ? '' : nf(a.duracao_dias, 0)}
                       onChange={(ev) => setCampo(a.chave, 'duracao', ev.target.value.replace(',', '.'))} />
                <span style={{ color: CINZA }}> dias</span>
              </span>
            ) : (
              <input type="text" inputMode="decimal" style={inp(semIndice)} placeholder={semIndice ? 'preencher' : ''}
                     value={mudouIx ? String(e.indice).replace('.', ',') : a.ef.indice == null ? '' : ixTxt(a.ef.indice)}
                     onChange={(ev) => setCampo(a.chave, 'indice', ev.target.value.replace(',', '.'))} />
            )}
            <div style={{ color: CINZA, fontSize: 10 }}>
              {porDuracao ? 'serviço por duração'
                : a.ef.origem === 'historico' ? txtHist(a.produtividade_hist, a.ef.indice, a.unidade)
                : a.indice_origem ? `sugerido ${a.indice != null ? ixTxt(a.indice) : ''} (${ORIGEM[a.indice_origem] || a.indice_origem})` : 'sem índice'}
              {a.hh_cpu_oficial != null && !porDuracao ? ` · CPU ${ixTxt(a.hh_cpu_oficial)}` : ''}
            </div>
            {(mudouIx || mudouDur) && (
              <div>
                {mudouIx && Number(e.indice) > 0 && (
                  <button className="btn-sm" style={btnMini}
                          onClick={() => pedir(a, { campo: 'indice', valor: Number(e.indice) }, `Gravar índice ${ixTxt(e.indice)} Hh/${a.unidade} (oficial) em ${nomeLinha(a)}?`)}>salvar</button>
                )}
                {mudouDur && !mudouIx && Number(e.duracao) > 0 && (
                  <button className="btn-sm" style={btnMini}
                          onClick={() => pedir(a, { campo: 'duracao', valor: Number(e.duracao) }, `Gravar duração de ${nf(e.duracao, 0)} dia(s) úteis em ${nomeLinha(a)}?`)}>salvar</button>
                )}
                <button className="btn-sm" style={{ ...btnMini, marginLeft: 4 }} onClick={() => limpar(a.chave, ['indice', 'duracao'])}>voltar</button>
              </div>
            )}
          </td>
          <td style={{ textAlign: 'right', fontSize: 11 }}>
            {semEquipe ? (
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <input type="number" min="1" style={inp(true, 44)} placeholder="of." title="nº de oficiais"
                       value={e.oficiais ?? ''} onChange={(ev) => setCampo(a.chave, 'oficiais', ev.target.value)} />
                <input type="number" min="0" style={inp(true, 44)} placeholder="aj." title="nº de ajudantes"
                       value={e.ajudantes ?? ''} onChange={(ev) => setCampo(a.chave, 'ajudantes', ev.target.value)} />
                <input type="text" style={inp(true, 84)} placeholder="função" title="função do oficial"
                       value={e.funcao ?? ''} onChange={(ev) => setCampo(a.chave, 'funcao', ev.target.value)} />
                {Number(e.oficiais) > 0 && (
                  <button className="btn-sm" style={btnMini}
                          onClick={() => pedir(a, { campo: 'equipe', valor: { oficiais: Number(e.oficiais) || 0, ajudantes: Number(e.ajudantes) || 0, funcao: e.funcao || '' } },
                            `Gravar equipe ${Number(e.oficiais) || 0} ${e.funcao || 'oficial'} + ${Number(e.ajudantes) || 0} ajudante(s) em ${nomeLinha(a)}?`)}>salvar</button>
                )}
              </div>
            ) : (
              <input type="number" min="1" style={inp(false, 52)}
                     value={mudouEq ? e.equipes : t.usadas ?? ''} onChange={(ev) => setCampo(a.chave, 'equipes', ev.target.value)} />
            )}
            <div style={{ color: CINZA, fontSize: 10 }}>
              {t.acompanha_forma ? `sugerido ${t.sugeridas ?? '—'} para acompanhar a forma` : t.pelo_historico && !t.definida ? `ritmo histórico ≈${nf(t.usadas, 1)} equipes` : `sugerido ${t.sugeridas ?? '—'}${t.sugeridas != null && t.sugeridas_origem === 'cronograma' ? ' (cronograma)' : ''}`}{a.equipe ? ` · ${a.equipe.composicao}` : ''}
            </div>
            {!semEquipe && (mudouEq || a.equipes_definidas != null) && (
              <div>
                {mudouEq && Number(e.equipes) > 0 && (
                  <button className="btn-sm" style={btnMini}
                          onClick={() => pedir(a, { campo: 'equipes', valor: Number(e.equipes) }, `Gravar ${e.equipes} equipe(s) em ${nomeLinha(a)}?`)}>salvar</button>
                )}
                <button className="btn-sm" style={{ ...btnMini, marginLeft: 4 }}
                        onClick={() => (a.equipes_definidas != null
                          ? pedir(a, { campo: 'equipes', valor: null }, `Voltar ${nomeLinha(a)} ao número sugerido de equipes (apaga o valor salvo)?`)
                          : limpar(a.chave, ['equipes']))}>voltar ao sugerido</button>
              </div>
            )}
          </td>
          <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
            <div style={{ color: CINZA }}>planejado {dm(a.inicio_crono)} → {dm(a.fim_crono)}</div>
            {a.modo === 'projecao' && a.proj && (
              <div style={{ color: CINZA }} title={a.proj.fonte === 'frente' ? `adiantamento da frente (grupo + pavimento): ${a.proj.dias} dias` : `adiantamento da obra: ${a.proj.dias} dias`}>
                projetado {dm(a.proj.inicio)} → {dm(a.proj.fim)} ({a.proj.fonte === 'frente' ? 'pavimento' : 'obra'} {a.proj.dias > 0 ? '+' : ''}{a.proj.dias} d)
              </div>
            )}
            <div style={{ color: rt.nao_iniciada ? (rt.deveria_desde ? VERMELHO : CINZA) : rt.confiavel === false ? CINZA : rt.cumpre ? VERDE : VERMELHO }}>
              {rt.nao_iniciada
                ? (rt.aguarda_medicao ? 'aguardando a medição real' : rt.deveria_desde ? `não iniciada · deveria ter começado em ${dm(rt.deveria_desde)}` : 'não iniciada')
                : rt.confiavel === false ? `ritmo atual: poucas medições (${diasUt(rt.dias_uteis)})`
                : `no ritmo atual ${dm(rt.fim_ritmo)} (${rt.cumpre ? 'cumpre' : `atrasa ${diasUt(rt.atrasa)}`})`}
            </div>
            <div style={{ color: t.termino ? (t.cumpre ? VERDE : VERMELHO) : AMBAR }}>
              {t.termino && t.concretagem ? `concretagem em ${dm(t.concretagem)}, depois de forma e armação (${t.cumpre ? 'cumpre' : `atrasa ${diasUt(t.atrasa)}`})`
                : t.termino && t.acompanha_forma ? `acompanha a forma: ${dm(t.termino)} com ${t.usadas ?? '—'} armador(es) (${t.cumpre ? 'cumpre' : `atrasa ${diasUt(t.atrasa)}`})`
                : t.termino && t.pelo_historico ? `no ritmo histórico (≈${nf(t.usadas, 1)} equipes) ${dm(t.termino)} (${t.cumpre ? 'cumpre' : `atrasa ${diasUt(t.atrasa)}`})`
                : t.termino ? `com ${t.usadas} equipe${t.usadas === 1 ? '' : 's'} ${dm(t.termino)} (${t.cumpre ? 'cumpre' : `atrasa ${diasUt(t.atrasa)}`})`
                : `preencha ${semIndice ? (porDuracao ? 'a duração' : 'o índice') : ''}${semIndice && semEquipe ? ' e ' : ''}${semEquipe ? 'a equipe' : ''}`}
            </div>
          </td>
          <td style={num} title={`${nf(cx.pct, 1)}% a executar no período`}>
            {rs(cx.total)}
            <div style={{ color: CINZA, fontSize: 10 }}>MO {rs(cx.mo)} · mat. {rs(cx.material)}</div>
          </td>
        </tr>
        {on && (
          <tr>
            <td colSpan={NCOL} style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg)', lineHeight: 1.7, paddingLeft: 30 }}>
              <b>Memória de cálculo</b> · horas que faltam = (100% − {pc(a.real)}) × {porDuracao
                ? `${nf(mudouDur ? e.duracao : a.duracao_dias, 0)} dias × ${a.ef.oficiais ?? '—'} oficial(is) × ${J ? J.horas_dia : '—'} h`
                : `${nf(a.quantidade, 2)} ${a.unidade} × ${mudouIx ? ixTxt(e.indice) : a.indice != null ? ixTxt(a.indice) : 'índice'} Hh/${a.unidade}`}
              {' '}= {nf(t.horas, 0)} Hh · 1 equipe = {a.ef.oficiais ?? '—'} oficial(is) × {J ? J.horas_dia : '—'} h = {t.capacidade_dia ?? '—'} Hh/dia
              {' '}· data-alvo {dmy(t.alvo)} ({t.dias_ate_alvo == null ? '—' : diasUt(t.dias_ate_alvo)}) · necessárias {nf(t.necessarias, 2)} · sugerido {t.sugeridas ?? '—'} equipe(s)
              {a.hh_cronograma != null && <> · cronograma {ixTxt(a.hh_cronograma)} Hh/{a.unidade}</>}
              {a.produtividade_hist && <><br />Produtividade histórica: {a.produtividade_hist.pavimentos.map((p) => `${pav(p.pavimento)} ${dm(p.primeira)}→${dm(p.ultima)}: ${nf(p.quantidade, 1)} ${a.unidade} em ${diasUt(p.dias_uteis)} com ${p.equipes ?? '—'} equipe(s) = ${nf(p.ritmo, 1)} ${a.unidade}/dia${p.valido ? '' : ' (não vale: menos de 5 dias úteis ou sem equipes)'}`).join(' · ')}
                {a.produtividade_hist.ritmo_equipe != null && ` → média ${nf(a.produtividade_hist.ritmo_equipe, 1)} ${a.unidade}/dia por equipe`}</>}
              {a.hh_cpu != null && <> · CPU {ixTxt(a.hh_cpu_oficial ?? a.hh_cpu)} do oficial ({ixTxt(a.hh_cpu)} total)</>}
              {a.observacao && <><br /><span style={{ color: CINZA }}>{a.observacao}</span></>}
              <br />Ritmo atual: {rt.nao_iniciada ? 'sem medição' : rt.ritmo == null ? `concluída em ${dmy(rt.ultima)}` : `${nf(rt.ritmo, 2)}% por dia útil, de ${dmy(rt.inicio_real)} até a última medição ${dmy(rt.ultima)}`}
              <br />Caixa {perDaAba === 'semana' ? 'da semana' : 'em 30 dias'}{det.modo === 'projecao' ? ` (projeção: ${det.fonte}, a partir de ${dmy(det.inicio)})` : ''}: {det.modo === 'ciclo'
                ? <>{det.fonte}: o mesmo % da forma ({nf(det.pct_lider, 1)}%){cx.pct < det.pct_lider - 1e-9 ? ', limitado ao que falta nesta linha' : ''} · armadores para acompanhar: {nf(t.horas, 0)} Hh (índice do cronograma) ÷ ({t.dias_ate_alvo == null ? '—' : diasUt(t.dias_ate_alvo)} × {J ? J.horas_dia : '—'} h) = {nf(t.necessarias, 2)} → {t.sugeridas ?? '—'}</>
                : det.modo === 'concretagem' ? <>concretagem não se distribui: cai inteira em {dmy(det.data)} (dia útil seguinte ao fim da forma){det.dentro ? ', dentro do período' : ', fora do período'}</>
                : det.fonte === 'ritmo histórico' ? <>ritmo histórico {nf(det.ritmo_hist, 1)} {a.unidade}/dia (≈{nf(det.equipes, 1)} equipes, como nos pavimentos já feitos) × {diasUt(det.dias)} desde {dmy(det.inicio)} ÷ {nf(a.quantidade, 2)} {a.unidade}</>
                : det.modo === 'projecao' && det.fonte === 'ritmo real'
                ? <>{nf(det.ritmo_dia, 2)}% por dia útil × {diasUt(det.dias)}</>
                : det.modo === 'projecao' && det.fonte === 'começa depois do período' ? <>começa depois do período</>
                : det.hh != null
                ? <>{t.definida ? `${det.equipes} equipe${det.equipes === 1 ? '' : 's'}` : `${nf(det.equipes, 2)} equipes (necessárias para terminar em ${dmy(t.alvo)})`} × {det.oficiais} oficial(is) × {det.horas_dia} h × {diasUt(det.dias)} = {nf(det.hh, 0)} Hh
                  ÷ {nf(det.horas_por_pct, 3)} Hh por 1% = {nf(det.hh / det.horas_por_pct, 1)}%{det.limitado ? ` (limitado ao que falta)` : ''}</>
                : <>ritmo do cronograma {nf(det.ritmo, 1)}% + recuperação do atraso {nf(det.atraso, 1)}% ({nf(det.atraso_total, 1)}% × {det.dias}/{det.dias_mes} dias){det.limitado ? ', limitado ao que falta' : ''}</>}
              {' '}= {nf(cx.pct, 1)}% × ({a.proprio_material ? 'material' : 'serviço'} {rs(a.orcado)}{a.excesso_proprio > 0.005 ? ` − já pago/a pagar além do executado ${rs(a.excesso_proprio)}` : ''}
              {a.materiais.length > 0 && <> + materiais {a.materiais.map((m) => `${m.cod_eap} ${rs(m.orcado)}${m.excesso > 0.005 ? ` − já comprado além do aplicado ${rs(m.excesso)}` : ''}`).join(' + ')}</>}) = {rs(cx.total)}
              {a.cronograma_curto && <><br /><span style={{ color: AMBAR }}>Cronograma curto: prevê {nf(a.cronograma_curto.horas_cronograma, 0)} h; pelo índice são {nf(a.cronograma_curto.horas_indice, 0)} h (+{nf(a.cronograma_curto.excesso_pct, 1)}%)</span></>}
              <br /><b>Alterações</b>: {a.historico && a.historico.length
                ? a.historico.map((h, i) => <span key={i}>{i ? ' · ' : ''}{dmy(String(h.editado_em).slice(0, 10))} {h.editado_por || '—'}: {h.campo} {h.valor_anterior ?? '—'} → {h.valor_novo ?? 'sugerido'}</span>)
                : 'nenhuma'}
            </td>
          </tr>
        )}
      </React.Fragment>
    )
  }

  // composição do caixa: por grupo (recolhido, com as atividades), contas a pagar, recorrentes, indiretos; curva em cinza
  const composicao = (per) => {
    const c = per === 'semana' ? cxS : cxM
    const C = d.caixa[per]
    const pg = {}
    c.ls.forEach((a) => {
      const x = cxDe(a, per)
      if (!(x.total > 0.005)) return
      const g = (pg[a.grupo_num] = pg[a.grupo_num] || { nome: a.grupo_nome, total: 0, itens: [] })
      g.total += x.total; g.itens.push({ a, x })
    })
    const abre = (k) => setCxAbertos((s0) => { const n = new Set(s0); n.has(k) ? n.delete(k) : n.add(k); return n })
    const linha = (k, rot, valor, abrivel, forte) => (
      <div key={k} onClick={abrivel ? () => abre(k) : undefined}
           style={{ display: 'flex', gap: 8, cursor: abrivel ? 'pointer' : 'default', fontWeight: forte ? 600 : 400, padding: '2px 0' }}>
        <span style={{ color: CINZA, width: 12 }}>{abrivel ? (cxAbertos.has(k) ? '▾' : '▸') : ''}</span>
        <span style={{ flex: 1 }}>{rot}</span>
        <span style={{ fontFamily: 'var(--mono)' }}>{rs(valor)}</span>
      </div>
    )
    const sub = (itens) => <div style={{ paddingLeft: 22, color: 'var(--text2)', fontSize: 11 }}>{itens}</div>
    const item = (key, rot, valor) => (
      <div key={key} style={{ display: 'flex', gap: 8 }}><span style={{ flex: 1 }}>{rot}</span><span style={{ fontFamily: 'var(--mono)' }}>{valor}</span></div>
    )
    const indRec = C.indiretos.filter((x) => x.tipo === 'indireto recorrente')
    const indPon = C.indiretos.filter((x) => x.tipo === 'indireto pontual')
    return (
      <div className="toast" style={{ marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
        <b>Caixa {per === 'semana' ? 'da próxima semana' : 'dos próximos 30 dias'}</b> ({dmy(d.periodos[per].de)} a {dmy(d.periodos[per].ate)})
        {Object.entries(pg).sort((a, b) => a[0] - b[0]).map(([k, g]) => (
          <div key={k}>
            {linha(`${per}|g${k}`, `${k} ${g.nome}`, g.total, true)}
            {cxAbertos.has(`${per}|g${k}`) && sub(g.itens.map(({ a, x }) => item(a.chave, `${a.cod_eap} ${a.descricao.slice(0, 40)} · ${pav(a.pavimento)}`,
              <>MO {rs(x.mo)} · material {rs(x.material)} · <b>{rs(x.total)}</b></>)))}
          </div>
        ))}
        {linha(`${per}|contas`, `Contas a pagar com vencimento no período (${C.contas.length})`, c.T.contas, C.contas.length > 0)}
        {cxAbertos.has(`${per}|contas`) && sub(C.contas.map((x, i) => item(i, `${x.fornecedor || '—'} · doc. ${x.documento || '—'} · vence ${dm(x.vencimento)} · ${x.codigo_eap || 'sem EAP'}${x.natureza === 'previsto_sem_nf' ? ' · previsto sem NF' : ''}`, rs(x.valor))))}
        {linha(`${per}|rec`, 'Recorrentes diretos (locação, funcionários, consumo) — planejado diluído', c.T.recorrentes_diretos, C.recorrentes.length > 0)}
        {cxAbertos.has(`${per}|rec`) && sub(C.recorrentes.map((x) => item(x.codigo_eap, `${x.codigo_eap} ${x.descricao}`, rs(x.valor))))}
        {linha(`${per}|indr`, '19 Indiretos recorrentes — planejado diluído', c.T.indiretos_recorrentes, indRec.length > 0)}
        {cxAbertos.has(`${per}|indr`) && sub(indRec.map((x) => item(x.codigo_eap, `${x.codigo_eap} ${x.categoria}`, rs(x.valor))))}
        {linha(`${per}|indp`, '19 Indiretos pontuais planejados no período', c.T.indiretos_pontuais, indPon.length > 0)}
        {cxAbertos.has(`${per}|indp`) && sub(indPon.map((x) => item(x.codigo_eap, `${x.codigo_eap} ${x.categoria}`, rs(x.valor))))}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
          {linha(`${per}|tot`, 'TOTAL', c.total, false, true)}
          <div style={{ color: CINZA, fontSize: 11, textAlign: 'right' }}>desembolso previsto pela curva do cronograma no período: {rs(c.curva)}</div>
        </div>
        <div style={{ color: CINZA, fontSize: 10, marginTop: 4 }}>
          Contas a pagar: entra o título com vencimento (ou previsão de baixa) dentro do período; vencido antes conta como pago.
          O contas a pagar não traz os recorrentes; eles entram pelo planejado diluído. Material já comprado além do executado não entra de novo.
        </div>
      </div>
    )
  }

  const pendCompra = (c) => c.antecedencia_dias == null && c.antecedencia_meses == null && c.regra !== 'ultimo_mes'
  const textoAlertaCompra = () => {
    if (!alertasCompra.length) return null
    const v = alertasCompra.filter((c) => c.status === 'vencido').length
    return v ? `${v} vencid${v === 1 ? 'a' : 'as'}` : `${alertasCompra.length} vence${alertasCompra.length === 1 ? '' : 'm'} em 6 meses`
  }

  return (
    <div className="card">
      <div className="card-title" onClick={() => setAberto(false)}
           style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}>
        <span>⚠️ Pontos de atenção</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="kpi-sub" title={equipesTopoTitle}>{d.topo.atrasadas} atrasadas · {equipesTopoTxt} equipes sugeridas</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>▲</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        {numero('Atrasadas', d.topo.atrasadas, d.topo.atrasadas ? VERMELHO : undefined)}
        {numero('A executar na semana', d.topo.semana)}
        {numero('A executar em 30 dias', d.topo.mes)}
        {numero('Equipes sugeridas (30 dias)', equipesTopoTxt, undefined, undefined, undefined, equipesTopoTitle)}
        {numero('Caixa próxima semana', rs(cxS.total), undefined, () => setVerCaixa(verCaixa === 'semana' ? null : 'semana'), `curva: ${rs(cxS.curva)}`)}
        {numero('Caixa 30 dias', rs(cxM.total), undefined, () => setVerCaixa(verCaixa === 'mes' ? null : 'mes'), `curva: ${rs(cxM.curva)}`)}
      </div>
      <div className="kpi-sub" style={{ marginBottom: 10 }}>
        {PREMISSA.charAt(0).toUpperCase() + PREMISSA.slice(1)}.
        {' '}Hoje = fim da S{String(d.semana).padStart(2, '0')} ({dmy(d.hoje)})
        {' · '}{J ? `jornada ${nf(J.horas_dia, 0)} h/dia, ${J.dias_semana.length === 5 ? 'seg–sex' : J.dias_semana.length === 6 ? 'seg–sáb' : `${J.dias_semana.length} dias/semana`}` : <span style={{ color: AMBAR }}>jornada pendente</span>}
        {d.adiantamento && ` · obra ${d.adiantamento.dias >= 0 ? 'adiantada' : 'atrasada'} ${Math.abs(d.adiantamento.dias)} dias`}
        {!d.configurado.indices && <span style={{ color: AMBAR }}> · configure as tabelas (SQL 1 do planejamento)</span>}
        {d.configurado.indices && !d.configurado.edicao && <span style={{ color: AMBAR }}> · para salvar pelo site, rode o SQL 2 do planejamento</span>}
        {(d.feriados_lista || []).some((f) => f.a_confirmar) && <span> · feriados de BH a confirmar</span>}
      </div>
      {verCaixa && composicao(verCaixa)}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {ABAS.map(([v, l]) => (
          <button key={v} className="btn-sm" onClick={() => setAba(v)} style={aba === v ? { color: 'var(--text)', borderColor: 'var(--accent)' } : null}>{l}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn-sm" onClick={() => setVerCompras((x) => !x)} style={{ color: CINZA }}>
          Compras {verCompras ? '▾' : '▸'}{textoAlertaCompra() && <span style={{ color: alertasCompra.some((c) => c.status === 'vencido') ? VERMELHO : AMBAR }}> {textoAlertaCompra()}</span>}
        </button>
      </div>

      {pedirSenha && <Desbloqueio onCancelar={() => setPedirSenha(false)}
                                  onLiberar={(q) => { setQuem(q || ''); setPedirSenha(false); setMsg({ tipo: 'ok', txt: 'Liberado. Clique em Gravar.' }) }} />}
      {confirmar && !pedirSenha && (
        <div className="toast" style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{confirmar.texto}</span>
          <button className="btn-primary" onClick={gravar} disabled={gravando}>{gravando ? 'Gravando…' : 'Gravar'}</button>
          <button className="btn-secondary" onClick={() => setConfirmar(null)} disabled={gravando}>Cancelar</button>
        </div>
      )}
      {msg && <div className={'toast ' + (msg.tipo === 'err' ? 'toast-err' : 'toast-ok')} style={{ marginBottom: 10, cursor: 'pointer' }} onClick={() => setMsg(null)}>{msg.txt}</div>}

      {verCompras && (
        <div style={{ overflowX: 'auto', marginBottom: 14 }}>
          <table>
            <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Antecedência</th><th style={{ textAlign: 'right' }}>Planejado</th><th style={{ textAlign: 'right' }}>Projetado</th><th style={{ textAlign: 'right' }}>Pedir até</th></tr></thead>
            <tbody>
              {d.compras.map((c) => {
                const v = editCompra[c.cod_eap]
                const mudou = v !== undefined
                return (
                  <tr key={c.cod_eap}>
                    <td style={{ fontSize: 12 }}><span style={{ fontFamily: 'var(--mono)', color: CINZA }}>{c.cod_eap}</span> {c.descricao} <span style={{ color: CINZA }}>· {c.categoria}</span>
                      {c.observacao && <div style={{ color: CINZA, fontSize: 10 }}>{c.observacao}</div>}</td>
                    <td style={{ textAlign: 'right', fontSize: 11 }}>
                      {c.antecedencia_meses != null && !mudou ? <span style={{ fontFamily: 'var(--mono)' }}>{c.antecedencia_meses} meses</span> : (
                        <span>
                          <input type="number" min="0" style={inp(pendCompra(c) && !mudou, 56)} placeholder="dias"
                                 value={mudou ? v : c.antecedencia_dias ?? ''} onChange={(ev) => setEditCompra((x) => ({ ...x, [c.cod_eap]: ev.target.value }))} />
                          <span style={{ color: CINZA }}> dias</span>
                        </span>
                      )}
                      {mudou && v !== '' && Number(v) >= 0 && (
                        <div><button className="btn-sm" style={btnMini}
                                     onClick={() => setConfirmar({ corpo: { cod_eap: c.cod_eap, pavimento: null, campo: 'antecedencia', valor: { dias: Number(v) } },
                                       texto: `Gravar antecedência de ${v} dias para ${c.cod_eap} (${c.categoria})?` })}>salvar</button></div>
                      )}
                    </td>
                    <td style={{ ...num, color: CINZA }}>{dmy(c.planejado)}</td>
                    <td style={num}>{dmy(c.necessidade)}</td>
                    <td style={{ ...num, color: c.status === 'vencido' ? VERMELHO : c.pedir_ate && c.pedir_ate <= em6m ? AMBAR : undefined }}>
                      {c.regra === 'ultimo_mes' ? 'no último mês' : c.pedir_ate ? dmy(c.pedir_ate) : 'prazo pendente'}
                      {c.status === 'vencido' && <div style={{ fontSize: 10 }}>vencido</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="kpi-sub" style={{ marginTop: 4 }}>
            Projetado = início planejado deslocado pelo adiantamento/atraso atual da obra{d.adiantamento ? ` (${d.adiantamento.dias} dias)` : ''}; pedir até = projetado − antecedência. Recalcula a cada medição.
          </div>
        </div>
      )}

      {gruposAba.length === 0 ? <div className="kpi-sub">Nada nesta aba.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Atividade</th>
                <th style={{ textAlign: 'right' }}>Quantidade</th>
                <th style={{ textAlign: 'right' }}>% concluído</th>
                <th style={{ textAlign: 'right' }}>% planejado</th>
                <th style={{ textAlign: 'right' }}>Desvio</th>
                <th style={{ textAlign: 'right' }}>Falta</th>
                <th style={{ textAlign: 'right' }}>Índice (Hh/un)</th>
                <th style={{ textAlign: 'right' }}>Equipes</th>
                <th>Datas</th>
                <th style={{ textAlign: 'right' }}>Caixa {perDaAba === 'semana' ? 'semana' : '30 dias'}</th>
              </tr>
            </thead>
            <tbody>
              {gruposAba.map((g) => {
                const kg = `${aba}|${g.num}`
                const pavs = [...new Set(g.itens.map((a) => a.pavimento))]
                const subdividir = g.num === 3 && pavs.length > 1
                return (
                  <React.Fragment key={kg}>
                    {cabGrupo(kg, `${g.num} ${g.nome}`, g.r, 0)}
                    {grupos.has(kg) && (subdividir
                      ? pavs.map((p) => {
                        const itens = g.itens.filter((a) => a.pavimento === p)
                        const kp = `${kg}|${p}`
                        return (
                          <React.Fragment key={kp}>
                            {cabGrupo(kp, pav(p) || '—', resumoGrupo(itens), 1)}
                            {grupos.has(kp) && itens.map(linhaAtividade)}
                          </React.Fragment>
                        )
                      })
                      : g.itens.map(linhaAtividade))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {d.pendencias.length > 0 && (
        <div className="kpi-sub" style={{ marginTop: 10 }}>
          Dados pendentes: {d.pendencias.length} ({Object.entries(d.pendencias.reduce((m, p) => ({ ...m, [p.tipo]: (m[p.tipo] || 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(' · ')}). Os campos em amarelo são para preencher.
        </div>
      )}
    </div>
  )
}
