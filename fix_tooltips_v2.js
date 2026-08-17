const fs = require('fs');
let c = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// Normalizar para LF para trabalhar
const originalHasCRLF = c.includes('\r\n');
if (originalHasCRLF) c = c.replace(/\r\n/g, '\n');

// 1. Card "Projeção de Custo Final" - buscar sem CRLF
const p1 = `<div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>Projeção de Custo Final</div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>{fmtMoeda(projecaoCustoFinal)}</div>`;

const p1Novo = `<div className="proj-tooltip-wrap">
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px' }}>
              Projeção de Custo Final <span style={{color:'#e6a338', cursor:'help'}}>ⓘ</span>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px', cursor:'help' }}>{fmtMoeda(projecaoCustoFinal)}</div>
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
                <span style={{color:'#a09a90'}}>+ Indiretos + custo do atraso</span>
                <span style={{fontWeight:600}}>{fmtMoeda((kpis.eac_total || 0) - (kpis.eac || 0))}</span>
              </div>
              <div style={{borderTop:'1px solid #3a3a44', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#ece9e4', fontWeight:600}}>= Custo Final Projetado</span>
                <span style={{fontWeight:700, color: projecaoCustoFinal > kpis.orcamento_total ? '#B03030' : '#4D9B6A'}}>{fmtMoeda(projecaoCustoFinal)}</span>
              </div>
              <div style={{marginTop:8, fontSize:10, color:'#6d675e', fontStyle:'italic'}}>vs Orçamento original: {fmtMoeda(kpis.orcamento_total)}</div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }} data-oculto>{fmtMoeda(projecaoCustoFinal)}</div>`;

// Vou usar uma substituição mais simples: só o wrapper e o tooltip
// Buscar a linha do label "Projeção de Custo Final"
const marker1 = '<div style={{ fontSize: \'11px\', color: \'var(--text2)\', marginBottom: \'8px\' }}>Projeção de Custo Final</div>';
if (c.includes(marker1)) {
  // Substituir o div pai <div> antes por <div className="proj-tooltip-wrap">
  // Achar o padrao "        <div>\n          " logo antes do marker
  const contexto = `        <div>
            ${marker1}`;
  const novoContexto = `        <div className="proj-tooltip-wrap">
            ${marker1.replace('</div>', ' <span style={{color:\'#e6a338\', cursor:\'help\'}}>ⓘ</span></div>')}
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
                <span style={{color:'#a09a90'}}>+ Indiretos + custo do atraso</span>
                <span style={{fontWeight:600}}>{fmtMoeda((kpis.eac_total || 0) - (kpis.eac || 0))}</span>
              </div>
              <div style={{borderTop:'1px solid #3a3a44', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#ece9e4', fontWeight:600}}>= Custo Final Projetado</span>
                <span style={{fontWeight:700, color: projecaoCustoFinal > kpis.orcamento_total ? '#B03030' : '#4D9B6A'}}>{fmtMoeda(projecaoCustoFinal)}</span>
              </div>
              <div style={{marginTop:8, fontSize:10, color:'#6d675e', fontStyle:'italic'}}>vs Orçamento original: {fmtMoeda(kpis.orcamento_total)}</div>
            </div>`;
  if (c.includes(contexto)) {
    c = c.replace(contexto, novoContexto);
    console.log('Card Projeção: OK');
  } else {
    console.log('Contexto Projecao nao bateu');
  }
} else {
  console.log('Label Projeção nao encontrado');
}

// 2. Card "Desvio Financeiro Acumulado"
const marker2 = '<div style={{ fontSize: \'11px\', color: \'var(--text2)\', marginBottom: \'8px\' }}>Desvio Financeiro Acumulado</div>';
if (c.includes(marker2)) {
  const contexto2 = `        <div>
            ${marker2}`;
  const novoContexto2 = `        <div className="proj-tooltip-wrap">
            ${marker2.replace('</div>', ' <span style={{color:\'#e6a338\', cursor:\'help\'}}>ⓘ</span></div>')}
            <div className="proj-tooltip-box" style={{
              position:'absolute', top:'calc(100% + 8px)', left:0, minWidth:280,
              background:'#0f0f11', border:'1px solid #3a3a44', borderRadius:8,
              padding:'12px 14px', fontSize:11, color:'#ece9e4', lineHeight:1.6,
              zIndex:1000, boxShadow:'0 8px 20px rgba(0,0,0,0.6)'
            }}>
              <div style={{fontWeight:700, color:'#e6a338', marginBottom:8, fontSize:10, textTransform:'uppercase', letterSpacing:.5}}>Como é calculado</div>
              <div style={{marginBottom:6}}>Diferença entre gasto previsto e gasto real até este mês:</div>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <span style={{color:'#a09a90'}}>Custo Direto Planejado</span>
                <span style={{fontWeight:600}}>{fmtMoeda(custoDiretoPlano)}</span>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', gap:12}}>
                <span style={{color:'#a09a90'}}>− Custo Direto Realizado</span>
                <span style={{fontWeight:600}}>{fmtMoeda(kpis.acwp_producao || 0)}</span>
              </div>
              <div style={{borderTop:'1px solid #3a3a44', marginTop:6, paddingTop:6, display:'flex', justifyContent:'space-between'}}>
                <span style={{color:'#ece9e4', fontWeight:600}}>= Desvio</span>
                <span style={{fontWeight:700, color: kpis.desvio_financeiro <= 0 ? '#4D9B6A' : '#B03030'}}>{fmtMoeda(desvioFinanceiroValor)}</span>
              </div>
              <div style={{marginTop:8, fontSize:10, color:'#6d675e', fontStyle:'italic'}}>
                ⚠️ Ingênuo: pode incluir atividades não executadas. Para eficiência real, veja CV no EVM.
              </div>
            </div>`;
  if (c.includes(contexto2)) {
    c = c.replace(contexto2, novoContexto2);
    console.log('Card Desvio: OK');
  } else {
    console.log('Contexto Desvio nao bateu');
  }
} else {
  console.log('Label Desvio nao encontrado');
}

// Restaurar CRLF
if (originalHasCRLF) c = c.replace(/\n/g, '\r\n');

fs.writeFileSync('components/Dashboard.jsx', c);

const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
console.log('tooltip-wrap:', (check.match(/proj-tooltip-wrap/g) || []).length + ' ocorrências');
console.log('tooltip-box:', (check.match(/proj-tooltip-box/g) || []).length + ' ocorrências');
