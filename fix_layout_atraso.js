const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// Trocar o container principal para usar a classe 'card' padrão do dashboard
// De: <div style={{background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, marginBottom:12, overflow:'hidden'}}>
// Para: <div className="card" style={{padding:0, overflow:'hidden'}}>

const oldWrap = "<div style={{background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, marginBottom:12, overflow:'hidden'}}>";
const newWrap = "<div className=\"card\" style={{padding:0, overflow:'hidden', marginBottom:16}}>";

if (c.includes(oldWrap)) {
  c = c.replace(oldWrap, newWrap);
  console.log('Wrapper substituido: OK');
} else {
  console.log('FAIL wrapper');
}

// Ajustar o header para usar card-title similar
// Trocar o header interno
const oldHead = "<div\n        style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', cursor:'pointer', userSelect:'none'}}\n        onClick={() => setOpen(o => !o)}\n      >";
const newHead = "<div\n        style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', cursor:'pointer', userSelect:'none', borderBottom: open ? '1px solid var(--border, #2A2A2A)' : 'none'}}\n        onClick={() => setOpen(o => !o)}\n      >";

if (c.includes(oldHead)) {
  c = c.replace(oldHead, newHead);
  console.log('Header substituido: OK');
} else {
  console.log('AVISO: header pattern nao exato - talvez ja alterado');
}

// Ajustar o conteúdo interno (padding maior)
const oldBody = "<div style={{borderTop:'1px solid #2a2a31', padding:'16px 18px'}}>";
const newBody = "<div style={{padding:'20px 24px'}}>";
if (c.includes(oldBody)) {
  c = c.replace(oldBody, newBody);
  console.log('Body substituido: OK');
}

// Aumentar fonte dos títulos internos
c = c.replace(/style=\{\{fontSize:11, color:'#6d675e', textTransform:'uppercase', letterSpacing:\.5, marginBottom:8\}\}/g,
  "style={{fontSize:11, color:'var(--text2, #A8A8A8)', textTransform:'uppercase', letterSpacing:.5, marginBottom:10, fontWeight:600}}");

// Aumentar fonte do título principal (título do painel)
c = c.replace(
  "style={{fontSize:13, fontWeight:600, color:'#ece9e4', display:'flex', alignItems:'center', gap:8}}",
  "style={{fontSize:15, fontWeight:700, color:'var(--text1, #E8E8E8)', display:'flex', alignItems:'center', gap:10}}"
);

fs.writeFileSync('components/ImpactoAtraso.jsx', c);

const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
console.log('className="card":', check.includes('className="card"') ? 'OK' : 'FAIL');
console.log('padding 20px 24px:', check.includes("padding:'20px 24px'") ? 'OK' : 'FAIL');
