import fs from 'fs';

const path = 'src/app/comisiones/page.tsx';
let code = fs.readFileSync(path, 'utf8');

const replaceHeader = `<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                    <div style={{ 
                                        width: 28, height: 28, borderRadius: '50%', 
                                        backgroundColor: isPlus ? 'rgba(0,173,239,0.1)' : 'rgba(255,149,0,0.1)', 
                                        color: isPlus ? 'var(--mercedes-cyan)' : '#FF9500',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', 
                                        fontSize: 14, fontWeight: 700 
                                    }}>
                                        {s.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--light-text)' }}>{s.name}</div>
                                        <span style={{ 
                                            display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                            backgroundColor: isPlus ? 'rgba(0,173,239,0.2)' : 'rgba(255,149,0,0.2)',
                                            color: isPlus ? 'var(--mercedes-cyan)' : '#FF9500'
                                        }}>
                                            Perfil {s.profile}
                                        </span>
                                    </div>
                                </div>

                                {/* CENTRO: Herramientas (Modo Dios y Telemetría) */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                                    <div className="no-print">
                                        <AspirationalSimulatorButton s={s} />
                                    </div>
                                    <div className="no-print">
                                        <FinancialSpeedometer currentAmount={s.totalComision} sellerName={s.name} />
                                    </div>
                                </div>
                                
                                {/* DERECHA: Total */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 1 }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399' }}>{Math.round(s.totalComision).toLocaleString('es-ES')} €</div>
                                    {s.totalExtras > 0 && <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>(Base: {Math.round(s.totalComision - s.totalExtras).toLocaleString()} + Ext: {Math.round(s.totalExtras).toLocaleString()})</div>}
                                </div>
                            </div>`;

const newHeader = `<div style={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                padding: '16px 24px', 
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
                                backdropFilter: 'blur(20px)',
                                borderTopLeftRadius: 16, borderTopRightRadius: 16,
                                borderBottom: '2px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                                    <div style={{ 
                                        width: 50, height: 50, borderRadius: '14px', 
                                        background: isPlus ? 'linear-gradient(135deg, rgba(0,173,239,0.2) 0%, rgba(0,173,239,0.05) 100%)' : 'linear-gradient(135deg, rgba(255,149,0,0.2) 0%, rgba(255,149,0,0.05) 100%)',
                                        boxShadow: isPlus ? 'inset 0 0 10px rgba(0,173,239,0.5), 0 4px 10px rgba(0,0,0,0.3)' : 'inset 0 0 10px rgba(255,149,0,0.5), 0 4px 10px rgba(0,0,0,0.3)',
                                        color: isPlus ? 'var(--mercedes-cyan)' : '#FF9500',
                                        border: isPlus ? '1px solid rgba(0,173,239,0.3)' : '1px solid rgba(255,149,0,0.3)',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', 
                                        fontSize: 24, fontWeight: 800, textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                    }}>
                                        {s.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--light-text)', letterSpacing: '-0.5px' }}>{s.name}</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: isPlus ? 'var(--mercedes-cyan)' : '#FF9500', textTransform: 'uppercase', letterSpacing: '1px' }}>Perfil {s.profile}</div>
                                    </div>
                                </div>

                                {/* CENTRO: Herramientas (Modo Dios y Telemetría) */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                    <div className="no-print">
                                        <AspirationalSimulatorButton s={s} />
                                    </div>
                                    <div className="no-print" style={{ transform: 'scale(1.1)', transformOrigin: 'center' }}>
                                        <FinancialSpeedometer currentAmount={s.totalComision} sellerName={s.name} />
                                    </div>
                                </div>
                                
                                {/* DERECHA: Total */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '1.5px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>COMISIÓN TOTAL</div>
                                        <div style={{ fontSize: 36, fontWeight: 900, color: '#34d399', textShadow: '0 0 20px rgba(52,211,153,0.4)', lineHeight: 1 }}>
                                            {Math.round(s.totalComision).toLocaleString('es-ES')} <span style={{fontSize: 22}}>€</span>
                                        </div>
                                    </div>
                                    {s.totalExtras > 0 && <div style={{ fontSize: 12, color: '#10b981', fontWeight: 800, backgroundColor: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(16,185,129,0.2)' }}>Base: {Math.round(s.totalComision - s.totalExtras).toLocaleString()} € + Extras: {Math.round(s.totalExtras).toLocaleString()} €</div>}
                                </div>
                            </div>`;

code = code.replace(replaceHeader, newHeader);

// Now the table logic
const replaceTableStart = `<tr style={{ 
                                                backgroundColor: isPlus ? 'rgba(0,173,239,0.1)' : 'rgba(255,149,0,0.1)', 
                                                color: isPlus ? 'var(--mercedes-cyan)' : '#FF9500', 
                                                textTransform: 'uppercase',
                                                fontSize: 10
                                            }}>
                                                <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}>Nombre Comisión</th>
                                                <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}></th>
                                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>Ventas</th>
                                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>Objetivos (1 - 2)</th>
                                                <th style={{ padding: '6px', textAlign: 'center', fontWeight: 600 }}>Te quedan (1 - 2)</th>
                                                <th style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>Comisión</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tiendaRules && tiendaRules.length > 0 ? tiendaRules.map((rule: any) => {`;

const newTableStart = `<tr style={{ 
                                                backgroundColor: '#1e293b', 
                                                color: 'rgba(255,255,255,0.8)', 
                                                textTransform: 'uppercase',
                                                fontSize: 10,
                                                letterSpacing: '1px'
                                            }}>
                                                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800 }}>GRUPO</th>
                                                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800 }}>VENTAS</th>
                                                <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 800 }}>OBJETIVOS (1 - 2)</th>
                                                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800 }}>TE QUEDAN</th>
                                                <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800 }}>COMISIÓN</th>
                                                <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800 }}>ESTADO</th>
                                            </tr>
                                        </thead>
                                        <tbody style={{backgroundColor: 'rgba(0,0,0,0.2)'}}>
                                            {tiendaRules && tiendaRules.length > 0 ? tiendaRules.map((rule: any, idx: number) => {`;

code = code.replace(replaceTableStart, newTableStart);

const replaceRowMap = `const gName = rule.nombre;
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
                                                
                                                const format = (v: number) => {
                                                    if (v === 0) return '0';
                                                    if (isValueGroup || v > 100) return \`\${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €\`;
                                                    return Math.round(v).toString();
                                                }
                                                const formatQtty = (v: number) => {
                                                    if (v === 0) return '0';
                                                    if (isValueGroup || v > 100) return \`\${v.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €\`;
                                                    return Math.round(v).toString();
                                                }
                                                const comisionCalculada = s.groupComisions[gName] || 0;

                                                return (
                                                    <tr className="table-row-hover" key={gName} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                                                        <td style={{ padding: '6px 4px', fontSize: 13, fontWeight: 700, color: 'var(--light-text)', minWidth: 100 }}>
                                                            {gName}
                                                        </td>
                                                        <td style={{ padding: '6px 8px', width: '25%' }}>
                                                            <div style={{ position: 'relative', backgroundColor: 'rgba(255,255,255,0.08)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                                                                <div style={{ width: \`\${percent}%\`, height: '100%', background: gradientColor, transition: 'width 0.5s ease', boxShadow: '0 0 6px rgba(0,0,0,0.2)', borderRadius: 4 }} />
                                                                {obj1Percent > 0 && obj1Percent < 100 && (
                                                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: \`\${obj1Percent}%\`, width: 2, backgroundColor: 'var(--bg-card)', boxShadow: '0 0 4px rgba(0,0,0,0.5)', zIndex: 1 }} title="Objetivo 1" />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: isPlus ? '#00ADEF' : '#FF9500' }}>
                                                            {formatQtty(qtty)}
                                                        </td>
                                                        <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, color: 'var(--medium-gray)' }}>
                                                            {format(obj1)} <span style={{opacity: 0.5}}>/</span> {format(obj2)}
                                                        </td>
                                                        <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, color: 'var(--medium-gray)' }}>
                                                            <span style={{ color: falt1 > 0 ? '#FF453A' : '#34d399' }}>{falt1 > 0 ? \`-\${format(falt1)}\` : '✓'}</span> <span style={{opacity: 0.5}}>/</span> <span style={{ color: falt2 > 0 ? (falt1 === 0 ? '#FF9500' : '#FF453A') : '#34d399' }}>{falt2 > 0 ? \`-\${format(falt2)}\` : '✓'}</span>
                                                        </td>
                                                        <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#34d399' }}>
                                                            {Math.round(comisionCalculada).toLocaleString('es-ES')} €
                                                        </td>
                                                    </tr>
                                                )`;

const newRowMap = `const gName = rule.nombre;
                                                const qtty = s.groupCounts[gName] || 0
                                                const obj1 = s.groupObj1[gName] || 0
                                                const obj2 = s.groupObj2[gName] || 0
                                                const isValueGroup = String(rule.importePrimerTramo || '').includes('%');
                                                
                                                const maxObj = obj2 > 0 ? obj2 : (obj1 > 0 ? obj1 : 0)
                                                const percent = maxObj > 0 ? Math.min(100, (qtty / maxObj) * 100) : (qtty > 0 ? 100 : 0)
                                                const obj1Percent = maxObj > 0 && obj1 > 0 ? Math.min(100, (obj1 / maxObj) * 100) : 0
                                                
                                                // Dynamic Row Colors based on state
                                                let rowBg = 'rgba(255,255,255,0.02)';
                                                let textColor = 'var(--light-text)';
                                                let stateLabel = 'EN PROCESO';
                                                let stateColor = '#fbbf24'; // Yellow
                                                let barColor = 'linear-gradient(90deg, #3b82f6, #60a5fa)'; // Default blue
                                                
                                                if (qtty >= obj2 && obj2 > 0) {
                                                    rowBg = 'rgba(16, 185, 129, 0.15)'; // Green bg
                                                    textColor = '#a7f3d0';
                                                    stateLabel = 'CONSEGUIDO';
                                                    stateColor = '#10b981';
                                                    barColor = 'linear-gradient(90deg, #10b981, #34d399)';
                                                } else if (qtty >= obj1 && obj1 > 0) {
                                                    rowBg = 'rgba(59, 130, 246, 0.15)'; // Blue bg
                                                    textColor = '#bfdbfe';
                                                    stateLabel = 'EN PROCESO'; // Maybe Tramo 1 achieved, but still processing
                                                    stateColor = '#60a5fa';
                                                    barColor = 'linear-gradient(90deg, #3b82f6, #60a5fa)';
                                                } else if (qtty === 0) {
                                                    rowBg = 'rgba(239, 68, 68, 0.15)'; // Red bg
                                                    textColor = '#fecaca';
                                                    stateLabel = 'SIN VENTAS';
                                                    stateColor = '#ef4444';
                                                    barColor = 'transparent';
                                                } else {
                                                    rowBg = 'rgba(251, 191, 36, 0.15)'; // Yellow bg
                                                    textColor = '#fde68a';
                                                    stateLabel = 'EN PROCESO';
                                                    stateColor = '#fbbf24';
                                                    barColor = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
                                                }
                                                
                                                if (obj1 === 0 && obj2 === 0) {
                                                    if (qtty > 0) {
                                                        rowBg = 'rgba(16, 185, 129, 0.15)';
                                                        stateLabel = 'CONSEGUIDO';
                                                        stateColor = '#10b981';
                                                        barColor = 'linear-gradient(90deg, #10b981, #34d399)';
                                                    } else {
                                                        rowBg = 'rgba(255,255,255,0.02)';
                                                        stateLabel = 'SIN OBJETIVO';
                                                        stateColor = 'rgba(255,255,255,0.3)';
                                                        barColor = 'transparent';
                                                    }
                                                }
                                                
                                                const falt1 = Math.max(0, obj1 - qtty)
                                                const falt2 = Math.max(0, obj2 - qtty)
                                                
                                                const format = (v: number) => {
                                                    if (v === 0) return '0';
                                                    if (isValueGroup || v > 100) return \`\${v.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €\`;
                                                    return Math.round(v).toString();
                                                }
                                                const formatQtty = (v: number) => {
                                                    if (v === 0) return '';
                                                    if (isValueGroup || v > 100) return \`\${v.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €\`;
                                                    return Math.round(v).toString();
                                                }
                                                const comisionCalculada = s.groupComisions[gName] || 0;

                                                return (
                                                    <tr className="table-row-hover" key={gName} style={{ 
                                                        backgroundColor: rowBg, 
                                                        borderBottom: '1px solid rgba(255,255,255,0.05)', 
                                                        transition: 'all 0.2s',
                                                        backdropFilter: 'blur(4px)'
                                                    }}>
                                                        <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 800, color: textColor, minWidth: 160 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                {gName} 
                                                                <span style={{opacity: 0.5, fontSize: 10, background: 'rgba(255,255,255,0.1)', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>?</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 18, fontWeight: 900, color: '#38bdf8', textShadow: '0 0 10px rgba(56,189,248,0.5)' }}>
                                                            {formatQtty(qtty)}
                                                        </td>
                                                        <td style={{ padding: '12px 14px', width: '30%' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                                                                <span>{format(obj1)}</span>
                                                                <span>{format(obj2)}</span>
                                                            </div>
                                                            <div style={{ position: 'relative', backgroundColor: 'rgba(0,0,0,0.4)', height: 10, borderRadius: 5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                                                <div style={{ width: \`\${percent}%\`, height: '100%', background: barColor, transition: 'width 0.5s ease', boxShadow: '0 0 10px rgba(0,0,0,0.5)', borderRadius: 5 }} />
                                                                {obj1Percent > 0 && obj1Percent < 100 && (
                                                                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: \`\${obj1Percent}%\`, width: 2, backgroundColor: 'rgba(255,255,255,0.9)', boxShadow: '0 0 6px rgba(255,255,255,0.8)', zIndex: 1 }} title="Objetivo 1" />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                                                                {falt1 > 0 ? (
                                                                    <div style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)' }}>Meta A: {format(falt1)}</div>
                                                                ) : <div style={{ color: '#34d399', fontSize: 11, fontWeight: 800 }}>✓ Meta A</div>}
                                                                
                                                                {falt2 > 0 ? (
                                                                    <div style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)' }}>Meta B: {format(falt2)}</div>
                                                                ) : <div style={{ color: '#34d399', fontSize: 11, fontWeight: 800 }}>✓ Meta B</div>}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 18, fontWeight: 900, color: '#34d399', textShadow: '0 0 10px rgba(52,211,153,0.3)' }}>
                                                            {Math.round(comisionCalculada).toLocaleString('es-ES')} €
                                                        </td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                            <div style={{ 
                                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                backgroundColor: \`\${stateColor}20\`, 
                                                                color: stateColor, 
                                                                padding: '6px 12px', 
                                                                borderRadius: 20, 
                                                                fontSize: 11, 
                                                                fontWeight: 800,
                                                                border: \`1px solid \${stateColor}50\`,
                                                                letterSpacing: '0.5px'
                                                            }}>
                                                                {stateLabel === 'CONSEGUIDO' ? '✓' : (stateLabel === 'SIN VENTAS' ? '!' : (stateLabel === 'SIN OBJETIVO' ? '-' : '⏳'))} {stateLabel}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )`;

code = code.replace(replaceRowMap, newRowMap);

// Replace extra groups
const replaceExtras = `{s.extraGroups && s.extraGroups.length > 0 && s.extraGroups.map((eg: any, idx: number) => (
                                                <tr className="table-row-hover" key={\`extra-\${idx}\`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(16, 185, 129, 0.05)', transition: 'background 0.2s' }}>
                                                    <td colSpan={2} style={{ padding: '6px 4px', fontSize: 12, fontWeight: 700, color: '#10b981' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={12} /> {eg.name}</span>
                                                    </td>
                                                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                                                        {eg.count}
                                                    </td>
                                                    <td colSpan={2} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 13, color: '#10b981' }}>
                                                        -
                                                    </td>
                                                    <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: '#34d399' }}>
                                                        {Math.round(eg.totalAmount).toLocaleString('es-ES')} €
                                                    </td>
                                                </tr>
                                            ))}`;

const newExtras = `{s.extraGroups && s.extraGroups.length > 0 && s.extraGroups.map((eg: any, idx: number) => (
                                                <tr className="table-row-hover" key={\`extra-\${idx}\`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(16, 185, 129, 0.1)', transition: 'background 0.2s', backdropFilter: 'blur(4px)' }}>
                                                    <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Trophy size={16} color="#10b981" /> {eg.name}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 18, fontWeight: 900, color: '#10b981', textShadow: '0 0 10px rgba(16,185,129,0.5)' }}>
                                                        {eg.count}
                                                    </td>
                                                    <td colSpan={2} style={{ padding: '12px 14px', textAlign: 'center', fontSize: 13, color: '#10b981', opacity: 0.5 }}>
                                                        N/A
                                                    </td>
                                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: 18, fontWeight: 900, color: '#34d399', textShadow: '0 0 10px rgba(52,211,153,0.3)' }}>
                                                        {Math.round(eg.totalAmount).toLocaleString('es-ES')} €
                                                    </td>
                                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                        <div style={{ 
                                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                                backgroundColor: 'rgba(16, 185, 129, 0.2)', 
                                                                color: '#10b981', 
                                                                padding: '6px 12px', 
                                                                borderRadius: 20, 
                                                                fontSize: 11, 
                                                                fontWeight: 800,
                                                                border: '1px solid rgba(16,185,129,0.5)',
                                                                letterSpacing: '0.5px'
                                                            }}>
                                                                ✓ EXTRA
                                                            </div>
                                                    </td>
                                                </tr>
                                            ))}`;

code = code.replace(replaceExtras, newExtras);

fs.writeFileSync(path, code);
console.log('Premium styling applied.');
