// pages/index.js
// Dashboard Principal - Flats Pampulha
// Exibe KPIs, Curva S Financeira e Distribuição por Fase

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const C = {
  black: '#1A1A1A',
  dark: '#2C2C2C',
  accent: '#8B6F47',
  bg: '#F5F2EC',
  white: '#FFFFFF',
  border: '#C8C3B8',
  green: '#3A6B1A',
  greenBg: '#D4E4C2',
  amber: '#F5E4C0',
  red: '#8B2020'
};

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [curvaS, setCurvaS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Buscar KPIs
      const resKpis = await fetch('/api/kpis');
      if (!resKpis.ok) throw new Error('Erro ao buscar KPIs');
      const dataKpis = await resKpis.json();
      setKpis(dataKpis);

      // Buscar Curva S
      const resCurva = await fetch('/api/curva-s');
      if (!resCurva.ok) throw new Error('Erro ao buscar Curva S');
      const dataCurva = await resCurva.json();
      setCurvaS(dataCurva);

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: C.bg 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontSize: '18px', 
            color: C.accent, 
            fontWeight: 600 
          }}>
            Carregando dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: C.bg 
      }}>
        <div style={{ 
          padding: '32px', 
          background: C.white, 
          borderRadius: '8px',
          border: `1px solid ${C.border}` 
        }}>
          <div style={{ 
            fontSize: '16px', 
            color: C.red, 
            marginBottom: '12px' 
          }}>
            ⚠️ Erro ao carregar dados
          </div>
          <div style={{ fontSize: '14px', color: C.dark }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { size: 12, family: 'Inter, system-ui, sans-serif' },
          padding: 16,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: C.dark,
        padding: 12,
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
        callbacks: {
          label: function(context) {
            return context.dataset.label + ': R$ ' + 
              context.parsed.y.toLocaleString('pt-BR', { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2 
              });
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
          },
          font: { size: 11 }
        },
        grid: { color: C.border }
      },
      x: {
        ticks: { font: { size: 11 } },
        grid: { display: false }
      }
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: C.bg,
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Header */}
      <div style={{ 
        background: C.black, 
        color: C.white, 
        padding: '24px 32px',
        borderBottom: `4px solid ${C.accent}`
      }}>
        <div style={{ 
          fontSize: '28px', 
          fontWeight: 700, 
          marginBottom: '4px' 
        }}>
          Flats Pampulha — Dashboard de Controle
        </div>
        <div style={{ 
          fontSize: '14px', 
          color: '#A8A8A8',
          fontStyle: 'italic' 
        }}>
          Edifício Cel. José Dias Bicalho  ·  Fonseca & Lage
        </div>
      </div>

      <div style={{ padding: '32px' }}>
        {/* KPIs Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          <KPICard
            title="Orçamento Total"
            value={formatCurrency(kpis.kpis.orcamento_total)}
            subtitle="Baseline do projeto"
            color={C.accent}
          />
          <KPICard
            title="Realizado até Agora"
            value={formatCurrency(kpis.kpis.realizado_total)}
            subtitle={`${((kpis.kpis.realizado_total / kpis.kpis.orcamento_total) * 100).toFixed(1)}% executado`}
            color={C.green}
          />
          <KPICard
            title="Desvio Orçamentário"
            value={formatCurrency(Math.abs(kpis.kpis.desvio_financeiro))}
            subtitle={`${kpis.kpis.desvio_financeiro_pct?.toFixed(1)}% ${kpis.kpis.desvio_financeiro > 0 ? 'acima' : 'abaixo'}`}
            color={kpis.kpis.desvio_financeiro > 0 ? C.red : C.green}
          />
          <KPICard
            title="Saldo Restante"
            value={formatCurrency(kpis.kpis.saldo_restante)}
            subtitle={`${kpis.kpis.saldo_restante_pct?.toFixed(1)}% do orçamento`}
            color={C.dark}
          />
        </div>

        {/* Curva S Financeira */}
        <div style={{ 
          background: C.white, 
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          border: `1px solid ${C.border}`
        }}>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 600, 
            color: C.black,
            marginBottom: '20px' 
          }}>
            📈 Curva S Financeira — Planejado vs Realizado
          </div>
          <div style={{ height: '400px' }}>
            {curvaS && <Line data={curvaS} options={chartOptions} />}
          </div>
          <div style={{ 
            marginTop: '16px', 
            fontSize: '13px', 
            color: C.dark,
            fontStyle: 'italic' 
          }}>
            Acumulado mensal: linha bronze = orçado, linha verde = gasto real
          </div>
        </div>

        {/* Distribuição por Fase */}
        <div style={{ 
          background: C.white, 
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          border: `1px solid ${C.border}`
        }}>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 600, 
            color: C.black,
            marginBottom: '20px' 
          }}>
            📊 Distribuição por Fase da Obra
          </div>
          
          {kpis.por_fase.slice(0, 8).map((fase, idx) => (
            <div key={idx} style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '6px',
                fontSize: '13px',
                color: C.dark
              }}>
                <span style={{ fontWeight: 600 }}>
                  Fase {fase.fase}
                </span>
                <span>
                  {formatCurrency(fase.realizado)} / {formatCurrency(fase.planejado)}
                  <span style={{ 
                    marginLeft: '8px', 
                    color: C.accent,
                    fontWeight: 600 
                  }}>
                    {fase.percentual_exec}%
                  </span>
                </span>
              </div>
              <div style={{ 
                background: C.bg, 
                borderRadius: '6px',
                height: '10px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{ 
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  height: '100%',
                  width: `${Math.min(parseFloat(fase.percentual_exec), 100)}%`,
                  background: parseFloat(fase.percentual_exec) > 100 ? C.red : C.accent,
                  borderRadius: '6px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Link para Custos */}
        <div style={{ textAlign: 'center' }}>
          <a 
            href="/custos"
            style={{ 
              display: 'inline-block',
              background: C.accent,
              color: C.white,
              padding: '14px 32px',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseOver={(e) => e.target.style.background = C.dark}
            onMouseOut={(e) => e.target.style.background = C.accent}
          >
            → Ver Módulo de Custos Detalhado
          </a>
        </div>
      </div>
    </div>
  );
}

// Componente KPI Card
function KPICard({ title, value, subtitle, color }) {
  return (
    <div style={{ 
      background: C.white, 
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${C.border}`,
      borderTop: `4px solid ${color}`
    }}>
      <div style={{ 
        fontSize: '12px', 
        color: C.dark,
        marginBottom: '8px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {title}
      </div>
      <div style={{ 
        fontSize: '26px', 
        fontWeight: 700,
        color: color,
        marginBottom: '4px'
      }}>
        {value}
      </div>
      <div style={{ 
        fontSize: '13px', 
        color: C.dark,
        fontStyle: 'italic'
      }}>
        {subtitle}
      </div>
    </div>
  );
}

// Helper function
function formatCurrency(value) {
  if (!value) return 'R$ 0,00';
  return 'R$ ' + parseFloat(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
