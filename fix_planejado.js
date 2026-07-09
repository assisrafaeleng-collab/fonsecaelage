const fs = require('fs');
let c = fs.readFileSync('pages/avanco-fisico-planejado.js', 'utf8');

// 1. Change valItem to be proportional to the period
c = c.replace(
  `const valItem = r => {
    if (metric==='custo') return r.c
    if (metric==='hh') return r.h
    return r.h / totHh
  }`,
  `const valItem = r => {
    if (mes < r.a) return 0
    const numMeses = Math.max(r.b - r.a + 1, 1)
    const mesesAtivos = Math.min(mes, r.b) - r.a + 1
    if (metric==='custo') return r.c * mesesAtivos / numMeses
    if (metric==='hh') return r.h * mesesAtivos / numMeses
    return (r.h * mesesAtivos / numMeses) / totHh
  }
  const pctPlan = r => {
    if (mes < r.a) return 0
    const numMeses = Math.max(r.b - r.a + 1, 1)
    const mesesAtivos = Math.min(mes, r.b) - r.a + 1
    return Math.min(100, (mesesAtivos / numMeses) * 100)
  }`
);

// 2. Replace TimelineBar in item rows with % display
// Find the item-level TimelineBar usage
c = c.replace(
  /(<TimelineBar a=\{r\.a\} b=\{r\.b\} mes=\{mes\} \/>)/g,
  `<div style={{textAlign:'center'}}>
                                <span style={{fontSize:12, fontWeight:600, color: pctPlan(r)>=100?'#4D9B6A':pctPlan(r)>0?'#e6a338':'#444'}}>{pctPlan(r).toFixed(0)}%</span>
                                <div style={{height:3, background:'#1e1e24', borderRadius:2, marginTop:2}}>
                                  <div style={{height:'100%', width:pctPlan(r)+'%', background:pctPlan(r)>=100?'#4D9B6A':'#e6a338', borderRadius:2}} />
                                </div>
                              </div>`
);

// 3. Keep group-level TimelineBar as is (it uses g.aMin, g.bMax)

fs.writeFileSync('pages/avanco-fisico-planejado.js', c);
console.log('valItem:', c.includes('mesesAtivos') ? 'OK' : 'FAIL');
console.log('pctPlan:', c.includes('pctPlan') ? 'OK' : 'FAIL');
console.log('TimelineBar item removed:', !c.includes('TimelineBar a={r.a}') ? 'OK' : 'FAIL');
