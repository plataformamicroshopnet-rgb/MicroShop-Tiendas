import fs from 'fs';

let file = fs.readFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'utf8');

// 1. Component Name and API Endpoints
file = file.replace(/export default function AgendaPage\(\)/g, 'export default function AgendaCristinaPage()');
file = file.replace(/\/api\/agenda/g, '/api/agenda-cristina');
file = file.replace(/Agenda Comercial Salva/g, 'Agenda de Llamadas Cristina');
file = file.replace(/Agenda_Comercial_/g, 'Agenda_Llamadas_Cristina_');

// 2. Comerciales Filtering Logic
// Find where setComerciales is, and insert the derived variable logic before currentWeekStart
file = file.replace(/const \[loading, setLoading\] = useState\(true\)/g, "const [loading, setLoading] = useState(true)\n\n    const cristinaComerciales = comerciales.filter(c => !c.name.toLowerCase().includes('salva')).map(c => { if (c.name.toLowerCase().includes('cristina')) return { ...c, team: 'Jefa de Llamadas' }; return c; });");

file = file.replace(/comerciales\.forEach/g, 'cristinaComerciales.forEach');
file = file.replace(/comerciales\.map/g, 'cristinaComerciales.map');
file = file.replace(/comerciales\.length/g, 'cristinaComerciales.length');
file = file.replace(/Array\.isArray\(comerciales\)/g, 'Array.isArray(cristinaComerciales)');

// 3. Edit Form State
file = file.replace(/const \[editForm, setEditForm\] = useState\(\{ ventas: 0, visitas: 0, teams: 0, demos: 0, estado: 'ACTIVO', observaciones: '' \}\)/g, "const [editForm, setEditForm] = useState({ campanas: 0, clientesPropios: 0, dispositivos: 0, baf: 0, repos: 0, bdSalva: 0, competencia: 0, estado: 'ACTIVO', observaciones: '' })");

file = file.replace(/ventas: exist\?\.ventas \|\| 0,\r?\n\s*visitas: exist\?\.visitas \|\| 0,\r?\n\s*teams: exist\?\.teams \|\| 0,\r?\n\s*demos: exist\?\.demos \|\| 0,/g, 'campanas: exist?.campanas || 0, clientesPropios: exist?.clientesPropios || 0, dispositivos: exist?.dispositivos || 0, baf: exist?.baf || 0, repos: exist?.repos || 0, bdSalva: exist?.bdSalva || 0, competencia: exist?.competencia || 0,');

file = file.replace(/ventas: editForm\.ventas,\r?\n\s*visitas: editForm\.visitas,\r?\n\s*teams: editForm\.teams,\r?\n\s*demos: editForm\.demos,/g, 'campanas: editForm.campanas, clientesPropios: editForm.clientesPropios, dispositivos: editForm.dispositivos, baf: editForm.baf, repos: editForm.repos, bdSalva: editForm.bdSalva, competencia: editForm.competencia,');

// 4. Weekly Iterators
file = file.replace(/let weekVts = 0, weekVis = 0, weekTms = 0, weekDms = 0;?/g, 'let weekCampanas=0, weekClientes=0, weekDisp=0, weekBaf=0, weekRepos=0, weekBdSalva=0, weekComp=0;');

file = file.replace(/weekVts \+= ent\.ventas \|\| 0;\r?\n\s*weekVis \+= ent\.visitas \|\| 0;\r?\n\s*weekTms \+= ent\.teams \|\| 0;\r?\n\s*weekDms \+= ent\.demos \|\| 0;/g, 'weekCampanas += ent.campanas || 0; weekClientes += ent.clientesPropios || 0; weekDisp += ent.dispositivos || 0; weekBaf += ent.baf || 0; weekRepos += ent.repos || 0; weekBdSalva += ent.bdSalva || 0; weekComp += ent.competencia || 0;');

file = file.replace(/weekVts \+= entries\[k\]\.ventas \|\| 0;\r?\n\s*weekVis \+= entries\[k\]\.visitas \|\| 0;\r?\n\s*weekTms \+= entries\[k\]\.teams \|\| 0;\r?\n\s*weekDms \+= entries\[k\]\.demos \|\| 0;/g, 'weekCampanas += entries[k].campanas || 0; weekClientes += entries[k].clientesPropios || 0; weekDisp += entries[k].dispositivos || 0; weekBaf += entries[k].baf || 0; weekRepos += entries[k].repos || 0; weekBdSalva += entries[k].bdSalva || 0; weekComp += entries[k].competencia || 0;');

// 5. HTML Table Render
file = file.replace(/const hasData = \(ent\.ventas > 0 \|\| ent\.visitas > 0 \|\| ent\.teams > 0 \|\| \(ent\.demos && ent\.demos > 0\)\);/g, 'const hasData = (ent.campanas > 0 || ent.clientesPropios > 0 || ent.dispositivos > 0 || ent.baf > 0 || ent.repos > 0 || ent.bdSalva > 0 || ent.competencia > 0);');

file = file.replace(/if \(ent\.ventas > 0\) cellHTML \+= `<span[^>]*>V: \$\{ent\.ventas\}<\/span>`;\r?\n\s*if \(ent\.visitas > 0\) cellHTML \+= `<span[^>]*>Lla: \$\{ent\.visitas\}<\/span>`;\r?\n\s*if \(ent\.teams > 0\) cellHTML \+= `<span[^>]*>MLP: \$\{ent\.teams\}<\/span>`;\r?\n\s*if \(ent\.demos > 0\) cellHTML \+= `<span[^>]*>D: \$\{ent\.demos\}<\/span>`;/g, "if (ent.campanas > 0) cellHTML += `<span style=\"color:#10b981; margin-right:4px; background: rgba(16,185,129,0.1); padding: 2px 4px; border-radius: 4px;\">C: ${ent.campanas}</span>`; if (ent.clientesPropios > 0) cellHTML += `<span style=\"color:#0ea5e9; margin-right:4px; background: rgba(14,165,233,0.1); padding: 2px 4px; border-radius: 4px;\">CP: ${ent.clientesPropios}</span>`; if (ent.dispositivos > 0) cellHTML += `<span style=\"color:#8b5cf6; margin-right:4px; background: rgba(139,92,246,0.1); padding: 2px 4px; border-radius: 4px;\">D: ${ent.dispositivos}</span>`; if (ent.baf > 0) cellHTML += `<span style=\"color:#f59e0b; margin-right:4px; background: rgba(245,158,11,0.1); padding: 2px 4px; border-radius: 4px;\">B: ${ent.baf}</span>`; if (ent.repos > 0) cellHTML += `<span style=\"color:#ec4899; margin-right:4px; background: rgba(236,72,153,0.1); padding: 2px 4px; border-radius: 4px;\">R: ${ent.repos}</span>`; if (ent.bdSalva > 0) cellHTML += `<span style=\"color:#ef4444; margin-right:4px; background: rgba(239,68,68,0.1); padding: 2px 4px; border-radius: 4px;\">BD: ${ent.bdSalva}</span>`; if (ent.competencia > 0) cellHTML += `<span style=\"color:#3f6212; background: rgba(63,98,18,0.1); padding: 2px 4px; border-radius: 4px;\">CO: ${ent.competencia}</span>`;");

file = file.replace(/V: \$\{weekCampanas\} &nbsp;\|&nbsp; Lla: \$\{weekClientes\} &nbsp;\|&nbsp; MLP: \$\{weekDisp\} &nbsp;\|&nbsp; D: \$\{weekBaf\}/g, 'C: ${weekCampanas} | CP: ${weekClientes} | D: ${weekDisp} | B: ${weekBaf} | R: ${weekRepos} | BD: ${weekBdSalva} | CO: ${weekComp}');
file = file.replace(/V: \$\{weekVts\} &nbsp;\|&nbsp; Lla: \$\{weekVis\} &nbsp;\|&nbsp; MLP: \$\{weekTms\} &nbsp;\|&nbsp; D: \$\{weekDms\}/g, 'C: ${weekCampanas} | CP: ${weekClientes} | D: ${weekDisp} | B: ${weekBaf} | R: ${weekRepos} | BD: ${weekBdSalva} | CO: ${weekComp}');

// 6. JSX Table Render
file = file.replace(/const hasData = ventas > 0 \|\| visitas > 0 \|\| teams > 0 \|\| demos > 0;/g, 'const hasData = (ent.campanas > 0 || ent.clientesPropios > 0 || ent.dispositivos > 0 || ent.baf > 0 || ent.repos > 0 || ent.bdSalva > 0 || ent.competencia > 0);');

file = file.replace(/const renderCellContent = \(estado: string, ventas: number, visitas: number, teams: number, demos: number, obj\?: string\) => \{/g, 'const renderCellContent = (estado: string, ent: any, obj?: string) => {');

// The JSX for cell inside renderCellContent
file = file.replace(/\{ventas > 0 && <span[^>]*>💼 \{ventas\}<\/span>\}\r?\n\s*\{visitas > 0 && <span[^>]*>📞 \{visitas\}<\/span>\}\r?\n\s*\{teams > 0 && <span[^>]*>💻 \{teams\}<\/span>\}\r?\n\s*\{demos > 0 && <span[^>]*>📺 \{demos\}<\/span>\}/g, "{ent.campanas > 0 && <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>🎯 {ent.campanas}</span>}\n                        {ent.clientesPropios > 0 && <span style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>📞 {ent.clientesPropios}</span>}\n                        {ent.dispositivos > 0 && <span style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>💻 {ent.dispositivos}</span>}\n                        {ent.baf > 0 && <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>📺 {ent.baf}</span>}\n                        {ent.repos > 0 && <span style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>📦 {ent.repos}</span>}\n                        {ent.bdSalva > 0 && <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>🗃️ {ent.bdSalva}</span>}\n                        {ent.competencia > 0 && <span style={{ background: 'rgba(63, 98, 18, 0.1)', color: '#3f6212', padding: '2px 4px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>⚔️ {ent.competencia}</span>}");

file = file.replace(/renderCellContent\(ent\.estado, ent\.ventas, ent\.visitas, ent\.teams, ent\.demos \|\| 0, ent\.observaciones\)/g, 'renderCellContent(ent.estado, ent, ent.observaciones)');

// The span group in the Commercial card
file = file.replace(/<span>💼 \{weekVts\}<\/span>\r?\n\s*<span>📞 \{weekVis\}<\/span>\r?\n\s*<span>💻 \{weekTms\}<\/span>\r?\n\s*<span>📺 \{weekDms\}<\/span>/g, '<span title="Campañas">🎯 {weekCampanas}</span><span title="Cl. Propios">📞 {weekClientes}</span><span title="Disp">💻 {weekDisp}</span><span title="BAF">📺 {weekBaf}</span><span title="Repos">📦 {weekRepos}</span><span title="BD">🗃️ {weekBdSalva}</span><span title="Comp">⚔️ {weekComp}</span>');

// 7. Modal Edit Fields
file = file.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 \}\}>[\s\S]*?<\/div>\s*<\/div>\s*\)\}/, `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 6 }}>🎯 Campañas</label>
                                        <input type="number" min="0" value={editForm.campanas === 0 ? '' : editForm.campanas} placeholder="0" onChange={e => setEditForm({...editForm, campanas: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#0ea5e9', marginBottom: 6 }}>📞 Cl. Propios</label>
                                        <input type="number" min="0" value={editForm.clientesPropios === 0 ? '' : editForm.clientesPropios} placeholder="0" onChange={e => setEditForm({...editForm, clientesPropios: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 6 }}>💻 Dispositivos</label>
                                        <input type="number" min="0" value={editForm.dispositivos === 0 ? '' : editForm.dispositivos} placeholder="0" onChange={e => setEditForm({...editForm, dispositivos: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>📺 BAF</label>
                                        <input type="number" min="0" value={editForm.baf === 0 ? '' : editForm.baf} placeholder="0" onChange={e => setEditForm({...editForm, baf: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#ec4899', marginBottom: 6 }}>📦 Repos</label>
                                        <input type="number" min="0" value={editForm.repos === 0 ? '' : editForm.repos} placeholder="0" onChange={e => setEditForm({...editForm, repos: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>🗃️ BD Salva</label>
                                        <input type="number" min="0" value={editForm.bdSalva === 0 ? '' : editForm.bdSalva} placeholder="0" onChange={e => setEditForm({...editForm, bdSalva: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#3f6212', marginBottom: 6 }}>⚔️ Competencia</label>
                                        <input type="number" min="0" value={editForm.competencia === 0 ? '' : editForm.competencia} placeholder="0" onChange={e => setEditForm({...editForm, competencia: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border-strong)', fontSize: 14, textAlign: 'center', outline: 'none' }} />
                                    </div>
                                </div>
                            )}`);

// 8. Excel logic
file = file.replace(/const hasData = \(ent\.ventas > 0 \|\| ent\.visitas > 0 \|\| ent\.teams > 0\)/g, 'const hasData = (ent.campanas > 0 || ent.clientesPropios > 0 || ent.dispositivos > 0 || ent.baf > 0 || ent.repos > 0 || ent.bdSalva > 0 || ent.competencia > 0)');
file = file.replace(/if \(hasData\) cellText \+= `Ventas: \$\{ent\.ventas \|\| 0\} \| Llamadas: \$\{ent\.visitas \|\| 0\} \| MLPs: \$\{ent\.teams \|\| 0\} \| Demos: \$\{ent\.demos \|\| 0\}\\n`/g, 'if (hasData) cellText += `C: ${ent.campanas || 0} | CP: ${ent.clientesPropios || 0} | D: ${ent.dispositivos || 0} | B: ${ent.baf || 0} | R: ${ent.repos || 0} | BD: ${ent.bdSalva || 0} | CO: ${ent.competencia || 0}\\n`');

file = file.replace(/Total Acumulado: V: \$\{weekVts\}  \?\?: \$\{weekVis\}  \?\?: \$\{weekTms\}  \?\?: \$\{weekDms\}/g, 'Total Acumulado: C: ${weekCampanas} | CP: ${weekClientes} | D: ${weekDisp} | B: ${weekBaf} | R: ${weekRepos} | BD: ${weekBdSalva} | CO: ${weekComp}');


fs.writeFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', file);
