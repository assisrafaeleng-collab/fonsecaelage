const fs = require('fs');
let c = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');

// 1. Trocar o bloco de renderização dos alertas para incluir checkbox e localStorage
const oldRender = `if (loading) return <div style={{color:'#6d675e', fontSize:12}}>Analisando...</div>
  if (alertas.length === 0) return <div style={{color:'#4D9B6A', fontSize:13}}>✅ Nenhum desvio relevante detectado até M{mes}.</div>

  return (
    <div>
      {alertas.map((a, i) => (
        <div key={i} style={{
          display:'flex', gap:10, padding:'10px 12px', marginBottom:6, borderRadius:8,
          background: a.nivel==='alto' ? 'rgba(176,48,48,0.12)' : 'rgba(200,134,10,0.10)',
          border: \`1px solid \${a.nivel==='alto' ? '#B0303055' : '#C8860A44'}\`,
        }}>
          <span>{a.nivel==='alto' ? '🔴' : '🟡'}</span>
          <span style={{fontSize:12, color:'#ece9e4', lineHeight:1.5}}>{a.msg}</span>
        </div>
      ))}
    </div>
  )
}`;

const novoRender = `// Carregar resolvidos do localStorage
  const [resolvidos, setResolvidos] = useState(() => {
    if (typeof window === 'undefined') return {}
    try {
      return JSON.parse(localStorage.getItem('alertas_resolvidos') || '{}')
    } catch { return {} }
  })

  function toggleResolvido(key) {
    setResolvidos(prev => {
      const novo = { ...prev, [key]: !prev[key] }
      if (!novo[key]) delete novo[key]
      try { localStorage.setItem('alertas_resolvidos', JSON.stringify(novo)) } catch {}
      return novo
    })
  }

  if (loading) return <div style={{color:'#6d675e', fontSize:12}}>Analisando...</div>
  if (alertas.length === 0) return <div style={{color:'#4D9B6A', fontSize:13}}>✅ Nenhum desvio relevante detectado até M{mes}.</div>

  return (
    <div>
      {alertas.map((a, i) => {
        // Chave estável para o alerta (baseada na msg)
        const key = a.msg.slice(0, 80)
        const resolvido = !!resolvidos[key]
        return (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:12, padding:'12px 14px', marginBottom:8, borderRadius:8,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            opacity: resolvido ? 0.5 : 1,
            transition: 'opacity 0.2s'
          }}>
            <input
              type="checkbox"
              checked={resolvido}
              onChange={() => toggleResolvido(key)}
              style={{width:16, height:16, cursor:'pointer', accentColor: '#4D9B6A', flexShrink:0}}
              title={resolvido ? 'Desmarcar' : 'Marcar como resolvido'}
            />
            <span style={{flexShrink:0}}>{resolvido ? '✅' : (a.nivel==='alto' ? '🔴' : '🟡')}</span>
            <span style={{
              fontSize:12, color:'#ece9e4', lineHeight:1.5, flex:1,
              textDecoration: resolvido ? 'line-through' : 'none',
              color: resolvido ? '#6d675e' : '#ece9e4'
            }}>{a.msg}</span>
          </div>
        )
      })}
    </div>
  )
}`;

if (c.includes(oldRender)) {
  c = c.replace(oldRender, novoRender);
  console.log('Bloco alertas substituido (LF): OK');
} else {
  const oldCRLF = oldRender.replace(/\n/g, '\r\n');
  const novoCRLF = novoRender.replace(/\n/g, '\r\n');
  if (c.includes(oldCRLF)) {
    c = c.replace(oldCRLF, novoCRLF);
    console.log('Bloco alertas substituido (CRLF): OK');
  } else {
    console.log('FAIL - bloco nao encontrado');
  }
}

fs.writeFileSync('components/PaineisAnalise.jsx', c);
const check = fs.readFileSync('components/PaineisAnalise.jsx', 'utf8');
console.log('checkbox:', check.includes('type="checkbox"') ? 'OK' : 'FAIL');
console.log('localStorage:', check.includes('localStorage.getItem') ? 'OK' : 'FAIL');
console.log('line-through:', check.includes("textDecoration: resolvido ? 'line-through'") ? 'OK' : 'FAIL');
console.log('var(--bg2):', check.includes("background: 'var(--bg2)'") ? 'OK' : 'FAIL');
