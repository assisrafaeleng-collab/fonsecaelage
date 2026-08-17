const fs = require('fs');
let c = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// Remover o </div> extra que vem logo após </>)}
// Padrão atual:
//        </>)}
//       </div>
//
//       <div className="card">
// 
// Deve virar:
//        </>)}
// 
//       <div className="card">

const patternCRLF = '      </>)}\r\n      </div>\r\n\r\n      <div className="card">';
const patternLF = '      </>)}\n      </div>\n\n      <div className="card">';
const novo = '      </>)}\n\n      <div className="card">';

if (c.includes(patternCRLF)) {
  c = c.replace(patternCRLF, novo);
  console.log('Sintaxe corrigida (CRLF)');
} else if (c.includes(patternLF)) {
  c = c.replace(patternLF, novo);
  console.log('Sintaxe corrigida (LF)');
} else {
  console.log('AVISO - padrao nao encontrado, tentando geral');
  // Fallback: procurar </>)}\n<qualquer coisa></div>\n\n<div className="card">
  c = c.replace(/<\/>\)\}[\r\n]+\s*<\/div>[\r\n]+\s*[\r\n]+\s*<div className="card">/g, '</>)}\n\n      <div className="card">');
}

fs.writeFileSync('components/Dashboard.jsx', c);
const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
console.log('</>)} existe:', check.includes('</>)}') ? 'OK' : 'FAIL');
// Contar quantos </div> tem entre EVM e Curva S
const evmIdx = check.indexOf('Análise EVM');
const curvaIdx = check.indexOf('📊 Curva S');
const between = check.substring(evmIdx, curvaIdx);
const divCount = (between.match(/<\/div>/g) || []).length;
console.log('</div> entre EVM e Curva S:', divCount);
