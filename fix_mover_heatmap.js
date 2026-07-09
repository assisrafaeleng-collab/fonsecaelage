const fs = require('fs');

// 1. Adicionar export nomeado do componente Heatmap no PaineisAnalise
let p = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');

// Trocar "function Heatmap({ mes })" por "export function Heatmap({ mes })"
if (!p.includes('export function Heatmap')) {
  p = p.replace('function Heatmap({ mes })', 'export function Heatmap({ mes })');
  console.log('Heatmap exportado: OK');
}

// 2. Remover a Secao do Heatmap do render principal do PaineisAnalise
const oldSecao = `      <Secao titulo="Mapa de Avanço por Pavimento" icone="🏢" defaultOpen={true}>
        <Heatmap mes={mes} />
      </Secao>`;

if (p.includes(oldSecao)) {
  p = p.replace(oldSecao, '');
  console.log('Secao Heatmap removida de PaineisAnalise: OK');
} else {
  // Tentar sem quebra
  const alt = `<Secao titulo="Mapa de Avanço por Pavimento" icone="🏢" defaultOpen={true}>
        <Heatmap mes={mes} />
      </Secao>`;
  if (p.includes(alt)) {
    p = p.replace(alt, '');
    console.log('Secao Heatmap removida (alt): OK');
  } else {
    console.log('AVISO: Secao Heatmap nao encontrada exato');
  }
}

fs.writeFileSync('components/PaineisAnalise.jsx', p);

// 3. Ajustar Dashboard.jsx: importar Heatmap e adicionar como card após Curva S
let d = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// Trocar import de PaineisAnalise para incluir Heatmap
if (d.includes("import PaineisAnalise from './PaineisAnalise'") && !d.includes('{ Heatmap }')) {
  d = d.replace(
    "import PaineisAnalise from './PaineisAnalise'",
    "import PaineisAnalise, { Heatmap } from './PaineisAnalise'"
  );
  console.log('Import Heatmap adicionado: OK');
}

// Adicionar card do Heatmap logo após o card da Curva S
const curvaCard = `<div className="card">
        <div className="card-title">📊 Curva S — Acompanhamento Físico-Financeiro</div>
        <div style={{ height: '400px', position: 'relative' }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>`;

const novoBloco = curvaCard + `

      <div className="card">
        <div className="card-title">🏢 Mapa de Avanço por Pavimento</div>
        <Heatmap mes={mesLimite} />
      </div>`;

if (d.includes(curvaCard) && !d.includes('🏢 Mapa de Avanço por Pavimento')) {
  d = d.replace(curvaCard, novoBloco);
  console.log('Card Heatmap adicionado apos Curva S: OK');
} else if (d.includes('🏢 Mapa de Avanço por Pavimento')) {
  console.log('Card ja existia: SKIP');
} else {
  console.log('AVISO: bloco Curva S nao bateu, tentando CRLF');
  const curvaCRLF = curvaCard.replace(/\n/g, '\r\n');
  const novoCRLF = novoBloco.replace(/\n/g, '\r\n');
  if (d.includes(curvaCRLF)) {
    d = d.replace(curvaCRLF, novoCRLF);
    console.log('Card Heatmap adicionado (CRLF): OK');
  } else {
    console.log('FAIL bloco Curva S');
  }
}

fs.writeFileSync('components/Dashboard.jsx', d);

const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
console.log('Import Heatmap:', check.includes('{ Heatmap }') ? 'OK' : 'FAIL');
console.log('Card Mapa presente:', check.includes('🏢 Mapa de Avanço por Pavimento') ? 'OK' : 'FAIL');
