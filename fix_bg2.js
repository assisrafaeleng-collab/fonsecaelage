const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// Trocar background dos sub-cards de #17171b para var(--bg2) que dá contraste
const antes = (c.match(/#17171b/g) || []).length;
c = c.split("background:'#17171b', border:'1px solid #2a2a31'").join("background:'var(--bg2)', border:'1px solid var(--border)'");
const depois = (c.match(/var\(--bg2\)/g) || []).length;

fs.writeFileSync('components/ImpactoAtraso.jsx', c);
console.log('Antes tinha #17171b:', antes);
console.log('Agora com var(--bg2):', depois);
