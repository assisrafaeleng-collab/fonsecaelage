const fs = require('fs');
let c = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// 1. Adicionar state evmAberto - inserir junto aos outros useState do Dashboard
if (!c.includes('evmAberto')) {
  c = c.replace(
    'const [erro, setErro] = useState(null)',
    'const [erro, setErro] = useState(null)\n  const [evmAberto, setEvmAberto] = useState(false)'
  );
}

// 2. Trocar o title do EVM por header clicável, e envolver conteúdo em condicional {evmAberto && (...)}
// Card do EVM começa em: <div className="card">\n        <div className="card-title">📐 Análise EVM — Valor Agregado</div>
// e termina antes do próximo card. Vou transformar o title em botão e cortar o conteúdo com evmAberto &&

// Encontrar o começo do card EVM
const marker1 = '<div className="card-title">📐 Análise EVM — Valor Agregado</div>';
const novo1 = `<div className="card-title" onClick={() => setEvmAberto(o => !o)} style={{cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', userSelect:'none'}}>
          <span>📐 Análise EVM — Valor Agregado</span>
          <span style={{fontSize:12, color:'#6d675e'}}>{evmAberto ? '▲' : '▼'}</span>
        </div>
        {evmAberto && (<>`;

if (c.includes(marker1)) {
  c = c.replace(marker1, novo1);
  console.log('Header EVM: OK');
} else {
  console.log('FAIL header EVM');
}

// 3. Fechar o fragment antes do próximo card - encontrar o próximo <div className="card"> após o EVM
// O EVM tem 3 grids internos. O último fecha com </div>\n      </div>\n\n      <div className="card">\n        <div className="card-title">📊 Curva S
// Vou procurar por "📊 Curva S" e adicionar </>) antes do card dele
const marker2 = '<div className="card">\r\n        <div className="card-title">📊 Curva S';
const novo2 = '</>)}\r\n      </div>\r\n\r\n      <div className="card">\r\n        <div className="card-title">📊 Curva S';

if (c.includes(marker2)) {
  c = c.replace(marker2, novo2);
  console.log('Fechamento fragment: OK');
} else {
  // Tentar sem \r
  const marker2b = '<div className="card">\n        <div className="card-title">📊 Curva S';
  const novo2b = '</>)}\n      </div>\n\n      <div className="card">\n        <div className="card-title">📊 Curva S';
  if (c.includes(marker2b)) {
    c = c.replace(marker2b, novo2b);
    console.log('Fechamento fragment (LF): OK');
  } else {
    console.log('FAIL fechamento');
  }
}

// Remover o </div> extra que sobra do card EVM (já fechei antes com </>)}\n</div>)
// Na verdade preciso confirmar quantas </div> tem entre o final do EVM e o Curva S — vou inspecionar

fs.writeFileSync('components/Dashboard.jsx', c);

const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
console.log('evmAberto state:', check.includes('const [evmAberto') ? 'OK' : 'FAIL');
console.log('onClick no title:', check.includes('onClick={() => setEvmAberto') ? 'OK' : 'FAIL');
console.log('evmAberto && (<>:', check.includes('{evmAberto && (<>') ? 'OK' : 'FAIL');
console.log('</>)}:', check.includes('</>)}') ? 'OK' : 'FAIL');
