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

function fmt(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(v, total) {
  if (!total) return '0,00%';
  return (v / total * 100).toFixed(2).replace('.', ',') + '%';
}

export default function CustosIndiretosplanejados() {
  const [mes, setMes] = useState(7);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('maior');
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/custos-indiretos-planejados?mes=${mes}`)
      .then(r => r.json())
      .then(d => { setDados(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [mes]);

  const categorias = dados?.categorias || [];

  const filtradas = categorias
    .filter(c => !busca || c.categoria.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => {
      if (ordem === 'maior') return b.valor_acumulado - a.valor_acumulado;
      if (ordem === 'menor') return a.valor_acumulado - b.valor_acumulado;
      return a.categoria.localeCompare(b.categoria);
    });

  const maxBar = Math.max(...filtradas.map(c => c.valor_acumulado), 1);

  return (
    <>
      <Head><title>Custos Indiretos Planejados — Flats Pampulha</title></Head>
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

        /* Cards */
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

        /* Filtros */
        .filters-box {
          background: #1a1c25; border-radius: 10px; padding: 20px;
          margin-bottom: 20px;
        }
        .filters-title {
          font-size: 12px; text-transform: uppercase; letter-spacing: 1px;
          opacity: .45; margin-bottom: 14px; cursor: pointer;
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
        .filter-group select:focus, .filter-group input:focus {
          border-color: #e09145;
        }
        .filter-group input { min-width: 260px; }

        /* Tabela */
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
        <div className="header-sub">{MESES_LABELS[mes - 1]}</div>
        <Link href="/" legacyBehavior><a className="btn-back">← Voltar ao Dashboard</a></Link>

        {/* Summary Cards */}
        <div className="summary-row">
          <div className="summary-card">
            <div className="sc-label">Total Projeto</div>
            <div className="sc-value">{dados ? fmt(dados.total_projeto) : '—'}</div>
            <div className="sc-sub">24 categorias · 20 meses</div>
          </div>
          <div className="summary-card accent2">
            <div className="sc-label">Programado {MESES_LABELS[mes - 1]?.split(' — ')[0]}</div>
            <div className="sc-value">{dados ? fmt(dados.total_no_mes) : '—'}</div>
            <div className="sc-sub">desembolso no mês</div>
          </div>
          <div className="summary-card accent3">
            <div className="sc-label">Acumulado até {MESES_LABELS[mes - 1]?.split(' — ')[0]}</div>
            <div className="sc-value">{dados ? fmt(dados.total_acumulado) : '—'}</div>
            <div className="sc-sub">{dados?.qtd_categorias || 0} categorias</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filters-box">
          <div className="filters-title">⚙ Filtros e Ordenação</div>
          <div className="filters-row">
            <div className="filter-group">
              <label>Período</label>
              <select value={mes} onChange={e => setMes(Number(e.target.value))}>
                {MESES_LABELS.map((l, i) => (
                  <option key={i} value={i + 1}>{l}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Buscar Categoria</label>
              <input
                type="text"
                placeholder="Digite para filtrar..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Ordenar por</label>
              <select value={ordem} onChange={e => setOrdem(e.target.value)}>
                <option value="maior">Maior acumulado</option>
                <option value="menor">Menor acumulado</option>
                <option value="alfa">A → Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="table-box">
          <div className="table-header">
            Custos Indiretos por Categoria (até {MESES_LABELS[mes - 1]?.split(' — ')[0]})
          </div>

          {loading ? (
            <div className="loading-msg">Carregando...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th className="num">Total Projeto</th>
                  <th className="num">No Mês</th>
                  <th className="num">Acumulado</th>
                  <th className="num">% do Acum.</th>
                  <th className="bar-cell"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c, i) => (
                  <tr key={i}>
                    <td className="cat-name">{c.categoria}</td>
                    <td className="num val-projeto">{fmt(c.valor_total_projeto)}</td>
                    <td className="num val-mes">{c.valor_no_mes > 0 ? fmt(c.valor_no_mes) : '—'}</td>
                    <td className="num val-acum">{fmt(c.valor_acumulado)}</td>
                    <td className="num val-pct">{pct(c.valor_acumulado, dados?.total_acumulado)}</td>
                    <td className="bar-cell">
                      <div className="bar-wrap">
                        <div className="bar-fill" style={{ width: `${(c.valor_acumulado / maxBar) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
