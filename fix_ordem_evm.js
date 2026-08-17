const fs = require('fs');
let c = fs.readFileSync('components/Dashboard.jsx', 'utf8');

// Trocar a ordem: </div>\n</div>\n\n</>)} vira </div>\n</>)}\n</div>
const oldPattern = `          </div>
        </div>
      </div>

      </>)}

      <div className="card">
        <div className="card-title">📊 Curva S`;

const newPattern = `          </div>
        </div>
        </>)}
      </div>

      <div className="card">
        <div className="card-title">📊 Curva S`;

if (c.includes(oldPattern)) {
  c = c.replace(oldPattern, newPattern);
  console.log('Padrao LF: OK');
} else {
  // Tentar CRLF
  const oldCRLF = oldPattern.replace(/\n/g, '\r\n');
  const newCRLF = newPattern.replace(/\n/g, '\r\n');
  if (c.includes(oldCRLF)) {
    c = c.replace(oldCRLF, newCRLF);
    console.log('Padrao CRLF: OK');
  } else {
    console.log('FAIL - vou tentar por linhas');
    // Fallback: reorder line by line
    let lines = c.split('\n');
    // Achar a linha com </>)}
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '</>)}') {
        // A linha anterior era vazia? Se sim, i-2 era </div> do card
        // Vamos apagar essa linha e reinseri-la ANTES do último </div>
        // Ver contexto
        console.log('Linha </>)}:', i+1);
        console.log('Linha ' + (i-2) + ':', lines[i-2]);
        console.log('Linha ' + (i-1) + ':', lines[i-1]);
        console.log('Linha ' + i + ':', lines[i]);
        // Se linha i-2 é </div> (card), mover </>)} para antes dela
        if (lines[i-2] && lines[i-2].trim() === '</div>' && lines[i-1].trim() === '') {
          const closingTag = lines[i];
          // Remove </>)} e linha em branco antes
          lines.splice(i-1, 2);  // remove i-1 (blank) e i (</>)}) 
          // Insere </>)} antes do </div> do card (que agora está em i-2)
          lines.splice(i-2, 0, closingTag);
          console.log('Reordenado: OK');
          break;
        }
      }
    }
    c = lines.join('\n');
  }
}

fs.writeFileSync('components/Dashboard.jsx', c);

// Mostrar o resultado ao redor da linha
const check = fs.readFileSync('components/Dashboard.jsx', 'utf8');
const lines = check.split('\n');
for (let i = 315; i < 335 && i < lines.length; i++) {
  console.log((i+1) + ': ' + lines[i]);
}
