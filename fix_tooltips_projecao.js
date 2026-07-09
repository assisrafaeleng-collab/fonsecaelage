const fs = require('fs');
let c = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// 1. Adicionar CSS global para os tooltips (uma vez só)
if (!c.includes('.proj-tooltip-wrap')) {
  const cssInject = `
  // CSS para tooltips dos cards de projecao
  if (typeof window !== 'undefined' && !document.getElementById('proj-tooltip-style')) {
    const style = document.createElement('style')
    style.id = 'proj-tooltip-style'
    style.textContent = '.proj-tooltip-wrap { position: relative; } .proj-tooltip-box { display: none; } .proj-tooltip-wrap:hover .proj-tooltip-box { display: block !important; }'
    document.head.appendChild(style)
  }
`;
  // Injetar antes do "export default function Dashboard"
  c = c.replace(
    'export default function Dashboard(',
    cssInject + '\nexport default function Dashboard('
  );
}

// 2. Envolver o card "Projeção de Custo Final" e adicionar tooltip
const cardProjOld = `<div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Projeção de Custo Final</div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>{fmtMoeda(projecaoCustoFinal)}</div>
            <div className="kpi-sub">
              {projecaoCustoFinal > kpis.orcamento_total
                ? <span style={{ color: '#B03030' }}>⚠️ {fmtMoeda(projecaoCustoFinal - kpis.orcamento_total)} acima</span>
                : <span style={{ color: '#4D9B6A' }}>✅ {fmtMoeda(kpis.orcamento_total - projecaoCustoFinal)} abaixo</span>
              }
            </div>
          </div>`;

const cardProjNew = `<div className="proj-tooltip-wrap">
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>
              Projeção de Custo Final <span style={{color:'#e6a338', cursor:'help'}}>ⓘ</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px', cursor:'help' }}>{fmtMoeda(projecaoCustoFinal)}</div>
            <div className="kpi-sub">
              {projecaoCustoFinal > kpis.orcamento_total
                ? <span style={{ color: '#B03030' }}>⚠️ {fmtMoeda(projecaoCustoFinal - kpis.orcamento_total)} acima</span>
                : <span style={{ color: '#4D9B6A' }}>✅ {fmtMoeda(kpis.orcamento_total - projecaoCustoFinal)} abaixo</span>
              }
            </div>
            <div className="proj-tooltip-box" style={{
              position:'absolute', top:'calc(100% + 8px)', left:0, minWidth:280,
              background:'#0f0f11', border:'1px solid #3a3a44', borderRadius:8,
              padding:'12px 14px', fontSize:11, color:'#ece9e4', lineHeight:1.6,
              zIndex:1000, boxShadow:'0 8px 20px rgba(0,0,0,0.6)'
            }}>
              <div style={{fontWeight:700, color:'#e6a338', marginBottom:8, fontSize:10, textTransform:'uppercase', letterSpacing:.5}}>Como é calculado</div>
              <div style={{marginBottom:6}}>Projeção da <b>obra completa</b> se a eficiência atual (CPI) se mantiver:</div>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <span style={{color:'#a09a90'}}>EAC Direto (Custo Direto ÷ CPI)</span>
                <span style={{fontWeight:600}}>{fmtMoeda(kpis.eac || 0)}</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <span style={{color:'#a09a90'}}>+ Indiretos totais</span>
                <span style={{fontWeight:600}}>{fmtMoeda((kpis.eac_total || 0) - (kpis.eac || 0) - Math.max(0, ((kpis.eac_total || 0) - (kpis.eac || 0)) - 2483856))}</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <span style={{color:'#a09a90'}}>+ Custo do atraso (cenário realista)</span>
                <span style={{fontWeight:600}}>{fmtMoeda(Math.max(0, ((kpis.eac_total || 0) - (kpis.eac || 0)) - 2483856))}</span>
              </div>
              <div style={{borderTop:'1px solid #3a3a44', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#ece9e4', fontWeight:600}}>= Custo Final Projetado</span>
                <span style={{fontWeight:700, color: projecaoCustoFinal > kpis.orcamento_total ? '#B03030' : '#4D9B6A'}}>{fmtMoeda(projecaoCustoFinal)}</span>
              </div>
            </div>
          </div>`;

if (c.includes(cardProjOld)) {
  c = c.replace(cardProjOld, cardProjNew);
  console.log('Card Projecao: OK');
} else {
  console.log('AVISO: card Projecao nao encontrado exato');
}

// 3. Envolver o card "Desvio Financeiro Acumulado" com tooltip
const cardDesvioOld = `<div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Desvio Financeiro Acumulado</div>`;

const cardDesvioNew = `<div className="proj-tooltip-wrap">
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>
              Desvio Financeiro Acumulado <span style={{color:'#e6a338', cursor:'help'}}>ⓘ</span>
            </div>
            <div className="proj-tooltip-box" style={{
              position:'absolute', top:'calc(100% + 8px)', left:0, minWidth:280,
              background:'#0f0f11', border:'1px solid #3a3a44', borderRadius:8,
              padding:'12px 14px', fontSize:11, color:'#ece9e4', lineHeight:1.6,
              zIndex:1000, boxShadow:'0 8px 20px rgba(0,0,0,0.6)'
            }}>
              <div style={{fontWeight:700, color:'#e6a338', marginBottom:8, fontSize:10, textTransform:'uppercase', letterSpacing:.5}}>Como é calculado</div>
              <div style={{marginBottom:6}}>Diferença entre o gasto real e o previsto até este mês:</div>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <span style={{color:'#a09a90'}}>Custo Direto Planejado</span>
                <span style={{fontWeight:600}}>{fmtMoeda(custoDiretoPlano)}</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <span style={{color:'#a09a90'}}>− Custo Direto Realizado</span>
                <span style={{fontWeight:600}}>{fmtMoeda(kpis.acwp_producao || 0)}</span>
              </div>
              <div style={{borderTop:'1px solid #3a3a44', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#ece9e4', fontWeight:600}}>= Desvio (economia)</span>
                <span style={{fontWeight:700, color: kpis.desvio_financeiro <= 0 ? '#4D9B6A' : '#B03030'}}>{fmtMoeda(desvioFinanceiroValor)}</span>
              </div>
              <div style={{marginTop:8, fontSize:10, color:'#6d675e', fontStyle:'italic'}}>
                ⚠️ Ingênuo: pode incluir atividades não executadas. Para eficiência real, veja CV no EVM.
              </div>
            </div>`;

if (c.includes(cardDesvioOld)) {
  c = c.replace(cardDesvioOld, cardDesvioNew);
  console.log('Card Desvio: OK');
} else {
  console.log('AVISO: card Desvio nao encontrado exato');
}

fs.writeFileSync('components/Dashboard.jsx', c);

const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
console.log('CSS injetado:', check.includes('proj-tooltip-style') ? 'OK' : 'FAIL');
console.log('proj-tooltip-wrap:', (check.match(/proj-tooltip-wrap/g) || []).length + ' ocorrências');
