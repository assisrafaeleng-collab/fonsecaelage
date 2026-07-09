// ============================================================
// TRECHOS REACT PRONTOS — para colar em components/Dashboard.jsx
// Usam as variáveis que JÁ existem no componente e as funções
// fmtMoeda / fmtPerc já importadas/definidas. Nada de números fixos.
// O CSS correspondente (.alert-strip, .hero) já está no globals.css.
// ============================================================

// ------------------------------------------------------------
// 1) FAIXA DE ALERTA
// Cole logo no início do JSX retornado por Dashboard(), como
// PRIMEIRO filho do <div> raiz (antes do primeiro <div className="kpi-grid">).
//
// Variáveis usadas (todas já existem no componente):
//   avancoFisicoReal, avancoFisicoPlano, saldoCustoDireto,
//   projecaoCustoFinal, kpis.orcamento_total, kpis.desvio_prazo_dias
// ------------------------------------------------------------

{(() => {
  const desvioFisico   = avancoFisicoReal - avancoFisicoPlano;        // negativo = atrasado
  const custoAcima     = saldoCustoDireto < 0;
  const prazoAtrasado  = (kpis.desvio_prazo_dias || 0) > 0;
  const fisicoAtrasado = desvioFisico < 0;
  const estouro        = projecaoCustoFinal - (kpis.orcamento_total || 0);
  const temAlerta      = custoAcima || prazoAtrasado || fisicoAtrasado || estouro > 0;

  return (
    <div className={`alert-strip${temAlerta ? '' : ' ok'}`}>
      <div className="alert-main">
        <div className="alert-title">
          {temAlerta ? 'Atenção necessária' : 'Obra dentro do previsto'}
        </div>
        <div className="alert-text">
          {temAlerta ? (
            <>
              A obra está{' '}
              <b>{fisicoAtrasado
                ? `atrasada em ${fmtPerc(Math.abs(desvioFisico))}`
                : `adiantada em ${fmtPerc(Math.abs(desvioFisico))}`} no físico</b>
              {custoAcima && <> e <b>acima do custo direto</b></>}.
              {estouro > 0 && <> Projeção aponta estouro de {fmtMoeda(estouro)} se o ritmo atual se mantiver.</>}
            </>
          ) : (
            <>Custo, prazo e avanço físico dentro das metas planejadas até este período.</>
          )}
        </div>
      </div>
      <div className="alert-pills">
        <span className={`alert-pill${custoAcima ? '' : ' ok'}`}>
          ● Custo {custoAcima ? 'acima' : 'ok'}
        </span>
        <span className={`alert-pill${prazoAtrasado ? '' : ' ok'}`}>
          ● Prazo {prazoAtrasado ? 'atrasado' : 'ok'}
        </span>
        <span className={`alert-pill${fisicoAtrasado ? '' : ' ok'}`}>
          ● Físico {desvioFisico >= 0 ? '+' : ''}{fmtPerc(desvioFisico)}
        </span>
      </div>
    </div>
  );
})()}


// ------------------------------------------------------------
// 2) HERO DE ORÇAMENTO (reorganizado)
// SUBSTITUI o primeiro bloco <div className="kpi-grid"> ... </div>
// (o card "Custo Total da Obra Planejado" com Direto + Indireto = Total).
//
// Variáveis usadas: kpis.custo_direto_total, kpis.custo_indireto_total,
//   projecaoCustoFinal, kpis.orcamento_total
// ------------------------------------------------------------

<div className="hero">
  <div className="hero-block">
    <div className="hero-label">Custo Total da Obra · Planejado</div>
    <div className="hero-row">
      <div>
        <div className="hero-cap">DIRETO</div>
        <div className="hero-num">{fmtMoeda(kpis.custo_direto_total || 0)}</div>
      </div>
      <div className="hero-op">+</div>
      <div>
        <div className="hero-cap">INDIRETO</div>
        <div className="hero-num">{fmtMoeda(kpis.custo_indireto_total || 0)}</div>
      </div>
      <div className="hero-op">=</div>
      <div className="hero-total">
        <div className="hero-cap">TOTAL</div>
        <div className="hero-num">
          {fmtMoeda((kpis.custo_direto_total || 0) + (kpis.custo_indireto_total || 0))}
        </div>
      </div>
    </div>
  </div>

  <div className="hero-div" />

  <div className="hero-side">
    <div className="hero-label">Projeção de Custo Final</div>
    {(() => {
      const acima = projecaoCustoFinal > (kpis.orcamento_total || 0);
      const diff  = Math.abs(projecaoCustoFinal - (kpis.orcamento_total || 0));
      return (
        <>
          <div className="hero-side-num" style={{ color: acima ? '#d6453c' : '#3f9e6c' }}>
            {fmtMoeda(projecaoCustoFinal)}
          </div>
          <div style={{
            font: "500 12px 'IBM Plex Sans'",
            color: acima ? '#d6453c' : '#3f9e6c',
            marginTop: 8
          }}>
            {acima ? '▲' : '▼'} {fmtMoeda(diff)} {acima ? 'acima' : 'abaixo'} do orçamento
          </div>
        </>
      );
    })()}
  </div>
</div>
