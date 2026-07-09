const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// 1. Renomear os labels e descrições dos cenários
c = c.replace(
  "{ key:'otimista', label:'Otimista (SPI puro)', desc:'mantém eficiência atual', cor:'#4D9B6A', data: C.cen3.otimista },",
  "{ key:'otimista', label:'Se o ritmo atual se mantiver', desc:'projeção pelo SPI atual', cor:'#4D9B6A', data: C.cen3.otimista },"
);
c = c.replace(
  "{ key:'realista', label:'Realista (média)', desc:'ponderado entre planejado e pior caso', cor:'#C8860A', data: C.cen3.realista },",
  "{ key:'realista', label:'Com perda parcial de ritmo', desc:'cenário esperado no miolo da obra', cor:'#C8860A', data: C.cen3.realista },"
);
c = c.replace(
  "{ key:'pessimista', label:'Pessimista (SPI × CPI)', desc:'penaliza prazo e custo juntos', cor:'#B03030', data: C.cen3.pessimista },",
  "{ key:'pessimista', label:'Com imprevistos (retrabalho/clima)', desc:'reserva de segurança máxima', cor:'#B03030', data: C.cen3.pessimista },"
);

// 2. Trocar "atraso" por "margem de risco" no texto dos cards
c = c.replace(
  "{cen.data.atraso > 0.05 ? `+${cen.data.atraso.toFixed(1)}m atraso` : 'no prazo ou adiantado'} · {cen.desc}",
  "{cen.data.atraso > 0.05 ? `+${cen.data.atraso.toFixed(1)}m de margem de risco` : 'dentro do prazo'} · {cen.desc}"
);

// 3. Trocar "Custo do atraso" por "Custo da margem"
c = c.replace(
  /<div style=\{\{fontSize:9, color:'#6d675e'\}\}>Custo do atraso<\/div>/g,
  "<div style={{fontSize:9, color:'#6d675e'}}>Custo da margem de risco</div>"
);

// 4. Adicionar frase de contexto no título da seção de projeção
c = c.replace(
  "🔮 Projeção no ritmo atual (SPI ",
  "🔮 Cenários de risco (SPI atual "
);

fs.writeFileSync('components/ImpactoAtraso.jsx', c);

const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
console.log('label otimista:', check.includes('Se o ritmo atual se mantiver') ? 'OK' : 'FAIL');
console.log('label realista:', check.includes('Com perda parcial de ritmo') ? 'OK' : 'FAIL');
console.log('label pessimista:', check.includes('Com imprevistos') ? 'OK' : 'FAIL');
console.log('margem de risco:', check.includes('margem de risco') ? 'OK' : 'FAIL');
console.log('Cenarios de risco:', check.includes('Cenários de risco') ? 'OK' : 'FAIL');

// 5. Adicionar frase de contexto abaixo do título de cenários
const c2 = require('fs').readFileSync('components/ImpactoAtraso.jsx', 'utf8');
let c3 = c2;
// Inserir aviso após o título da seção de cenários (procura o </div> do título)
const marker = "Cenários de risco (SPI atual "
const idx = c3.indexOf(marker);
if (idx > -1) {
  // Achar o fim dessa div de título
  const fimTitulo = c3.indexOf('</div>', idx) + 6;
  const aviso = `
              <div style={{fontSize:10, color:'#6d675e', fontStyle:'italic', marginBottom:10, marginTop:-4}}>
                SPI inicial alto é comum (obra começa com serviços leves) e não garante o ritmo no miolo da obra. Cenários abaixo são projeções conservadoras de segurança.
              </div>`;
  c3 = c3.slice(0, fimTitulo) + aviso + c3.slice(fimTitulo);
  require('fs').writeFileSync('components/ImpactoAtraso.jsx', c3);
  console.log('Aviso de contexto: OK');
} else {
  console.log('Aviso: marker nao encontrado');
}
