const fs = require('fs');

// ═══════════════════════════════════════════════════════
// 1. AJUSTAR HEATMAP: fundo preto + só verde nas células
// ═══════════════════════════════════════════════════════
let p = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');

// Trocar função cellColor: sempre verde quando > 0
const oldColor = `function cellColor(cell) {
    if (!cell) return 'transparent'
    const { real, plan } = cell
    if (plan === 0 && real === 0) return '#1a1a20'  // futuro
    if (real >= plan - 5) {
      // Em dia ou adiantado: verde com intensidade pelo avanço
      const alpha = 0.15 + (real/100) * 0.55
      return \`rgba(77,155,106,\${alpha})\`
    }
    if (real >= plan * 0.6) return 'rgba(200,134,10,0.45)'  // levemente atrasado
    return 'rgba(176,48,48,0.5)'  // muito atrasado
  }`;

const novaColor = `function cellColor(cell) {
    if (!cell) return 'transparent'
    const { real } = cell
    if (real === 0) return '#1a1a20'  // não executado ainda
    // Verde com intensidade pelo % executado
    const alpha = 0.20 + (real/100) * 0.60
    return \`rgba(77,155,106,\${alpha})\`
  }`;

if (p.includes(oldColor)) {
  p = p.replace(oldColor, novaColor);
  console.log('cellColor atualizado: OK');
} else {
  console.log('FAIL cellColor');
}

fs.writeFileSync('components/PaineisAnalise.jsx', p);

// ═══════════════════════════════════════════════════════
// 2. AJUSTAR DASHBOARD: mover Mapa pra logo depois da Curva S + sempre aberto
// ═══════════════════════════════════════════════════════
let d = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// Vou renderizar o Mapa como um card sempre aberto direto no Dashboard,
// logo após o card da Curva S. Isso significa não usar mais o Painel de Análise
// para o Heatmap. Vou importar o componente Heatmap separado.

// Solução mais simples: envolver o <PaineisAnalise /> com um card antes,
// mas isso mistura. Melhor abordagem: adicionar um novo componente Heatmap
// direto no Dashboard e remover ele do PaineisAnalise.

// Estratégia pragmática: no PaineisAnalise, deixar o Heatmap sempre aberto
// (mesmo dentro de Secao) e mover a chamada de PaineisAnalise pra logo após
// Curva S no Dashboard.

// Passo 2a: no PaineisAnalise, tornar a seção do Heatmap sempre aberta
p = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');
p = p.replace(
  '<Secao titulo="Mapa de Avanço por Pavimento" icone="🏢" defaultOpen={false}>',
  '<Secao titulo="Mapa de Avanço por Pavimento" icone="🏢" defaultOpen={true}>'
);
console.log('Heatmap sempre aberto: ' + (p.includes("titulo=\"Mapa de Avanço por Pavimento\" icone=\"🏢\" defaultOpen={true}") ? 'OK' : 'FAIL'));
fs.writeFileSync('components/PaineisAnalise.jsx', p);

console.log('\n═══ Instrução manual para posição do Mapa ═══');
console.log('Para mover o Mapa pra logo abaixo da Curva S, precisa mover o <PaineisAnalise />');
console.log('para logo após o card Curva S no Dashboard.jsx');
