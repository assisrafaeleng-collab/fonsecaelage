// Memoria de calculo do valor agregado das Flats Pampulha.
// Item a item: quanto o servico executado deveria ter custado ate a semana.
//   A  producao: percentual medido x custo total do item
//   B  locacao: incorrido, limitado ao orcado do item
//   C  funcionarios: tempo decorrido (planejado da curva)
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { fmtMoeda } from '../lib/constants'

const PLAN = '#6e8ba8'
const VERDE = '#7fb08a'
const VERMELHO = '#c77b74'
const AMBAR = '#c9a45c'
const MONO = "500 11px 'IBM Plex Mono', monospace"
const s2 = (n) => `S${String(n).padStart(2, '0')}`
const fmtP = (v) => (v == null ? '—' : `${Number(v).toFixed(1).replace('.', ',')}%`)
const dmy = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '')

// Código, serviço, pavimento, orçado, % físico, medido, valor agregado, pago,
// a pagar (TOTVS), % do orçado, estouro / economia, saldo da verba
const COLS = '62px minmax(0,1fr) 44px 100px 54px 88px 106px 100px 96px 62px 104px 112px'

const fmtEf = (v) => (v == null ? '—' : v.toFixed(3).replace('.', ','))
const eficiencia = (agregado, pago, aPagar) => (agregado > 0 && pago + aPagar > 0 ? agregado / (pago + aPagar) : null)

// Estouro / economia = (pago + a pagar) − valor agregado. Positivo = estouro
// (vermelho), negativo = economia (verde); o % é sobre o valor agregado. Sem
// valor agregado e sem custo: "—". A eficiência fica só no texto do mouse.
// % do orçado = (pago + a pagar) ÷ orçado, em todas as linhas, grupos e
// pavimentos (decisão out/26). Sem custo: "—"; vermelho acima de 100%.
const percDoOrcado = (pago, aPagar, orcado) => {
  const c = (pago || 0) + (aPagar || 0)
  if (c <= 0.005) return null
  return orcado > 0.005 ? (c / orcado) * 100 : Infinity
}
const tituloPercOrcado = (pago, aPagar, orcado) =>
  `(Pago + a pagar) ÷ orçado
= (${fmtMoeda(pago || 0)} + ${fmtMoeda(aPagar || 0)}) ÷ ${fmtMoeda(orcado || 0)}`
function PercOrcado({ orcado, pago, aPagar, peso }) {
  const v = percDoOrcado(pago, aPagar, orcado)
  return (
    <div
      style={{ ...dir, fontWeight: peso, color: v == null ? 'var(--text2)' : v > 100 ? VERMELHO : 'var(--text)' }}
      title={v == null ? 'Sem custo' : tituloPercOrcado(pago, aPagar, orcado)}
    >
      {v == null ? '—' : v === Infinity ? 'sem verba' : fmtP(v)}
    </div>
  )
}

// antecipada: compra antecipada ainda dentro da verba (agregado = custo)
// mostra "neutro · XX% da verba"; passando de 100%, o estouro normal.
function Estouro({ agregado, pago, aPagar, peso, antecipada, orcado }) {
  const ag = agregado || 0
  const custo = (pago || 0) + (aPagar || 0)
  if (ag <= 0.005 && custo <= 0.005) return <div style={{ ...dir, color: 'var(--text2)' }}>—</div>
  const rs = custo - ag
  const zero = Math.abs(rs) < 0.005
  const perc = ag > 0.005 ? (rs / ag) * 100 : null
  const ef = eficiencia(ag, pago || 0, aPagar || 0)
  const pv = percDoOrcado(pago, aPagar, orcado)
  if (antecipada && zero && pv != null && pv <= 100)
    return (
      <div
        style={{ ...dir, fontWeight: peso, color: 'var(--text2)' }}
        title={`Compra antecipada dentro da verba: o valor agregado segue o custo, sem estouro nem economia
${tituloPercOrcado(pago, aPagar, orcado)}`}
      >
        neutro
        <div style={{ fontSize: 10, fontWeight: 500 }}>{fmtP(pv)} da verba</div>
      </div>
    )
  return (
    <div
      style={{ ...dir, fontWeight: peso, color: zero ? 'var(--text2)' : rs > 0 ? VERMELHO : VERDE }}
      title={
        `(Pago + a pagar) − valor agregado\n= (${fmtMoeda(pago || 0)} + ${fmtMoeda(aPagar || 0)}) − ${fmtMoeda(ag)}` +
        `\nEficiência (valor agregado ÷ custo): ${fmtEf(ef)}`
      }
    >
      {(rs > 0.005 ? '+' : '') + fmtMoeda(zero ? 0 : rs)}
      <div style={{ fontSize: 10, fontWeight: 500 }}>
        {perc == null ? '—' : `${perc > 0.05 ? '+' : ''}${perc.toFixed(1).replace('.', ',')}%`}
      </div>
    </div>
  )
}

// Saldo da verba = orçado − pago − a pagar; vermelho quando negativo (verba estourada)
function Saldo({ orcado, pago, aPagar, peso }) {
  const v = (orcado || 0) - (pago || 0) - (aPagar || 0)
  return (
    <div
      style={{ ...dir, fontWeight: peso, color: v < -0.005 ? VERMELHO : 'var(--text)' }}
      title={`Orçado − pago − a pagar\n= ${fmtMoeda(orcado || 0)} − ${fmtMoeda(pago || 0)} − ${fmtMoeda(aPagar || 0)}`}
    >
      {fmtMoeda(Math.abs(v) < 0.005 ? 0 : v)}
    </div>
  )
}

// Subtotal de grupo, subgrupo ou total: todas as colunas somadas
// onClick/aberto: linha recolhível (grupo ou pavimento); a seta mostra o estado
function LinhaTotal({ codigo, nome, t, forte, onClick, aberto }) {
  const w = forte ? 600 : 500
  return (
    <Linha destaque onClick={onClick}>
      <div style={{ fontWeight: w }}>
        {onClick && <span style={{ color: 'var(--text2)', marginRight: 6 }}>{aberto ? '▾' : '▸'}</span>}
        {codigo}
      </div>
      <div style={{ fontWeight: w }}>{nome}</div>
      <div />
      <div style={{ ...dir, fontWeight: w }}>{fmtMoeda(t.custo)}</div>
      <div style={{ ...dir, fontWeight: w }}>{t.custo > 0 ? fmtP((t.agregado / t.custo) * 100) : '—'}</div>
      <div />
      <div style={{ ...dir, fontWeight: w, color: PLAN }}>{fmtMoeda(t.agregado)}</div>
      <div style={{ ...dir, fontWeight: w }}>{fmtMoeda(t.pago)}</div>
      <div style={{ ...dir, fontWeight: w, color: t.contas > 0 ? AMBAR : 'var(--text2)' }}>{fmtMoeda(t.contas)}</div>
      <PercOrcado orcado={t.custo} pago={t.pago} aPagar={t.contas} peso={w} />
      <Estouro agregado={t.agregado} pago={t.pago} aPagar={t.contas} peso={w} />
      <Saldo orcado={t.custo} pago={t.pago} aPagar={t.contas} peso={w} />
    </Linha>
  )
}

function Linha({ children, cabecalho, destaque, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        display: 'grid',
        gridTemplateColumns: COLS,
        gap: 8,
        padding: '7px 0',
        borderBottom: '1px solid var(--border)',
        font: cabecalho ? MONO : "500 12px 'IBM Plex Sans'",
        textTransform: cabecalho ? 'uppercase' : 'none',
        letterSpacing: cabecalho ? '.08em' : 0,
        color: cabecalho ? 'var(--text2)' : 'var(--text)',
        background: destaque ? 'var(--bg3)' : 'transparent',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  )
}

const dir = { textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }

export default function ValorAgregado() {
  const router = useRouter()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [mostrarZerados, setMostrarZerados] = useState(false)
  const [busca, setBusca] = useState('')
  // Grupos ('g3') e pavimentos do grupo 3 ('s3.2') abertos; começa tudo recolhido
  const [abertos, setAbertos] = useState(() => new Set())

  const semana = router.query.semana ? parseInt(router.query.semana, 10) : null
  // Executado nao pago (agregado acima do pago). Nao confundir com o card de
  // contas a pagar, que vem do relatorio do TOTVS. 'a-pagar' e o nome antigo.
  const soAPagar = router.query.filtro === 'nao-pago' || router.query.filtro === 'a-pagar'

  useEffect(() => {
    if (!router.isReady) return
    setDados(null)
    const q = semana ? `semana=${semana}&memoria=1` : 'memoria=1'
    fetch(`/api/dashboard-semanal?${q}`)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.message || 'Falha ao carregar')
        return j
      })
      .then(setDados)
      .catch((e) => setErro(e.message))
  }, [router.isReady, semana])

  const m = dados && dados.memoria_agregado

  const grupos = useMemo(() => {
    if (!m) return []
    const termo = busca.trim().toLowerCase()
    const mapa = new Map()
    const porCodigo = m.parcela_a.por_codigo || {}
    // Pago e a pagar (TOTVS) são por código. O código repetido em várias
    // linhas (o mesmo serviço por pavimento) reparte pelo orçado de cada uma,
    // como no painel semanal: a soma do grupo não muda e cada pavimento fica
    // com a sua parte.
    const orcCod = {}
    const nCod = {}
    const gruposPorPav = new Set([3, 4])
    const vistos = new Set()
    m.parcela_a.itens.forEach((i) => {
      orcCod[i.cod_eap] = (orcCod[i.cod_eap] || 0) + i.custo_total
      nCod[i.cod_eap] = (nCod[i.cod_eap] || 0) + 1
      const k = `${i.grupo}|${i.cod_eap}`
      if (vistos.has(k)) gruposPorPav.add(i.grupo)
      vistos.add(k)
    })
    const fatia = (i) => (orcCod[i.cod_eap] > 0 ? i.custo_total / orcCod[i.cod_eap] : 1 / (nCod[i.cod_eap] || 1))
    const novoTotal = () => ({ custo: 0, agregado: 0, pago: 0, contas: 0 })
    // Subtotal sempre com todos os itens: esconder linha nao pode mudar a soma.
    const somar = (t, i) => {
      t.custo += i.custo_total
      t.agregado += i.agregado
      t.pago += i.pago
      t.contas += i.contas
    }
    const rotuloPav = (p) => {
      const n = String(p || '').match(/^(\d+)º/)
      if (n) return `${n[1]}º pavimento${/plat/i.test(p) ? ' / platibanda' : ''}`
      return p === 'Edifício' ? 'Edifício (geral)' : p || 'Sem pavimento'
    }
    m.parcela_a.itens.forEach((orig) => {
      const pc = porCodigo[orig.cod_eap]
      const f = fatia(orig)
      // Pago e a pagar da linha vêm do servidor (pavimento definido vai para a
      // linha dele); sem eles, reparte pela verba
      const i = {
        ...orig,
        pago: orig.pago_linha != null ? orig.pago_linha : pc ? pc.pago * f : 0,
        contas: orig.a_pagar_linha != null ? orig.a_pagar_linha : pc ? (pc.a_pagar || 0) * f : 0,
      }
      if (!mapa.has(i.grupo))
        mapa.set(i.grupo, { grupo: i.grupo, nome: i.grupo_nome, ...novoTotal(), subs: new Map() })
      const g = mapa.get(i.grupo)
      somar(g, i)
      // Estrutura abre por subgrupo da EAP (3.1 = 1º pav ... 3.7 = 7º pav);
      // alvenaria e os grupos com o mesmo código repetido por pavimento, pelo
      // pavimento do cadastro.
      const sub = i.grupo === 3 ? String(i.cod_eap).match(/^3\.(\d+)\./) : null
      const pav = i.pavimento || 'Sem pavimento'
      const chave = sub ? `3.${sub[1]}` : gruposPorPav.has(i.grupo) ? `${i.grupo}|${pav}` : ''
      if (!g.subs.has(chave))
        g.subs.set(chave, {
          chave,
          codigo: sub ? `3.${sub[1]}` : /^\d+º/.test(pav) ? pav.replace(/\/plat/i, '') : '—',
          rotulo: sub
            ? `${sub[1]}º pavimento${/plat/i.test(i.pavimento || '') ? ' / platibanda' : ''}`
            : chave
              ? rotuloPav(pav)
              : null,
          ...novoTotal(),
          itens: [],
          zerados: 0,
          titulos: 0,
        })
      const s = g.subs.get(chave)
      somar(s, i)
      s.linhas = (s.linhas || 0) + 1
      // Linha de título do orçamento (orçado zero, sem custo e sem agregado):
      // não aparece, mas continua nas somas (onde não altera nada).
      if (i.custo_total <= 0.005 && Math.abs(i.pago + i.contas) <= 0.005 && i.agregado <= 0.005) {
        s.titulos += 1
        return
      }
      const casa =
        !termo ||
        String(i.cod_eap).toLowerCase().includes(termo) ||
        String(i.descricao).toLowerCase().includes(termo) ||
        String(i.pavimento || '').toLowerCase().includes(termo)
      if (!casa) return
      // Compra antecipada tem agregado (custo pago + a pagar, até o orçado)
      // mesmo com o serviço em 0%: não é item não iniciado.
      if (i.perc_fisico > 0 || i.agregado > 0 || mostrarZerados) s.itens.push(i)
      else s.zerados += 1
    })
    return Array.from(mapa.values())
      .sort((a, b) => a.grupo - b.grupo)
      .map((g) => ({
        ...g,
        subs: Array.from(g.subs.values())
          // Pavimento só com linhas de título não aparece
          .filter((x) => !(x.titulos > 0 && x.titulos === x.linhas && x.custo <= 0.005 && Math.abs(x.pago + x.contas) <= 0.005))
          .sort((a, b) => a.chave.localeCompare(b.chave, 'pt-BR', { numeric: true })),
      }))
  }, [m, mostrarZerados, busca])

  if (erro)
    return (
      <div className="page">
        <div className="loading">Erro: {erro}</div>
      </div>
    )
  if (!dados || !m)
    return (
      <div className="page">
        <div className="loading">Montando a memória de cálculo...</div>
      </div>
    )

  // Lista de conferência: um registro por código com executado acima do pago.
  const listaAPagar = (() => {
    const pc = m.parcela_a.por_codigo || {}
    const info = {}
    m.parcela_a.itens.forEach((i) => {
      if (!info[i.cod_eap]) info[i.cod_eap] = { ...i, custo: 0 }
      info[i.cod_eap].custo += i.custo_total
    })
    return Object.keys(pc)
      .filter((c) => pc[c].aguardando > 0.005)
      .map((c) => ({ cod: c, ...pc[c], ...(info[c] || {}), perc: info[c] && info[c].custo > 0 ? (pc[c].agregado / info[c].custo) * 100 : null }))
      .sort((a, b) => b.aguardando - a.aguardando)
  })()

  if (soAPagar) {
    const COLS_P = '80px minmax(0,1fr) 110px 120px 70px 130px 120px 120px 120px'
    const cab = { font: MONO, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text2)' }
    const lin = (extra) => ({
      display: 'grid', gridTemplateColumns: COLS_P, gap: 10, padding: '7px 0',
      borderBottom: '1px solid var(--border)', alignItems: 'center', ...extra,
    })
    const total = listaAPagar.reduce((t, x) => t + x.aguardando, 0)
    return (
      <div className="page">
        <div className="header">
          <div className="header-top">
            <div>
              <div className="obra-eye">
                <a onClick={() => router.push('/semanal')} style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>
                  ← Acompanhamento semanal
                </a>
                {'  ·  '}
                <a
                  onClick={() => router.push(`/valor-agregado?semana=${m.semana}`)}
                  style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}
                >
                  Memória de cálculo completa
                </a>
              </div>
              <div className="obra-nome">Executado não pago</div>
              <div className="obra-info">
                Flats Pampulha · até {s2(m.semana)} ({dmy(m.data_fim)}) · serviço executado cujo custo ainda não foi
                pago (boleto a vencer, parcela, medição do empreiteiro)
              </div>
            </div>
          </div>
        </div>

        <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 18 }}>
          <div className="kpi">
            <div className="kpi-label">Não pago</div>
            <div className="kpi-value" style={{ fontSize: 20, color: AMBAR }}>{fmtMoeda(total)}</div>
            <div className="kpi-sub">Executado − pago, por item em aberto</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Itens</div>
            <div className="kpi-value" style={{ fontSize: 20 }}>{listaAPagar.length}</div>
            <div className="kpi-sub">Com execução acima do pagamento</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Sem nenhum pagamento</div>
            <div className="kpi-value" style={{ fontSize: 20 }}>{listaAPagar.filter((x) => x.pago <= 0.005).length}</div>
            <div className="kpi-sub">
              {fmtMoeda(listaAPagar.filter((x) => x.pago <= 0.005).reduce((t, x) => t + x.aguardando, 0))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Itens executados e não pagos — do maior para o menor</div>
          <div style={lin(cab)}>
            <div>Código</div>
            <div>Serviço</div>
            <div>Regra</div>
            <div style={dir}>Orçado</div>
            <div style={dir}>% exec.</div>
            <div style={dir}>Executado</div>
            <div style={dir}>Pago</div>
            <div style={dir}>Não pago</div>
            <div style={dir}>% pago</div>
          </div>
          {listaAPagar.map((x) => (
            <div key={x.cod} style={lin({ font: "500 12px 'IBM Plex Sans'" })}>
              <div style={{ color: 'var(--text2)' }}>{x.cod}</div>
              <div>{x.descricao}</div>
              <div style={{ color: x.regra === 'medido' ? 'var(--text2)' : PLAN, fontSize: 11 }}>
                {x.regra === 'tempo' ? 'tempo' : x.regra === 'herda' ? `herda ${x.herda_de.join('/')}` : 'medido'}
              </div>
              <div style={dir}>{fmtMoeda(x.custo)}</div>
              <div style={dir}>{fmtP(x.perc)}</div>
              <div style={{ ...dir, color: PLAN }}>{fmtMoeda(x.agregado)}</div>
              <div style={dir}>{fmtMoeda(x.pago)}</div>
              <div style={{ ...dir, color: AMBAR, fontWeight: 600 }}>{fmtMoeda(x.aguardando)}</div>
              <div style={{ ...dir, color: 'var(--text2)' }}>{x.agregado > 0 ? fmtP((x.pago / x.agregado) * 100) : '—'}</div>
            </div>
          ))}
          <div style={lin({ font: "600 12px 'IBM Plex Sans'", background: 'var(--bg3)' })}>
            <div />
            <div>Total</div>
            <div />
            <div />
            <div />
            <div style={{ ...dir, color: PLAN }}>{fmtMoeda(listaAPagar.reduce((t, x) => t + x.agregado, 0))}</div>
            <div style={dir}>{fmtMoeda(listaAPagar.reduce((t, x) => t + x.pago, 0))}</div>
            <div style={{ ...dir, color: AMBAR }}>{fmtMoeda(total)}</div>
            <div />
          </div>
          <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', marginTop: 10, lineHeight: 1.6 }}>
            O valor não pago é estimado pelo orçado do serviço executado. Se o item já foi quitado por um valor menor,
            marque <code>custo_encerrado = true</code> no orçamento: ele sai desta lista e a economia entra no saldo.
            Se o pagamento foi lançado em outro código, o item aparece aqui e o outro aparece pago acima do executado.
          </div>
        </div>
      </div>
    )
  }

  const semanasMedidas = dados.curva.filter((c) => c.semana <= dados.semana_corrente_calendario)
  const difView = m.parcela_a.diferenca_vs_dashboard
  const efeitoRegras = m.parcela_a.view_banco == null ? null : m.parcela_a.soma - m.parcela_a.view_banco
  const naoAchados = (dados.consistencia && dados.consistencia.agregado_pares_nao_encontrados) || []
  const somaB = m.parcela_b.curva
  const custoA = m.parcela_a.itens.reduce((t, i) => t + i.custo_total, 0)

  // Recolher: grupos e pavimentos (grupo 3 e grupos divididos por pavimento). Com busca, tudo aparece aberto
  // para o resultado não ficar escondido num grupo recolhido.
  const chavesRecolhiveis = grupos.flatMap((g) => [
    `g${g.grupo}`,
    ...g.subs.filter((s) => s.rotulo).map((s) => `s${s.chave}`),
  ])
  const todosAbertos = chavesRecolhiveis.every((k) => abertos.has(k))
  const estaAberto = (k) => !!busca.trim() || abertos.has(k)
  const alternar = (k) =>
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(k)) novo.delete(k)
      else novo.add(k)
      return novo
    })

  return (
    <div className="page">
      <div className="header">
        <div className="header-top">
          <div>
            <div className="obra-eye">
              <a
                onClick={() => router.push('/semanal')}
                style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}
              >
                ← Acompanhamento semanal
              </a>
            </div>
            <div className="obra-nome">Memória de cálculo · Valor agregado</div>
            <div className="obra-info">
              Flats Pampulha · até {s2(m.semana)} ({dmy(m.data_fim)}) · serviço executado a preço de orçamento
            </div>
          </div>
          <div className="sel-wrap">
            <div className="sel-lbl">Semana</div>
            <select
              className="periodo"
              value={m.semana}
              onChange={(e) =>
                router.push(`/valor-agregado?semana=${e.target.value}${soAPagar ? '&filtro=nao-pago' : ''}`)
              }
            >
              {semanasMedidas.map((c) => (
                <option key={c.semana} value={c.semana}>
                  {s2(c.semana)} · até {dmy(c.data_fim)}
                  {c.semana === dados.ultima_semana_com_avanco ? ' · última medição' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div
        className="kpi-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: 18 }}
      >
        <div className="kpi">
          <div className="kpi-label">Produção · grupos 1–16</div>
          <div className="kpi-value" style={{ fontSize: 20, color: PLAN }}>{fmtMoeda(m.parcela_a.soma)}</div>
          <div className="kpi-sub">% medido × custo do item</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Locação · grupo 17</div>
          <div className="kpi-value" style={{ fontSize: 20, color: PLAN }}>{fmtMoeda(somaB)}</div>
          <div className="kpi-sub">Gasto, limitado ao orçado</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Funcionários · grupo 18</div>
          <div className="kpi-value" style={{ fontSize: 20, color: PLAN }}>{fmtMoeda(m.parcela_c.agregado)}</div>
          <div className="kpi-sub">Tempo decorrido</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Valor agregado total</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{fmtMoeda(m.total)}</div>
          <div className="kpi-sub">Produção + locação + funcionários</div>
        </div>
      </div>

      {((difView != null && Math.abs(difView) > 1) || naoAchados.length > 0) && (
        <div className="card" style={{ borderColor: VERMELHO }}>
          <div style={{ font: "500 12px 'IBM Plex Sans'", color: VERMELHO, lineHeight: 1.6 }}>
            {difView != null && Math.abs(difView) > 1 && (
              <div>
                A soma dos itens ({fmtMoeda(m.parcela_a.soma)}) não bate com o card do dashboard (
                {fmtMoeda(m.parcela_a.dashboard)}): diferença de {fmtMoeda(difView)}.
              </div>
            )}
            {naoAchados.length > 0 && (
              <div>
                Item de referência não encontrado no orçamento: {naoAchados.join('; ')}. Esses itens seguem pela
                própria medição até o código ser corrigido em AGREGADO_HERDA.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Produção — item a item</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar código, serviço ou pavimento"
            style={{ maxWidth: 320 }}
          />
          <button className="btn-sm" onClick={() => setAbertos(todosAbertos ? new Set() : new Set(chavesRecolhiveis))}>
            {todosAbertos ? 'Recolher todos' : 'Abrir todos'}
          </button>
          <button className="btn-sm" onClick={() => setMostrarZerados((v) => !v)}>
            {mostrarZerados ? 'Ocultar itens não iniciados' : 'Mostrar itens não iniciados'}
          </button>
          <span style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)' }}>
            Valor agregado = custo do item × % físico · <i>tempo</i>: verba mensal, linear pela obra ·{' '}
            <i>herda</i>: material sem medição, usa o % do serviço · <i>compra antecipada</i>: aço e material de
            forma comprados antes da execução, agregado = custo pago + a pagar até o orçado · <i>a pagar</i>: contas a
            pagar do último fechamento (TOTVS) · estouro / economia = (pago + a pagar) − valor agregado · saldo da
            verba = orçado − pago − a pagar · % orç. = (pago + a pagar) ÷ orçado
            {efeitoRegras != null && Math.abs(efeitoRegras) > 1
              ? ` · regras mudam ${fmtMoeda(efeitoRegras)} em relação à view do banco`
              : ''}
          </span>
        </div>

        <Linha cabecalho>
          <div>Código</div>
          <div>Serviço</div>
          <div>Pav.</div>
          <div style={dir}>Orçado</div>
          <div style={dir}>% físico</div>
          <div style={dir}>Medido</div>
          <div style={dir}>Valor agregado</div>
          <div style={dir}>Pago</div>
          <div style={dir} title="Contas a pagar do último fechamento (TOTVS), a mesma base do IPC">A pagar</div>
          <div style={dir} title="(Pago + a pagar) ÷ orçado. Vermelho acima de 100%">% orç.</div>
          <div style={dir} title="(Pago + a pagar) − valor agregado. Positivo = estouro (vermelho), negativo = economia (verde); o % é sobre o valor agregado">
            Estouro / economia
          </div>
          <div style={dir} title="Orçado − pago − a pagar. Vermelho: verba estourada">Saldo da verba</div>
        </Linha>

        {grupos.map((g) => (
          <div key={g.grupo}>
            <LinhaTotal
              codigo={g.grupo}
              nome={g.nome}
              t={g}
              forte
              onClick={() => alternar(`g${g.grupo}`)}
              aberto={estaAberto(`g${g.grupo}`)}
            />
            {estaAberto(`g${g.grupo}`) && g.subs.map((s) => (
              <div key={s.chave || 'geral'}>
                {s.rotulo && (
                  <LinhaTotal
                    codigo={s.codigo}
                    nome={s.rotulo}
                    t={s}
                    onClick={() => alternar(`s${s.chave}`)}
                    aberto={estaAberto(`s${s.chave}`)}
                  />
                )}
                {(!s.rotulo || estaAberto(`s${s.chave}`)) && s.itens.map((i, k) => (
                  <Linha key={`${i.cod_eap}-${i.pavimento || ''}-${k}`}>
                    <div style={{ color: 'var(--text2)' }}>{i.cod_eap}</div>
                    <div>{i.descricao}</div>
                    <div style={{ color: 'var(--text2)' }}>{i.pavimento || '—'}</div>
                    <div style={dir}>{fmtMoeda(i.custo_total)}</div>
                    <div style={dir}>{fmtP(i.perc_fisico)}</div>
                    <div
                      style={{ ...dir, color: i.regra === 'medido' && !i.material_comprado ? 'var(--text2)' : PLAN }}
                      title={
                        i.material_comprado
                          ? `Compra antecipada (material comprado antes da execução): agregado = custo pago + a pagar, até o orçado` +
                            (i.perc_orcado != null ? ` (${fmtP(i.perc_orcado)} do orçado)` : '') +
                            `. O serviço está em ${fmtP(i.perc_fisico)}.`
                          : i.regra === 'tempo'
                            ? 'Verba mensal: linear pela duração da obra'
                            : i.regra === 'herda'
                              ? `Usa o % de ${i.herda_de.join(', ')}, ponderado pelo custo` +
                                (i.material ? '; ou o custo pago + a pagar até o orçado, se for maior' : '')
                              : ''
                      }
                    >
                      {i.material_comprado
                        ? 'compra antecipada'
                        : i.regra === 'tempo'
                          ? 'tempo'
                          : i.regra === 'herda'
                            ? `herda ${i.herda_de.join('/')}`
                            : i.medido_na_semana
                              ? s2(i.medido_na_semana)
                              : '—'}
                    </div>
                    <div style={{ ...dir, color: i.agregado > 0 ? PLAN : 'var(--text2)' }}>
                      {fmtMoeda(i.agregado)}
                    </div>
                    {(() => {
                      // Pago e a pagar da linha: o código repetido por pavimento reparte pelo orçado
                      const estouro = i.pago > i.agregado + 0.005 && i.agregado > 0
                      return (
                        <>
                          <div style={{ ...dir, color: estouro ? VERMELHO : 'var(--text)' }} title={estouro ? 'Pago acima do executado' : ''}>
                            {fmtMoeda(i.pago)}
                          </div>
                          <div style={{ ...dir, color: i.contas > 0.005 ? AMBAR : 'var(--text2)' }}>
                            {i.contas > 0.005 ? fmtMoeda(i.contas) : '—'}
                          </div>
                          <PercOrcado orcado={i.custo_total} pago={i.pago} aPagar={i.contas} />
                          <Estouro
                            agregado={i.agregado}
                            pago={i.pago}
                            aPagar={i.contas}
                            antecipada={i.material_comprado}
                            orcado={i.custo_total}
                          />
                          <Saldo orcado={i.custo_total} pago={i.pago} aPagar={i.contas} />
                        </>
                      )
                    })()}
                  </Linha>
                ))}
                {(!s.rotulo || estaAberto(`s${s.chave}`)) && s.zerados > 0 && (
                  <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', padding: '6px 0 10px 100px' }}>
                    {s.zerados} {s.zerados === 1 ? 'item não iniciado' : 'itens não iniciados'} (0%)
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <LinhaTotal
          codigo=""
          nome="Total da produção"
          forte
          t={{
            custo: custoA,
            agregado: m.parcela_a.soma,
            pago: Object.values(m.parcela_a.por_codigo || {}).reduce((t, x) => t + x.pago, 0),
            contas: Object.values(m.parcela_a.por_codigo || {}).reduce((t, x) => t + (x.a_pagar || 0), 0),
          }}
        />
        <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', marginTop: 10, lineHeight: 1.6 }}>
          <b>A pagar</b> = contas a pagar do último fechamento (relatório do TOTVS), a mesma base do IPC.{' '}
          <b>Estouro / economia</b> = (pago + a pagar) − valor agregado: positivo (vermelho) custou mais que o orçado
          pelo que foi executado, negativo (verde) custou menos; o % é sobre o valor agregado e a eficiência aparece
          ao passar o mouse. <b>Saldo da verba</b> = orçado − pago − a pagar; em vermelho, verba estourada. Pago em
          vermelho: pago acima do executado.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Locação — gasto até a semana, limitado ao orçado</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '90px minmax(0,1fr) 140px 140px 140px',
            gap: 10,
            padding: '7px 0',
            borderBottom: '1px solid var(--border)',
            font: MONO,
            textTransform: 'uppercase',
            letterSpacing: '.08em',
            color: 'var(--text2)',
          }}
        >
          <div>Código</div>
          <div>Item</div>
          <div style={dir}>Orçado</div>
          <div style={dir}>Gasto</div>
          <div style={dir}>Valor agregado</div>
        </div>
        {m.parcela_b.itens.map((i) => (
          <div
            key={i.cod_eap}
            style={{
              display: 'grid',
              gridTemplateColumns: '90px minmax(0,1fr) 140px 140px 140px',
              gap: 10,
              padding: '7px 0',
              borderBottom: '1px solid var(--border)',
              font: "500 12px 'IBM Plex Sans'",
            }}
          >
            <div style={{ color: 'var(--text2)' }}>{i.cod_eap}</div>
            <div>{i.descricao}</div>
            <div style={dir}>{fmtMoeda(i.teto)}</div>
            <div style={{ ...dir, color: i.incorrido > i.teto ? VERMELHO : 'var(--text)' }}>{fmtMoeda(i.incorrido)}</div>
            <div style={{ ...dir, color: PLAN }}>{fmtMoeda(i.agregado)}</div>
          </div>
        ))}
        <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', marginTop: 10 }}>
          Locação não tem medição física: o que foi gasto conta como executado, até o limite do orçado de cada item.
          Gasto acima do orçado (em vermelho) não vira valor agregado e aparece como estouro no saldo.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Funcionários — tempo decorrido</div>
        <div style={{ font: "500 13px 'IBM Plex Sans'", color: 'var(--text)', lineHeight: 1.7 }}>
          Orçado para a obra toda: <b>{fmtMoeda(m.parcela_c.orcado)}</b>
          <br />
          Planejado pela curva até {s2(m.semana)}: <b style={{ color: PLAN }}>{fmtMoeda(m.parcela_c.agregado)}</b>
        </div>
        <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', marginTop: 10 }}>
          A equipe própria é paga pelo tempo de obra, não por serviço. O valor agregado é o previsto para o período;
          a comparação com a folha real fica no saldo.
        </div>
      </div>
    </div>
  )
}
