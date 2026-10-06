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

const COLS = '80px minmax(0,1fr) 80px 120px 70px 120px 120px 120px 110px'

function Linha({ children, cabecalho, destaque }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: COLS,
        gap: 10,
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
    m.parcela_a.itens.forEach((i) => {
      if (!mapa.has(i.grupo))
        mapa.set(i.grupo, {
          grupo: i.grupo, nome: i.grupo_nome, custo: 0, agregado: 0, pago: 0, aPagar: 0,
          codigos: new Set(), itens: [], zerados: 0,
        })
      const g = mapa.get(i.grupo)
      // Subtotal sempre com todos os itens: esconder linha nao pode mudar a soma.
      g.custo += i.custo_total
      g.agregado += i.agregado
      // Pago e a pagar sao por codigo: conta uma vez so por codigo no grupo.
      const pc = porCodigo[i.cod_eap]
      if (pc && !g.codigos.has(i.cod_eap)) {
        g.codigos.add(i.cod_eap)
        g.pago += pc.pago
        g.aPagar += pc.aguardando
      }
      const casa =
        !termo ||
        String(i.cod_eap).toLowerCase().includes(termo) ||
        String(i.descricao).toLowerCase().includes(termo) ||
        String(i.pavimento || '').toLowerCase().includes(termo)
      if (!casa) return
      if (i.perc_fisico > 0 || mostrarZerados) g.itens.push(i)
      else g.zerados += 1
    })
    return Array.from(mapa.values()).sort((a, b) => a.grupo - b.grupo)
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
          <button className="btn-sm" onClick={() => setMostrarZerados((v) => !v)}>
            {mostrarZerados ? 'Ocultar itens não iniciados' : 'Mostrar itens não iniciados'}
          </button>
          <span style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)' }}>
            Valor agregado = custo do item × % físico · <i>tempo</i>: verba mensal, linear pela obra ·{' '}
            <i>herda</i>: material sem medição, usa o % do serviço
            {efeitoRegras != null && Math.abs(efeitoRegras) > 1
              ? ` · regras mudam ${fmtMoeda(efeitoRegras)} em relação à view do banco`
              : ''}
          </span>
        </div>

        <Linha cabecalho>
          <div>Código</div>
          <div>Serviço</div>
          <div>Pavimento</div>
          <div style={dir}>Custo do item</div>
          <div style={dir}>% físico</div>
          <div style={dir}>Medido</div>
          <div style={dir}>Valor agregado</div>
          <div style={dir}>Pago</div>
          <div style={dir}>Não pago</div>
        </Linha>

        {grupos.map((g) => (
          <div key={g.grupo}>
            <Linha destaque>
              <div style={{ fontWeight: 600 }}>{g.grupo}</div>
              <div style={{ fontWeight: 600 }}>{g.nome}</div>
              <div />
              <div style={{ ...dir, fontWeight: 600 }}>{fmtMoeda(g.custo)}</div>
              <div style={{ ...dir, fontWeight: 600 }}>{g.custo > 0 ? fmtP((g.agregado / g.custo) * 100) : '—'}</div>
              <div />
              <div style={{ ...dir, fontWeight: 600, color: PLAN }}>{fmtMoeda(g.agregado)}</div>
              <div style={{ ...dir, fontWeight: 600 }}>{fmtMoeda(g.pago)}</div>
              <div style={{ ...dir, fontWeight: 600, color: g.aPagar > 0 ? AMBAR : 'var(--text2)' }}>{fmtMoeda(g.aPagar)}</div>
            </Linha>
            {g.itens.map((i, k) => (
              <Linha key={`${i.cod_eap}-${i.pavimento || ''}-${k}`}>
                <div style={{ color: 'var(--text2)' }}>{i.cod_eap}</div>
                <div>{i.descricao}</div>
                <div style={{ color: 'var(--text2)' }}>{i.pavimento || '—'}</div>
                <div style={dir}>{fmtMoeda(i.custo_total)}</div>
                <div style={dir}>{fmtP(i.perc_fisico)}</div>
                <div
                  style={{ ...dir, color: i.regra === 'medido' ? 'var(--text2)' : PLAN }}
                  title={
                    i.regra === 'tempo'
                      ? 'Verba mensal: linear pela duração da obra'
                      : i.regra === 'herda'
                        ? `Usa o % de ${i.herda_de.join(', ')}, ponderado pelo custo`
                        : ''
                  }
                >
                  {i.regra === 'tempo'
                    ? 'tempo'
                    : i.regra === 'herda'
                      ? `herda ${i.herda_de.join('/')}`
                      : i.medido_na_semana
                        ? s2(i.medido_na_semana)
                        : '—'}
                </div>
                <div style={{ ...dir, color: i.agregado > 0 ? PLAN : 'var(--text2)' }}>{fmtMoeda(i.agregado)}</div>
                {(() => {
                  // Varias linhas do mesmo codigo (pavimentos): pago so na primeira.
                  const pc = (m.parcela_a.por_codigo || {})[i.cod_eap]
                  const primeira = g.itens.findIndex((x) => x.cod_eap === i.cod_eap) === k
                  if (!pc || !primeira) return (<><div /><div /></>)
                  const estouro = pc.pago > pc.agregado && pc.agregado > 0
                  return (
                    <>
                      <div style={{ ...dir, color: estouro ? VERMELHO : 'var(--text)' }} title={estouro ? 'Pago acima do executado' : ''}>
                        {fmtMoeda(pc.pago)}
                      </div>
                      <div style={{ ...dir, color: pc.encerrado ? VERDE : pc.aguardando > 0 ? AMBAR : 'var(--text2)' }}>
                        {pc.encerrado ? 'encerrado' : fmtMoeda(pc.aguardando)}
                      </div>
                    </>
                  )
                })()}
              </Linha>
            ))}
            {g.zerados > 0 && (
              <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', padding: '6px 0 10px 100px' }}>
                {g.zerados} {g.zerados === 1 ? 'item não iniciado' : 'itens não iniciados'} (0%)
              </div>
            )}
          </div>
        ))}

        <Linha destaque>
          <div />
          <div style={{ fontWeight: 600 }}>Total da produção</div>
          <div />
          <div style={{ ...dir, fontWeight: 600 }}>{fmtMoeda(custoA)}</div>
          <div style={{ ...dir, fontWeight: 600 }}>{custoA > 0 ? fmtP((m.parcela_a.soma / custoA) * 100) : '—'}</div>
          <div />
          <div style={{ ...dir, fontWeight: 600, color: PLAN }}>{fmtMoeda(m.parcela_a.soma)}</div>
          <div style={{ ...dir, fontWeight: 600 }}>
            {fmtMoeda(Object.values(m.parcela_a.por_codigo || {}).reduce((t, x) => t + x.pago, 0))}
          </div>
          <div style={{ ...dir, fontWeight: 600, color: AMBAR }}>{fmtMoeda(m.parcela_a.aguardando_pagamento)}</div>
        </Linha>
        <div style={{ font: "500 11px 'IBM Plex Sans'", color: 'var(--text2)', marginTop: 10, lineHeight: 1.6 }}>
          <b>Não pago</b> = executado ainda não pago (boleto a vencer, parcela, medição do empreiteiro). No saldo, item
          em aberto entra pelo menor entre executado e pago: mostra estouro, mas não economia. Quando o item estiver
          quitado, marque <code>custo_encerrado = true</code> no orçamento para o saldo usar o executado cheio.
          Pago em vermelho: pago acima do executado.
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
