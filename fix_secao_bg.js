const fs = require('fs');
let c = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');

// Trocar o background do S.section para var(--bg2) igual aos outros cards
const old = "section: { background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, marginBottom:12, overflow:'hidden' },";
const nova = "section: { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, marginBottom:12, overflow:'hidden' },";

if (c.includes(old)) {
  c = c.replace(old, nova);
  console.log('S.section atualizado: OK');
} else {
  console.log('FAIL section');
}

// Trocar tambem a borda interna do body
const oldBody = "body: { borderTop:'1px solid #2a2a31', padding:'16px 18px' }";
const novaBody = "body: { borderTop:'1px solid var(--border)', padding:'16px 18px' }";
if (c.includes(oldBody)) {
  c = c.replace(oldBody, novaBody);
  console.log('S.body atualizado: OK');
}

// Trocar tambem qualquer outro #17171b no arquivo por var(--bg2), exceto no heatmap
// vamos ser específicos: só nos containers da Secao
fs.writeFileSync('components/PaineisAnalise.jsx', c);
const check = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');
console.log('section com var(--bg2):', check.includes("section: { background:'var(--bg2)'") ? 'OK' : 'FAIL');
