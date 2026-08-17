const fs = require('fs');
let c = fs.readFileSync('pages/custos-diretos-realizados-lista.js', 'utf8');

// Verificar imports
const hasUseState = c.includes('useState');
const hasUseMemo = c.includes('useMemo');
console.log('useState:', hasUseState);
console.log('useMemo:', hasUseMemo);

// COMP_MAP já existe?
const hasCompMap = c.includes('COMP_MAP');
console.log('COMP_MAP:', hasCompMap);

// Adicionar COMP_MAP se não existir
if (!hasCompMap) {
  const compMapCode = `const COMP_MAP = {'2026-07':'M1','2026-08':'M2','2026-09':'M3','2026-10':'M4','2026-11':'M5','2026-12':'M6','2027-01':'M7','2027-02':'M8','2027-03':'M9','2027-04':'M10','2027-05':'M11','2027-06':'M12','2027-07':'M13','2027-08':'M14','2027-09':'M15','2027-10':'M16','2027-11':'M17','2027-12':'M18','2028-01':'M19','2028-02':'M20'}
function compLabel(comp) { return COMP_MAP[comp] || comp }
`;
  // Inserir antes do "const S ="
  c = c.replace("const S =", compMapCode + "\nconst S =");
  console.log('COMP_MAP adicionado');
}

// Adicionar estado dos filtros e mostrar/esconder lista, depois de outros useStates
// Achar useState mais próximo do topo do componente
const useStatePattern = /const \[loading, setLoading\] = useState/;
if (useStatePattern.test(c) && !c.includes('mostrarLista')) {
  c = c.replace(
    /(const \[loading, setLoading\] = useState[^\n]*)/,
    `$1
  const [mostrarLista, setMostrarLista] = useState(false)
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos')
  const [filtroGrupo, setFiltroGrupo] = useState('todos')
  const [filtroPavimento, setFiltroPavimento] = useState('todos')
  const [filtroBusca, setFiltroBusca] = useState('')`
  );
  console.log('Estados de filtro adicionados');
}

// Adicionar cálculo do lancamentosParaLista via useMemo, próximo dos outros memos
// Inserir depois do lancFiltrados
const memoInsertPoint = c.indexOf('const lancFiltrados = useMemo');
if (memoInsertPoint > -1 && !c.includes('lancamentosParaLista')) {
  // Achar o fechamento do useMemo do lancFiltrados
  const endBraceIdx = c.indexOf('}), [lanc, dataLimite])', memoInsertPoint);
  if (endBraceIdx > -1) {
    const insertPos = endBraceIdx + '}), [lanc, dataLimite])'.length;
    const newMemo = `

  // Grupos únicos para filtro
  const gruposUnicos = useMemo(() => {
    const set = new Set()
    dados.forEach(r => set.add(JSON.stringify({g: r.g, n: r.n})))
    return Array.from(set).map(s => JSON.parse(s)).sort((a,b) => a.g - b.g)
  }, [dados])

  // Pavimentos únicos
  const pavimentosUnicos = useMemo(() => {
    const set = new Set()
    dados.forEach(r => r.p && set.add(r.p))
    return Array.from(set).sort()
  }, [dados])

  // Map EAP -> {grupo_num, grupo_nome, pavimento}
  const eapMap = useMemo(() => {
    const m = {}
    dados.forEach(r => {
      m[r.i] = { g: r.g, n: r.n, p: r.p }
    })
    return m
  }, [dados])

  // Lançamentos com filtros aplicados
  const lancamentosParaLista = useMemo(() => {
    return lanc.filter(l => {
      const eap = l.codigo_eap || ''
      const info = eapMap[eap] || {}
      // Período
      if (filtroPeriodo !== 'todos') {
        const compM = compLabel(l.competencia)
        if (compM !== filtroPeriodo) return false
      }
      // Grupo
      if (filtroGrupo !== 'todos') {
        if (String(info.g) !== filtroGrupo) return false
      }
      // Pavimento
      if (filtroPavimento !== 'todos') {
        if (info.p !== filtroPavimento) return false
      }
      // Busca
      if (filtroBusca.trim()) {
        const q = filtroBusca.toLowerCase()
        const desc = (l.descricao || l.historico || '').toLowerCase()
        if (!desc.includes(q) && !eap.includes(q)) return false
      }
      return true
    }).sort((a,b) => (b.data_emissao || '').localeCompare(a.data_emissao || ''))
  }, [lanc, eapMap, filtroPeriodo, filtroGrupo, filtroPavimento, filtroBusca])
`;
    c = c.slice(0, insertPos) + newMemo + c.slice(insertPos);
    console.log('useMemos de filtro adicionados');
  }
}

// Adicionar o card da lista antes do fechamento (antes do último "</div>\n      </div>\n    </div>\n  )\n}")
const fimComp = c.lastIndexOf('    </div>\n  )\n}');
if (fimComp > -1 && !c.includes('mostrarLista &&')) {
  // Achar o </div> anterior ao fechamento (fecha o wrap principal)
  const beforeEnd = c.lastIndexOf('</div>', fimComp - 1);
  if (beforeEnd > -1) {
    const cardLista = `
        {/* Botão + Lista completa de lançamentos com filtros */}
        <div style={{marginTop:20}}>
          {!mostrarLista ? (
            <button onClick={() => setMostrarLista(true)} style={{
              width:'100%', padding:'14px 18px', background:'#17171b', border:'1px solid #2a2a31',
              borderRadius:10, color:'#e6a338', fontSize:13, fontWeight:600, cursor:'pointer',
              fontFamily:'inherit'
            }}>
              📋 Ver todos os lançamentos ({lanc.length})
            </button>
          ) : (
            <div style={{background:'#17171b', border:'1px solid #2a2a31', borderRadius:12, overflow:'hidden'}}>
              <div style={{padding:'14px 18px', borderBottom:'1px solid #2a2a31', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:12, fontWeight:600, color:'#a09a90', textTransform:'uppercase', letterSpacing:.5}}>
                  Todos os lançamentos ({lancamentosParaLista.length}{lancamentosParaLista.length !== lanc.length ? ' de ' + lanc.length : ''})
                </span>
                <button onClick={() => setMostrarLista(false)} style={{background:'transparent', border:'none', color:'#6d675e', fontSize:12, cursor:'pointer'}}>✕ Fechar</button>
              </div>
              {/* Filtros */}
              <div style={{padding:'12px 18px', borderBottom:'1px solid #2a2a31', display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10}}>
                <div>
                  <div style={{fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:4}}>Período</div>
                  <select value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)} style={{width:'100%', background:'#0f0f11', color:'#ece9e4', border:'1px solid #2a2a31', borderRadius:6, padding:'6px 8px', fontSize:12, fontFamily:'inherit'}}>
                    <option value="todos">Todos</option>
                    {Object.values(COMP_MAP).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:4}}>Grupo</div>
                  <select value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} style={{width:'100%', background:'#0f0f11', color:'#ece9e4', border:'1px solid #2a2a31', borderRadius:6, padding:'6px 8px', fontSize:12, fontFamily:'inherit'}}>
                    <option value="todos">Todos</option>
                    {gruposUnicos.map(g => <option key={g.g} value={g.g}>{g.g} - {g.n}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:4}}>Pavimento</div>
                  <select value={filtroPavimento} onChange={e => setFiltroPavimento(e.target.value)} style={{width:'100%', background:'#0f0f11', color:'#ece9e4', border:'1px solid #2a2a31', borderRadius:6, padding:'6px 8px', fontSize:12, fontFamily:'inherit'}}>
                    <option value="todos">Todos</option>
                    {pavimentosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, marginBottom:4}}>Buscar</div>
                  <input type="text" value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)} placeholder="descrição ou EAP..." style={{width:'100%', background:'#0f0f11', color:'#ece9e4', border:'1px solid #2a2a31', borderRadius:6, padding:'6px 8px', fontSize:12, fontFamily:'inherit', boxSizing:'border-box'}} />
                </div>
              </div>
              {/* Header da tabela */}
              <div style={{display:'grid', gridTemplateColumns:'100px 1fr 80px 100px 60px', gap:8, padding:'8px 18px', fontSize:9, color:'#6d675e', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #2a2a31'}}>
                <span>Data</span><span>Descrição</span><span>EAP</span><span style={{textAlign:'right'}}>Valor</span><span style={{textAlign:'right'}}>M</span>
              </div>
              {/* Linhas */}
              <div style={{maxHeight:500, overflowY:'auto'}}>
                {lancamentosParaLista.length === 0 ? (
                  <div style={{padding:'30px', textAlign:'center', color:'#6d675e', fontSize:12}}>Nenhum lançamento encontrado com os filtros aplicados.</div>
                ) : lancamentosParaLista.map((l, i) => (
                  <div key={i} style={{display:'grid', gridTemplateColumns:'100px 1fr 80px 100px 60px', gap:8, padding:'8px 18px', fontSize:12, alignItems:'center', background:i%2===0?'rgba(255,255,255,0.01)':'transparent', borderBottom:'1px solid #1a1a20'}}>
                    <span style={{color:'#6d675e'}}>{l.data_emissao?.slice(0,10)}</span>
                    <span style={{color:'#a09a90'}}>{l.descricao || l.historico}</span>
                    <span style={{color:'#6d675e', fontFamily:'monospace', fontSize:10}}>{l.codigo_eap}</span>
                    <span style={{textAlign:'right', color:'#E91E8C', fontWeight:600}}>{fmtR(l.valor)}</span>
                    <span style={{textAlign:'right', color:'#5B9BD5', fontSize:11}}>{compLabel(l.competencia)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
`;
    c = c.slice(0, beforeEnd) + cardLista + c.slice(beforeEnd);
    console.log('Card lista adicionado');
  }
}

fs.writeFileSync('pages/custos-diretos-realizados-lista.js', c);
const check = fs.readFileSync('pages/custos-diretos-realizados-lista.js', 'utf8');
console.log('\n--- Verificação final ---');
console.log('mostrarLista:', check.includes('mostrarLista') ? 'OK' : 'FAIL');
console.log('lancamentosParaLista:', check.includes('lancamentosParaLista') ? 'OK' : 'FAIL');
console.log('Filtros (4):', ['filtroPeriodo','filtroGrupo','filtroPavimento','filtroBusca'].every(f => check.includes(f)) ? 'OK' : 'FAIL');
console.log('Botao Ver todos:', check.includes('Ver todos os lançamentos') ? 'OK' : 'FAIL');
