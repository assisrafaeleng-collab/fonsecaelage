// SOMENTE LEITURA (GET, 1 linha) com uma chave publica em todas as tabelas e views do schema public.
// Nao imprime conteudo. "BLOQUEADA" = 0 linhas visiveis ou erro de permissao.
// A chave publica (sb_publishable_...) e passada na hora, na variavel CHAVE:
//   PowerShell: $env:CHAVE='sb_publishable_...'; node supabase/etapa-b/testar-anon.js
//   Git Bash:   CHAVE='sb_publishable_...' node supabase/etapa-b/testar-anon.js
// A URL do projeto vem do .env.local (NEXT_PUBLIC_SUPABASE_URL).
const fs = require('fs')
const path = require('path')
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = (process.env.CHAVE || '').trim()
if (!KEY) {
  console.error('Informe a chave publica na variavel CHAVE (veja o inicio deste arquivo).')
  process.exit(1)
}
const nomes = `atualizacoes atualizacoes_obra avanco_fisico_historico avanco_fisico_realizado calendario_semanas
cronograma_atividades cronograma_financeiro_planejado cronograma_fisico_planejado cronograma_fisico_semanal
cronograma_horas_planejado curva_s_planejada curva_s_semanal_planejada curva_s_semanal_planejada_bkp_20260915
custos_indiretos_planejados custos_lancamentos custos_lancamentos_backup_20260710 marcos_contratuais
ocorrencias_obra orcamento_planejado orcamento_planejado_backup_20260709 v_avanco_semanal_realizado
v_curva_s_completa v_curva_s_financeira_planejada v_curva_s_fisica_planejada v_curva_s_mensal_planejada
v_custos_por_fase v_custos_por_grupo v_dashboard_completo v_kpis_projeto v_resumo_orcamento_por_fase`.split(/\s+/)
;(async () => {
  let abertas = 0
  for (const t of nomes) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
    })
    let st
    if (r.ok) {
      const total = Number((r.headers.get('content-range') || '').split('/')[1] || 0)
      st = total > 0 ? `ABERTA     (${total} linhas visiveis)` : 'BLOQUEADA  (0 linhas visiveis)'
      if (total > 0) abertas++
    } else {
      const e = await r.json().catch(() => ({}))
      st = `BLOQUEADA  (HTTP ${r.status} ${[e.code, e.message].filter(Boolean).join(' ')})`
    }
    console.log(t.padEnd(42), st)
  }
  console.log(`\n${abertas} de ${nomes.length} legiveis por esta chave publica`)
})()
