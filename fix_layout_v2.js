const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// 1. Cards do detalhamento recorrente (Serviços Contábeis, IPTU, etc) - dar aparência de card
c = c.replace(
  /style=\{\{display:'flex', justifyContent:'space-between', fontSize:11, color:'#a09a90', padding:'4px 10px', background:'#1a1a20', borderRadius:6\}\}/g,
  "style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text2, #a09a90)', padding:'10px 14px', background:'#17171b', border:'1px solid #2a2a31', borderRadius:8}}"
);

// 2. Aumentar gap entre cards de detalhamento
c = c.replace(
  "gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:8",
  "gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:10"
);

// 3. Cards dos cenários de atraso - padronizar visual
c = c.replace(
  /style=\{\{background:'#1a1a20', borderRadius:10, padding:'12px 14px', borderLeft:'3px solid #C8860A'\}\}/g,
  "style={{background:'#17171b', border:'1px solid #2a2a31', borderRadius:10, padding:'16px 18px', borderLeft:'3px solid #C8860A'}}"
);

// 4. Cards da projeção (Otimista, Realista, Pessimista) - trocar background
c = c.replace(
  /background:'#1a1a20', borderRadius:10, padding:'14px 16px', borderLeft:\\`3px solid \\$\{cen\.cor\}\\`/g,
  "background:'#17171b', border:'1px solid #2a2a31', borderRadius:10, padding:'18px 20px', borderLeft:`3px solid ${cen.cor}`"
);

// Alternativa se o regex acima falhar
if (!c.includes("padding:'18px 20px', borderLeft:`3px solid ${cen.cor}`")) {
  c = c.replace(
    "background:'#1a1a20', borderRadius:10, padding:'14px 16px', borderLeft:`3px solid ${cen.cor}`",
    "background:'#17171b', border:'1px solid #2a2a31', borderRadius:10, padding:'18px 20px', borderLeft:`3px solid ${cen.cor}`"
  );
}

// 5. Aumentar valores do custo recorrente e legibilidade
c = c.replace(
  "<span style={{fontSize:26, fontWeight:700, color:'#e6a338'}}>",
  "<span style={{fontSize:32, fontWeight:700, color:'#e6a338'}}>"
);

// 6. Aumentar valor dos cenários de atraso
c = c.replace(
  /<div style=\{\{fontSize:17, fontWeight:700, color:'#C8860A'\}\}>/g,
  "<div style={{fontSize:22, fontWeight:700, color:'#C8860A'}}>"
);

// 7. Aumentar fonte dos valores nos cenários OTIMISTA/REALISTA/PESSIMISTA
c = c.replace(
  /<div style=\{\{fontSize:20, fontWeight:700, color: cen\.cor, marginBottom:2\}\}>/g,
  "<div style={{fontSize:24, fontWeight:700, color: cen.cor, marginBottom:4}}>"
);

fs.writeFileSync('components/ImpactoAtraso.jsx', c);

// Contar quantas substituições foram feitas
const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
const countHigh = (check.match(/background:'#17171b'/g) || []).length;
console.log("Cards com background #17171b:", countHigh);
console.log("Big font 32:", check.includes("fontSize:32") ? 'OK' : 'FAIL');
console.log("Big font 24 (cenarios):", check.includes("fontSize:24") ? 'OK' : 'FAIL');
console.log("Big font 22:", check.includes("fontSize:22") ? 'OK' : 'FAIL');
