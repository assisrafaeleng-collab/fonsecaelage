// aplicar_cronograma.js
// Atualiza public/dados.json com os novos períodos do cronograma revisado
const fs = require('fs');

const updates = JSON.parse(fs.readFileSync('updates_cronograma.json', 'utf8'));
let dados = JSON.parse(fs.readFileSync('public/dados.json', 'utf8'));

console.log('Itens antes:', dados.length);

let atualizados = 0;
let naoEncontrados = [];

// Aplicar updates
dados.forEach(item => {
  const key = `${item.i}|${item.p}`;
  if (updates.updates[key]) {
    const u = updates.updates[key];
    if (item.a !== u.a || item.b !== u.b) {
      item.a = u.a;
      item.b = u.b;
      atualizados++;
    }
  }
});

// Remover itens marcados como "NÃO TEM"
const antesRemocao = dados.length;
updates.remover.forEach(key => {
  const [eap, pav] = key.split('|');
  dados = dados.filter(item => !(item.i === eap && item.p === pav));
});
const removidos = antesRemocao - dados.length;

// Verificar se todas as keys do update existem
const dadosKeys = new Set(dados.map(item => `${item.i}|${item.p}`));
Object.keys(updates.updates).forEach(key => {
  if (!dadosKeys.has(key) && !updates.remover.includes(key)) {
    naoEncontrados.push(key);
  }
});

fs.writeFileSync('public/dados.json', JSON.stringify(dados));

console.log('Itens depois:', dados.length);
console.log('Períodos atualizados:', atualizados);
console.log('Itens removidos:', removidos);
if (naoEncontrados.length > 0) {
  console.log('AVISO - keys do Excel não encontradas no dados.json:', naoEncontrados.length);
  naoEncontrados.slice(0, 10).forEach(k => console.log('  ', k));
}
console.log('OK - dados.json atualizado');
