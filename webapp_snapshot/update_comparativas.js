const fs = require('fs');

function updatePage(filePath, isIVA) {
  let code = fs.readFileSync(filePath, 'utf8');

  // 1. Change the states
  code = code.replace(
    /const \[comparativaConcepto, setComparativaConcepto\] = useState\(''\)/,
    "const [selectedConceptos, setSelectedConceptos] = useState<string[]>([])\n  const [availableConceptos, setAvailableConceptos] = useState<string[]>([])"
  );

  // 2. Change the useEffect and fetch logic
  const useEffectRegex = /useEffect\(\(\) => \{\s*if \(activeView === 'comparativa' && comparativaConcepto\) \{[\s\S]*?\}\s*\}, \[activeView, comparativaConcepto\]\)/;
  
  const newFetchCode = isIVA ? 
`  useEffect(() => {
    if (activeView === 'comparativa' && historico.length === 0) {
      fetchHistoricoTotal()
    }
  }, [activeView])

  const fetchHistoricoTotal = async () => {
    setLoadingHistorico(true)
    try {
      const res = await fetch('/api/gastos?grupo=IVA')
      const data = await res.json()
      if (data.success) {
        setHistorico(data.data)
        const allConcepts = Array.from(new Set((data.data as any[]).map(g => g.concepto))).sort()
        setAvailableConceptos(allConcepts)
      }
    } catch (e) { console.error(e) } finally { setLoadingHistorico(false) }
  }` 
  :
`  useEffect(() => {
    if (activeView === 'comparativa' && historico.length === 0) {
      fetchHistoricoTotal()
    }
  }, [activeView])

  const fetchHistoricoTotal = async () => {
    setLoadingHistorico(true)
    try {
      const res = await fetch('/api/gastos')
      const data = await res.json()
      if (data.success) {
        setHistorico(data.data)
        const allConcepts = Array.from(new Set((data.data as any[]).map(g => g.concepto))).sort()
        setAvailableConceptos(allConcepts)
      }
    } catch (e) { console.error(e) } finally { setLoadingHistorico(false) }
  }`;

  code = code.replace(useEffectRegex, newFetchCode);

  // 3. Remove old fetchHistorico function
  code = code.replace(/const fetchHistorico = async \([\s\S]*?finally \{\s*setLoadingHistorico\(false\)\s*\}\s*\}/, '');

  // 4. Update historicoAños
  const historicoAnosRegex = /const historicoAños = useMemo\(\(\) => \{[\s\S]*?return tabla\n  \}, \[historico\]\)/;
  code = code.replace(historicoAnosRegex, `const historicoAños = useMemo(() => {
    if (selectedConceptos.length === 0) return []
    const filteredHistorico = historico.filter(h => selectedConceptos.includes(h.concepto))
    
    const añosSet = new Set<number>()
    filteredHistorico.forEach(h => añosSet.add(h.year))
    const años = Array.from(añosSet).sort((a, b) => b - a)
    
    const tabla = años.map(year => {
      const meses = new Array(12).fill(0)
      filteredHistorico.filter(h => h.year === year).forEach(h => {
        meses[h.month - 1] += h.importe_total
      })
      return { year, meses, total: meses.reduce((a,b) => a+b, 0) }
    })
    return tabla
  }, [historico, selectedConceptos])`);

  // 5. Render comparativa UI - replace the Select area
  if (isIVA) {
    const renderComparativaRegex = /<div style=\{\{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center'[\s\S]*?<\/select>\n\s*<\/div>\n\s*<\/div>/;
    const uiBlock = `<div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'flex-start', background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <Filter size={20} color="var(--mercedes-cyan)" style={{ marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--light-text)', marginBottom: 8, fontWeight: 700 }}>Selecciona las partidas para comparar históricamente:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border-color)', fontSize: 12 }}>
              <input type="checkbox" checked={selectedConceptos.length === availableConceptos.length && availableConceptos.length > 0} onChange={(e) => {
                if (e.target.checked) setSelectedConceptos(availableConceptos)
                else setSelectedConceptos([])
              }} />
              <span style={{ fontWeight: 600, color: 'var(--mercedes-cyan)' }}>Seleccionar Todas</span>
            </label>
            {availableConceptos.map(c => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: selectedConceptos.includes(c) ? 'rgba(0,173,239,0.1)' : 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 20, border: selectedConceptos.includes(c) ? '1px solid var(--mercedes-cyan)' : '1px solid var(--border-color)', fontSize: 12, color: selectedConceptos.includes(c) ? 'var(--light-text)' : 'var(--medium-gray)', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={selectedConceptos.includes(c)} onChange={(e) => {
                  if (e.target.checked) setSelectedConceptos(prev => [...prev, c])
                  else setSelectedConceptos(prev => prev.filter(x => x !== c))
                }} style={{ display: 'none' }} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>
      </div>`;
    code = code.replace(renderComparativaRegex, uiBlock);
  } else {
    // For gastos, it might have slightly different spacing or formatting but should be same
    const renderComparativaRegex = /<div style=\{\{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center'[\s\S]*?<\/select>\n\s*<\/div>\n\s*<\/div>/;
    const uiBlock = `<div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'flex-start', background: 'var(--bg-card)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <Filter size={20} color="var(--mercedes-cyan)" style={{ marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 13, color: 'var(--light-text)', marginBottom: 8, fontWeight: 700 }}>Selecciona las partidas para comparar históricamente:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border-color)', fontSize: 12 }}>
              <input type="checkbox" checked={selectedConceptos.length === availableConceptos.length && availableConceptos.length > 0} onChange={(e) => {
                if (e.target.checked) setSelectedConceptos(availableConceptos)
                else setSelectedConceptos([])
              }} />
              <span style={{ fontWeight: 600, color: 'var(--mercedes-cyan)' }}>Seleccionar Todas</span>
            </label>
            {availableConceptos.map(c => (
              <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: selectedConceptos.includes(c) ? 'rgba(0,173,239,0.1)' : 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: 20, border: selectedConceptos.includes(c) ? '1px solid var(--mercedes-cyan)' : '1px solid var(--border-color)', fontSize: 12, color: selectedConceptos.includes(c) ? 'var(--light-text)' : 'var(--medium-gray)', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={selectedConceptos.includes(c)} onChange={(e) => {
                  if (e.target.checked) setSelectedConceptos(prev => [...prev, c])
                  else setSelectedConceptos(prev => prev.filter(x => x !== c))
                }} style={{ display: 'none' }} />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>
      </div>`;
    code = code.replace(renderComparativaRegex, uiBlock);
  }

  // 6. Fix the conditions and titles
  if (isIVA) {
    code = code.replace(/\) : comparativaConcepto \&\& historicoAños\.length > 0 \? \(/g, ") : selectedConceptos.length > 0 && historicoAños.length > 0 ? (");
    code = code.replace(/\) : comparativaConcepto \? \(/g, ") : selectedConceptos.length > 0 ? (");
    code = code.replace(/Análisis Interanual: <span style=\{\{ color: 'var\(--mercedes-cyan\)' \}\}>\{comparativaConcepto === 'TOTAL_IVA' \? 'TOTAL IVA' : comparativaConcepto\}<\/span>/g, `Análisis Interanual: <span style={{ color: 'var(--mercedes-cyan)' }}>{selectedConceptos.length === availableConceptos.length ? 'Todas las Partidas' : \`\${selectedConceptos.length} partida(s) seleccionada(s)\`}</span>`);
  } else {
    code = code.replace(/\) : comparativaConcepto \&\& historicoAños\.length > 0 \? \(/g, ") : selectedConceptos.length > 0 && historicoAños.length > 0 ? (");
    code = code.replace(/\) : comparativaConcepto \? \(/g, ") : selectedConceptos.length > 0 ? (");
    code = code.replace(/Análisis Interanual: <span style=\{\{ color: 'var\(--mercedes-cyan\)' \}\}>\{comparativaConcepto\}<\/span>/g, `Análisis Interanual: <span style={{ color: 'var(--mercedes-cyan)' }}>{selectedConceptos.length === availableConceptos.length ? 'Todas las Partidas' : \`\${selectedConceptos.length} partida(s) seleccionada(s)\`}</span>`);
  }

  // Also add Recharts to GastosPage if it's not there, but wait, did they ask for Recharts on GastosPage too? 
  // "Puedes poer en la comparativa Historica también por Total del Año y hacer una grafica de comparativa de años?"
  // I already put Recharts on IVA. I'll put it on Gastos too.
  if (!isIVA) {
    if (!code.includes('import { BarChart')) {
      code = code.replace(/import Link from 'next\/link'/, "import Link from 'next/link'\nimport { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts'");
    }
    const tableDivRegex = /<div style=\{\{ overflowX: 'auto' \}\}>/;
    const chartBlock = `
          {/* Gráfica Recharts */}
          <div style={{ height: 320, padding: '24px 32px 12px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...historicoAños].reverse()}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: 'var(--medium-gray)', fontSize: 12, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--medium-gray)', fontSize: 12}} tickFormatter={(val) => \`€\${(val/1000).toFixed(0)}k\`} dx={-10} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(0,173,239,0.05)'}} 
                  contentStyle={{background: 'var(--bg-card)', border: '1px solid var(--mercedes-cyan)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--light-text)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} 
                  formatter={(val) => [new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR'}).format(val), 'Total Anual']} 
                  labelStyle={{color: 'var(--medium-gray)', marginBottom: 4}}
                />
                <Bar dataKey="total" fill="var(--mercedes-cyan)" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ overflowX: 'auto' }}>`;
    code = code.replace(tableDivRegex, chartBlock);
  }

  fs.writeFileSync(filePath, code, 'utf8');
}

updatePage('src/app/cristina-admin/iva/page.tsx', true);
updatePage('src/app/cristina-admin/gastos/page.tsx', false);
