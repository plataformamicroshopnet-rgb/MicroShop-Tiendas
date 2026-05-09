import fs from 'fs';

const path = 'src/app/comisiones/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// We need to add `tiendaRules` to the destruction of useComisionesData
code = code.replace(
    /        monthSales\n    \} = useComisionesData\(\)/g,
    `        monthSales,
        tiendaRules
    } = useComisionesData()`
);

// We need to change the map
const replaceMapStart = `{ALL_GROUPS.map(gName => {
                                                const qtty = s.groupCounts[gName]
                                                const obj1 = s.groupObj1[gName] || 0
                                                const obj2 = s.groupObj2[gName] || 0
                                                const isValueGroup = ['TMA', 'TI', 'MIC'].includes(gName)
                                                
                                                const maxObj = obj2 > 0 ? obj2 : (obj1 > 0 ? obj1 : 0)
                                                const percent = maxObj > 0 ? Math.min(100, (qtty / maxObj) * 100) : (qtty > 0 ? 100 : 0)
                                                const obj1Percent = maxObj > 0 && obj1 > 0 ? Math.min(100, (obj1 / maxObj) * 100) : 0
                                                
                                                let gradientColor = 'linear-gradient(90deg, #fdba74, #f97316)' // Naranja (Bajo rendimiento)
                                                if (qtty >= obj2 && obj2 > 0) gradientColor = 'linear-gradient(90deg, #86efac, #22c55e)' // Verde (Alto rendimiento)
                                                else if (qtty >= obj1 && obj1 > 0) gradientColor = 'linear-gradient(90deg, #fde68a, #f59e0b)' // Amarillo (Medio rendimiento)
                                                else if (qtty > 0 && obj1 === 0 && obj2 === 0) gradientColor = 'linear-gradient(90deg, #86efac, #22c55e)' // Verde Default (sin objetivos configurados)
                                                
                                                const falt1 = Math.max(0, obj1 - qtty)
                                                const falt2 = Math.max(0, obj2 - qtty)
                                                
                                                const format = (v) => isValueGroup ? \`\${Math.round(v).toLocaleString('es-ES')} €\` : \`\${v}\`
                                                const comisionCalculada = s.groupComisions[gName] || 0;

                                                return (
                                                    <tr className="table-row-hover" key={gName} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                                        <td style={{ padding: '6px 4px', fontSize: 13, fontWeight: 700, color: 'var(--light-text)', width: 45 }}>
                                                            {gName}
                                                        </td>`;

const newMapStart = `{tiendaRules && tiendaRules.length > 0 ? tiendaRules.map((rule) => {
                                                const gName = rule.nombre;
                                                const qtty = s.groupCounts[gName] || 0
                                                const obj1 = s.groupObj1[gName] || 0
                                                const obj2 = s.groupObj2[gName] || 0
                                                const isValueGroup = String(rule.importePrimerTramo || '').includes('%');
                                                
                                                const maxObj = obj2 > 0 ? obj2 : (obj1 > 0 ? obj1 : 0)
                                                const percent = maxObj > 0 ? Math.min(100, (qtty / maxObj) * 100) : (qtty > 0 ? 100 : 0)
                                                const obj1Percent = maxObj > 0 && obj1 > 0 ? Math.min(100, (obj1 / maxObj) * 100) : 0
                                                
                                                let gradientColor = 'linear-gradient(90deg, #fdba74, #f97316)' // Naranja (Bajo rendimiento)
                                                if (qtty >= obj2 && obj2 > 0) gradientColor = 'linear-gradient(90deg, #86efac, #22c55e)' // Verde (Alto rendimiento)
                                                else if (qtty >= obj1 && obj1 > 0) gradientColor = 'linear-gradient(90deg, #fde68a, #f59e0b)' // Amarillo (Medio rendimiento)
                                                else if (qtty > 0 && obj1 === 0 && obj2 === 0) gradientColor = 'linear-gradient(90deg, #86efac, #22c55e)' // Verde Default (sin objetivos configurados)
                                                
                                                const falt1 = Math.max(0, obj1 - qtty)
                                                const falt2 = Math.max(0, obj2 - qtty)
                                                
                                                const format = (v) => {
                                                    if (v === 0) return '0';
                                                    if (isValueGroup || v > 100) return \`\${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })}\`;
                                                    return Math.round(v).toString();
                                                }
                                                const formatQtty = (v) => {
                                                    if (v === 0) return '0';
                                                    if (isValueGroup || v > 100) return \`\${v.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €\`;
                                                    return Math.round(v).toString();
                                                }
                                                const comisionCalculada = s.groupComisions[gName] || 0;

                                                return (
                                                    <tr className="table-row-hover" key={gName} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                                        <td style={{ padding: '6px 4px', fontSize: 13, fontWeight: 700, color: 'var(--light-text)', minWidth: 100 }}>
                                                            {gName}
                                                        </td>`;

code = code.replace(replaceMapStart, newMapStart);

// Let's replace the map end.
const replaceMapEnd = `                                                    </tr>
                                                )
                                            })}`;

const newMapEnd = `                                                    </tr>
                                                )
                                            }) : <tr><td colSpan={6} style={{padding: 20, textAlign: 'center', color: 'var(--medium-gray)'}}>No hay reglas de comisión configuradas para este mes.</td></tr>}`;

code = code.replace(replaceMapEnd, newMapEnd);

// One more place: in the TD for quantity
code = code.replace(
    /<td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: isPlus \? '#00ADEF' : '#FF9500' }}>\n\s*\{format\(qtty\)\}\n\s*<\/td>/g,
    `<td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: isPlus ? '#00ADEF' : '#FF9500' }}>
                                                            {formatQtty(qtty)}
                                                        </td>`
);

fs.writeFileSync(path, code);
console.log('page.tsx patched.');
