// subir_agosto_2026.js
// Sobe 70 lançamentos de agosto/2026 (M2) + corrige pavimento pelo dados.json
// USO: node subir_agosto_2026.js            -> preview
//      node subir_agosto_2026.js --confirmar -> executa insert + fix pavimento

const fs = require('fs');
const confirmar = process.argv.includes('--confirmar');
const SUPABASE_URL = 'https://nvzmiqtciyxxvzzysazm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Zox4VwSaO8C44uEgGhvh2g_ECltzRGy';

async function main() {
  const lancamentos = JSON.parse(fs.readFileSync('agosto_2026_lancamentos.json', 'utf8'));
  const dados = JSON.parse(fs.readFileSync('public/dados.json', 'utf8'));

  // Map EAP -> pavimento correto do cronograma
  const eapPav = {};
  dados.forEach(r => { if (!eapPav[r.i]) eapPav[r.i] = r.p; });

  console.log(`\n📋 ${lancamentos.length} lançamentos a inserir`);
  console.log(`💰 Valor total: R$ ${lancamentos.reduce((s,l)=>s+l.valor,0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
  console.log(`📅 Competência: 2026-08 (M2)\n`);

  // Preview
  console.log('─── PREVIEW (10 primeiros) ───');
  lancamentos.slice(0,10).forEach((l,i) => {
    const pav = eapPav[l.codigo_eap] || 'Edifício';
    console.log(`${(i+1).toString().padStart(2)}. ${l.codigo_eap.padEnd(9)} | ${l.data_emissao} | R$ ${l.valor.toFixed(2).padStart(11)} | pav:${pav.padEnd(9)} | ${l.fornecedor.substring(0,35)}`);
  });
  if (lancamentos.length > 10) console.log(`   ... e mais ${lancamentos.length - 10} lançamentos`);

  if (!confirmar) {
    console.log('\n⚠️  MODO PREVIEW - nada foi enviado.');
    console.log('    Para confirmar rode:');
    console.log('    node subir_agosto_2026.js --confirmar\n');
    return;
  }

  console.log('\n🚀 Inserindo no Supabase (com pavimento correto)...');
  let sucesso = 0, erro = 0;
  const erros = [];

  for (let i = 0; i < lancamentos.length; i++) {
    const l = { ...lancamentos[i] };
    // Adicionar pavimento antes do POST
    l.pavimento = eapPav[l.codigo_eap] || 'Edifício';

    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/custos_lancamentos`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(l)
      });
      if (resp.ok) {
        sucesso++;
        process.stdout.write(`  ✓ ${i+1}/${lancamentos.length} ${l.codigo_eap} R$ ${l.valor.toFixed(2)} [${l.pavimento}]\n`);
      } else {
        const errText = await resp.text();
        erro++;
        erros.push({ eap: l.codigo_eap, forn: l.fornecedor, err: errText });
        process.stdout.write(`  ✗ ${i+1}/${lancamentos.length} ${l.codigo_eap} FALHOU: ${errText.substring(0,80)}\n`);
      }
    } catch (e) {
      erro++;
      erros.push({ eap: l.codigo_eap, err: e.message });
      process.stdout.write(`  ✗ ${i+1}/${lancamentos.length} EXCEPTION: ${e.message}\n`);
    }
  }

  console.log(`\n═══ RESULTADO ═══`);
  console.log(`✅ Sucesso: ${sucesso}`);
  console.log(`❌ Erros:   ${erro}`);
  if (erros.length > 0) {
    console.log('\nDetalhes dos erros:');
    erros.forEach(e => console.log(`  ${e.eap} | ${e.err.substring(0,150)}`));
  }
}
main();
