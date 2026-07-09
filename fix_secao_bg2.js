const fs = require('fs');
let c = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');

// Trocar var(--bg2) por var(--bg) que é mais escuro
c = c.replace(
  "section: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, marginBottom:12, overflow:'hidden' },",
  "section: { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, marginBottom:12, overflow:'hidden' },"
);

fs.writeFileSync('components/PaineisAnalise.jsx', c);
const check = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');
console.log('section com var(--bg):', check.includes("section: { background:'var(--bg)'") ? 'OK' : 'FAIL');
