import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const MESES_LABELS = [
  'M1 — jul/2026','M2 — ago/2026','M3 — set/2026','M4 — out/2026',
  'M5 — nov/2026','M6 — dez/2026','M7 — jan/2027','M8 — fev/2027',
  'M9 — mar/2027','M10 — abr/2027','M11 — mai/2027','M12 — jun/2027',
  'M13 — jul/2027','M14 — ago/2027','M15 — set/2027','M16 — out/2027',
  'M17 — nov/2027','M18 — dez/2027','M19 — jan/2028','M20 — fev/2028'
];

const TOTAL_MESES = 20;

function fmt(v) { v=v||0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(v, total) {
  if (!total) return '0,00%';
  return (v / total * 100).toFixed(2).replace('.', ',') + '%';
}

function calcValorNoMes(cat, mes) {
  var md = cat.mes_desembolso;
  if (md === 0) return cat.valor_original / TOTAL_MESES;
  if (md === mes) return cat.valor_original;
  return 0;
}

export default function CustosIndiretosplanejados() {
  var _a = useState(7), mes = _a[0], setMes = _a[1];
  var _b = useState(''), busca = _b[0], setBusca = _b[1];
  var _c = useState('maior'), ordem = _c[0], setOrdem = _c[1];
  var _d = useState(null), dados = _d[0], setDados = _d[1];
  var _e = useState(true), loading = _e[0], setLoading = _e[1];

  useEffect(function() {
    setLoading(true);
    fetch('/api/custos-indiretos-planejados?mes=' + mes)
      .then(function(r) { return r.json(); })
      .then(function(d) { setDados(d); setLoading(false); })
      .catch(function() { setLoading(false); });
  }, [mes]);

  var categorias = (dados && dados.categorias ? dados.categorias : []).map(function(c) {
    return {
      categoria: c.categoria,
      acumulado: c.valor_acumulado,
      totalProjeto: c.valor_total_projeto,
      valorNoMes: c.valor_no_mes,
      mes_desembolso: c.mes_desembolso,
      cod_eap: c.cod_eap
    };
  });

  var totalNoMes = categorias.reduce(function(s, c) { return s + c.valorNoMes; }, 0);

  var filtradas = categorias
    .filter(function(c) { return !busca || c.categoria.toLowerCase().includes(busca.toLowerCase()); })
    .sort(function(a, b) {
      if (ordem === 'maior') return b.acumulado - a.acumulado;
      if (ordem === 'menor') return a.acumulado - b.acumulado;
      return a.categoria.localeCompare(b.categoria);
    });

  var maxBar = 1;
  filtradas.forEach(function(c) { if (c.acumulado > maxBar) maxBar = c.acumulado; });

  var mesLabel = MESES_LABELS[mes - 1] || '';
  var mesShort = mesLabel.split(' — ')[0] || '';

  return (
    <>
      <Head><title>Custos Indiretos Planejados | Flats Pampulha</title></Head>
      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Inter', -apple-system, sans-serif;
          background: #0f1117;
          color: #e2e4e9;
          min-height: 100vh;
        }
        .page-wrap {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 20px 60px;
        }
        .header-meta { opacity: 0.5; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .header-title { font-size: 24px; font-weight: 700; margin: 4px 0 2px; }
        .header-sub { font-size: 14px; opacity: 0.6; }
        .btn-back {
          display: inline-block; margin-top: 12px; padding: 6px 16px;
          border: 1px solid #3a3d45; border-radius: 6px; color: #c0c3ca;
          text-decoration: none; font-size: 13px; transition: .2s;
        }
        .btn-back:hover { border-color: #e09145; color: #e09145; }
        .summary-row {
          display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;
          margin: 28px 0 20px;
        }
        .summary-card {
          background: #1a1c25; border-radius: 10px; padding: 20px;
          border-left: 3px solid #e09145;
        }
        .summary-card.accent2 { border-left-color: #5b9cf6; }
        .summary-card.accent3 { border-left-color: #6ee7a0; }
        .sc-label { font-size: 11px; text-transform: uppercase; letter-spacing: .8px; opacity: .55; margin-bottom: 6px; }
        .sc-value { font-size: 22px; font-weight: 700; color: #f0f1f3; }
        .sc-sub { font-size: 12px; opacity: .45; margin-top: 4px; }
        .filters-box {
          background: #1a1c25; border-radius: 10px; padding: 20px;
          margin-bottom: 20px;
        }
        .filters-title {
          font-size: 12px; text-transform: uppercase; letter-spacing: 1px;
          opacity: .45; margin-bottom: 14px;
        }
        .filters-row { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
        .filter-group label {
          display: block; font-size: 11px; text-transform: uppercase;
          letter-spacing: .6px; opacity: .5; margin-bottom: 4px;
        }
        .filter-group select, .filter-group input {
          background: #12131a; border: 1px solid #2a2d36; border-radius: 6px;
          color: #e2e4e9; padding: 8px 12px; font-size: 14px; outline: none;
        }
        .filter-group select:focus, .filter-group input:focus { border-color: #e09145; }
        .filter-group input { min-width: 260px; }
        .table-box {
          background: #1a1c25; border-radius: 10px; overflow: hidden;
        }
        .table-header {
          padding: 16px 20px; font-size: 13px; font-weight: 600;
          text-transform: uppercase; letter-spacing: .6px; opacity: .7;
          border-bottom: 1px solid #25272f;
        }
        table { width: 100%; border-collapse: collapse; }
        thead th {
          text-align: left; padding: 12px 16px; font-size: 11px;
          text-transform: uppercase; letter-spacing: .6px; opacity: .45;
          border-bottom: 1px solid #25272f; font-weight: 500;
        }
        thead th.num { text-align: right; }
        tbody tr { border-bottom: 1px solid #1f2129; transition: .15s; }
        tbody tr:hover { background: #22242e; }
        tbody td { padding: 14px 16px; font-size: 14px; }
        tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
        tbody td.cat-name { font-weight: 500; max-width: 280px; }
        .val-projeto { color: #8b8e96; font-size: 13px; }
        .val-mes { color: #5b9cf6; font-weight: 600; }
        .val-acum { color: #e09145; font-weight: 600; }
        .val-pct { font-size: 13px; opacity: .65; white-space: nowrap; }
        .bar-cell { width: 120px; }
        .bar-wrap { background: #25272f; border-radius: 3px; height: 6px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 3px; background: #5b9cf6; transition: width .4s; }
        .loading-msg {
          text-align: center; padding: 60px; opacity: .4; font-size: 15px;
        }
        @media (max-width: 900px) {
          .summary-row { grid-template-columns: 1fr; }
          .filters-row { flex-direction: column; }
          .filter-group input { min-width: 100%; }
          table { font-size: 13px; }
          thead th, tbody td { padding: 10px 8px; }
          .bar-cell { display: none; }
        }
      `}</style>

      <div className="page-wrap">
        <div className="header-meta">Custos Indiretos Planejados</div>
        <div className="header-title">Flats Pampulha</div>
        <div className="header-sub">{mesLabel}</div>
        <Link href="/" legacyBehavior><a className="btn-back">&larr; Voltar ao Dashboard</a></Link>

        <div className="summary-row">
          <div className="summary-card">
            <div className="sc-label">Total Projeto</div>
            <div className="sc-value">{dados ? fmt(dados.total_projeto) : '\u2014'}</div>
            <div className="sc-sub">24 categorias &middot; 20 meses</div>
          </div>
          <div className="summary-card accent2">
            <div className="sc-label">{'Programado ' + mesShort}</div>
            <div className="sc-value">{dados ? fmt(totalNoMes) : '\u2014'}</div>
            <div className="sc-sub">desembolso no m&ecirc;s</div>
          </div>
          <div className="summary-card accent3">
            <div className="sc-label">{'Acumulado at\u00e9 ' + mesShort}</div>
            <div className="sc-value">{dados ? fmt(dados.total_acumulado) : '\u2014'}</div>
            <div className="sc-sub">{(dados && dados.qtd_categorias) || 0} categorias</div>
          </div>
        </div>

        <div className="filters-box">
          <div className="filters-title">&#9881; Filtros e Ordena&ccedil;&atilde;o</div>
          <div className="filters-row">
            <div className="filter-group">
              <label>Per&iacute;odo</label>
              <select value={mes} onChange={function(e) { setMes(Number(e.target.value)); }}>
                {MESES_LABELS.map(function(l, i) {
                  return <option key={i} value={i + 1}>{l}</option>;
                })}
              </select>
            </div>
            <div className="filter-group">
              <label>Buscar Categoria</label>
              <input
                type="text"
                placeholder="Digite para filtrar..."
                value={busca}
                onChange={function(e) { setBusca(e.target.value); }}
              />
            </div>
            <div className="filter-group">
              <label>Ordenar por</label>
              <select value={ordem} onChange={function(e) { setOrdem(e.target.value); }}>
                <option value="maior">Maior acumulado</option>
                <option value="menor">Menor acumulado</option>
                <option value="alfa">A &rarr; Z</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-box">
          <div className="table-header">
            {'Custos Indiretos por Categoria (at\u00e9 ' + mesShort + ')'}
          </div>

          {loading ? (
            <div className="loading-msg">Carregando...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th className="num">Total Projeto</th>
                  <th className="num">No M&ecirc;s</th>
                  <th className="num">Acumulado</th>
                  <th className="num">%</th>
                  <th className="bar-cell"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(function(c, i) {
                  return (
                    <tr key={i}>
                      <td className="cat-name">
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                          {c.cod_eap ? (
                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6d675e', marginRight: '8px', minWidth: '52px' }}>
                              {c.cod_eap}
                            </span>
                          ) : null}
                          <span>{c.categoria}</span>
                        </div>
                      </td>
                      <td className="num val-projeto">{fmt(c.totalProjeto)}</td>
                      <td className="num val-mes">{c.valorNoMes > 0 ? fmt(c.valorNoMes) : '\u2014'}</td>
                      <td className="num val-acum">{fmt(c.acumulado)}</td>
                      <td className="num val-pct">{pct(c.acumulado, dados ? dados.total_acumulado : 0)}</td>
                      <td className="bar-cell">
                        <div className="bar-wrap">
                          <div className="bar-fill" style={{ width: ((c.acumulado / maxBar) * 100) + '%' }}></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
