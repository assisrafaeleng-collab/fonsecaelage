const fs = require('fs');
let c = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');

// 1. Ajustar o cálculo do recorrenteMensal para incluir Taxa ADM 12%
// Antes: const recorrenteMensal = recIndireto + recDireto
// Depois: adiciona Taxa ADM 12% sobre o subtotal
const old = 'const recorrenteMensal = recIndireto + recDireto';
const nova = `const recorrenteBase = recIndireto + recDireto
    const taxaAdmMensal = recorrenteBase * 0.12
    const recorrenteMensal = recorrenteBase + taxaAdmMensal`;

if (c.includes(old)) {
  c = c.replace(old, nova);
  console.log('Calculo atualizado: OK');
} else {
  console.log('FAIL calculo');
}

// 2. Adicionar Taxa ADM nos detalhes retornados
// Achar onde detalheDir é composto e adicionar taxa
const oldRet = "recorrenteMensal, recIndireto, recDireto, detalheInd, detalheDir,";
const novaRet = "recorrenteMensal, recIndireto, recDireto, detalheInd, detalheDir, taxaAdmMensal, recorrenteBase,";

if (c.includes(oldRet)) {
  c = c.replace(oldRet, novaRet);
  console.log('Return atualizado: OK');
}

// 3. Adicionar linha de Taxa ADM na exibição dos detalhes
// Achar o bloco onde renderiza detalheInd e detalheDir e adicionar mais uma linha depois
const oldDisplay = `{Object.entries(C.detalheDir).map(([nome, mensal], i) => (
                <div key={'d'+i} style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text2, #a09a90)', padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8}}>
                  <span>{nome}</span>
                  <span style={{color:'#ece9e4', fontWeight:600}}>{fmtR(mensal)}/m</span>
                </div>
              ))}`;

const novaDisplay = `{Object.entries(C.detalheDir).map(([nome, mensal], i) => (
                <div key={'d'+i} style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text2, #a09a90)', padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8}}>
                  <span>{nome}</span>
                  <span style={{color:'#ece9e4', fontWeight:600}}>{fmtR(mensal)}/m</span>
                </div>
              ))}
              <div style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text2, #a09a90)', padding:'10px 14px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8}}>
                <span>Taxa ADM (12% sobre recorrentes)</span>
                <span style={{color:'#ece9e4', fontWeight:600}}>{fmtR(C.taxaAdmMensal)}/m</span>
              </div>`;

if (c.includes(oldDisplay)) {
  c = c.replace(oldDisplay, novaDisplay);
  console.log('Display atualizado: OK');
} else {
  console.log('AVISO: display pattern nao encontrado exato');
}

// 4. Já que a Taxa ADM entrou no recorrente, ajustar cenários de risco para NÃO dobrar a Taxa ADM
// Nos cenários, o custoAtr agora é apenas atraso * recorrenteMensal (que já inclui a taxa)
const oldCustoAtr = "const custoAtr = { base: cen.data.atraso * C.recorrenteMensal, taxaAdm: cen.data.atraso * C.recorrenteMensal * 0.12 }";
const novaCustoAtr = "const custoAtr = { base: cen.data.atraso * C.recorrenteBase, taxaAdm: cen.data.atraso * C.recorrenteBase * 0.12 }";

if (c.includes(oldCustoAtr)) {
  c = c.replace(oldCustoAtr, novaCustoAtr);
  console.log('CustoAtr ajustado (usa recorrenteBase): OK');
}

fs.writeFileSync('components/ImpactoAtraso.jsx', c);

const check = fs.readFileSync('components/ImpactoAtraso.jsx', 'utf8');
console.log('taxaAdmMensal:', check.includes('taxaAdmMensal') ? 'OK' : 'FAIL');
console.log('recorrenteBase:', check.includes('recorrenteBase') ? 'OK' : 'FAIL');
