const fs = require('fs');
let code = fs.readFileSync('src/app/cristina-admin/iva/page.tsx', 'utf8');

// Rename component and page title
code = code.replace(/GastosPage/g, 'IVAPage');
code = code.replace(/Informes de Gastos/g, 'Informes de IVA');
code = code.replace(/<Receipt size=\{24\} \/>/g, '<Receipt size={24} />');

// Remove expanded columns logic
code = code.replace(/  \/\/ State for Expanded Columns[\s\S]*?\]\)/, '');
code = code.replace(/  const toggleMonth = \([\s\S]*?\}\n/, '');

// Fetch only IVA
code = code.replace(/const res = await fetch\(`\/api\/gastos\?year=\$\{activeYear\}`\)/, 
  "const res = await fetch(`/api/gastos?year=${activeYear}`);\n      const dataFiltered = (await res.json()).data?.filter((g: any) => g.grupo === 'IVA') || [];\n      setGastos(dataFiltered);\n      return;");
code = code.replace(/const res = await fetch\(`\/api\/gastos\?concepto=\$\{encodeURIComponent\(concepto\)\}`\)/, 
  "const res = await fetch(`/api/gastos?concepto=${encodeURIComponent(concepto)}`);\n      const dataFiltered = (await res.json()).data?.filter((g: any) => g.grupo === 'IVA') || [];\n      setHistorico(dataFiltered);\n      return;");

// Force group to IVA
code = code.replace(/const \[newRowGrupo, setNewRowGrupo\] = useState\('Gastos Fijos'\)/, "const [newRowGrupo, setNewRowGrupo] = useState('IVA')");

// In table, remove subcolumns rendering from thead
const regexThead = /\{isExpanded && \([\s\S]*?<\/>\n\s*\)\}/g;
code = code.replace(regexThead, '');

code = code.replace(/\{isExpanded \? 'Total' : m\.nombre\} <span style=\{\{ fontSize: 10, opacity: 0\.6 \}\}>\{isExpanded \? '➖' : '➕'\}<\/span>/g, '{m.nombre}');
code = code.replace(/onClick=\{\(\) => toggleMonth\(m\.id\)\}/g, '');
code = code.replace(/cursor: 'pointer'/g, "cursor: 'default'");
code = code.replace(/title="Haz clic para expandir o contraer sub-columnas"/g, "");

// Remove the inputs for c, r, dif
code = code.replace(/\{isExpanded && \([\s\S]*?<\/>\n\s*\)\}/g, '');
// Wait, `isExpanded &&` is gone from the code maybe because of the previous replace? No, it's global.
// I can just replace `isExpanded` references.
code = code.replace(/const isExpanded = expandedMonths.includes\(m\.id\)/g, '');
code = code.replace(/background: isExpanded \? 'rgba\(0,173,239,0\.08\)' : 'rgba\(0,173,239,0\.03\)'/g, "background: 'rgba(0,173,239,0.03)'");
code = code.replace(/background: isExpanded \? 'rgba\(0,173,239,0\.05\)' : 'rgba\(0,173,239,0\.02\)'/g, "background: 'rgba(0,173,239,0.02)'");
code = code.replace(/fontWeight: isExpanded \? 600 : 400/g, "fontWeight: 600");

// And for the group totals
code = code.replace(/\{isExpanded && \([\s\S]*?<\/>\n\s*\)\}/g, '');

// Add Total Trimestre row after the Subtotal Grupo
const subtotalRowRegex = /(<tr style=\{\{ background: 'rgba\(255,255,255,0\.02\)', borderBottom: '1px solid var\(--border-color\)' \}\}>[\s\S]*?<\/tr>)/;

const totalTrimestreStr = `
                {/* Total Trimestre */}
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '2px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--mercedes-cyan)', position: 'sticky', left: 0, background: 'rgba(255,255,255,0.04)' }}>
                    Total Trimestre
                  </td>
                  {MESES.map((m, i) => {
                    const isEndOfQuarter = (i + 1) % 3 === 0;
                    let trimTotal = 0;
                    if (isEndOfQuarter) {
                      trimTotal = grupo.conceptos.reduce((acc, c) => acc + c.meses.total[i] + c.meses.total[i-1] + c.meses.total[i-2], 0);
                    }
                    return (
                      <td key={m.id} style={{ padding: '10px 8px', textAlign: 'right', fontWeight: isEndOfQuarter ? 800 : 400, color: isEndOfQuarter ? 'var(--mercedes-cyan)' : 'transparent', background: 'rgba(0,173,239,0.03)' }}>
                        {isEndOfQuarter ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(trimTotal) : ''}
                      </td>
                    )
                  })}
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--mercedes-cyan)' }}>
                    {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grupo.conceptos.reduce((acc, c) => acc + c.totalAnual, 0))}
                  </td>
                  <td></td>
                </tr>
`;

code = code.replace(subtotalRowRegex, `$1\n${totalTrimestreStr}`);

fs.writeFileSync('src/app/cristina-admin/iva/page.tsx', code, 'utf8');
