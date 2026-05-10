import fs from 'fs';

function applyMailModal(filePath) {
    let file = fs.readFileSync(filePath, 'utf8');

    // 1. Add state
    if (!file.includes('showMailModal')) {
        file = file.replace(/const \[saving, setSaving\] = useState\(false\)/, "const [saving, setSaving] = useState(false)\n    const [showMailModal, setShowMailModal] = useState(false)\n    const [selectedMailDays, setSelectedMailDays] = useState<string[]>([])");
        // If it doesn't match exactly because Agenda Cristina doesn't have saving defined in the same place?
        // Let's check where to inject.
    }

    // 2. Modify renderAgendaTableHTML signature
    file = file.replace(/const renderAgendaTableHTML = \(\) => \{/g, 'const renderAgendaTableHTML = (daysToRender: Date[] = weekDays) => {');
    
    // Replace weekDays with daysToRender INSIDE renderAgendaTableHTML
    // We can do this by splitting the string at `const renderAgendaTableHTML` and `const handlePrint = () => {`
    const renderStart = file.indexOf('const renderAgendaTableHTML');
    const renderEnd = file.indexOf('const handlePrint = () => {');
    
    if (renderStart !== -1 && renderEnd !== -1) {
        let before = file.substring(0, renderStart);
        let renderBlock = file.substring(renderStart, renderEnd);
        let after = file.substring(renderEnd);

        // Replace weekDays with daysToRender ONLY inside renderBlock
        // Except for the first line `Semana: ${formatDisplayDate(weekDays[0])}` which is fine or maybe daysToRender[0]
        renderBlock = renderBlock.replace(/weekDays\.map/g, 'daysToRender.map');
        renderBlock = renderBlock.replace(/weekDays\.forEach/g, 'daysToRender.forEach');
        renderBlock = renderBlock.replace(/weekDays\[0\]/g, 'daysToRender[0]');
        renderBlock = renderBlock.replace(/weekDays\[weekDays\.length \- 1\]/g, 'daysToRender[daysToRender.length - 1]');
        
        file = before + renderBlock + after;
    }

    // 3. Update handlePrint to pass weekDays
    file = file.replace(/const html = renderAgendaTableHTML\(\)/g, 'const html = renderAgendaTableHTML(weekDays)');

    // 4. Update handleMail to be openMailModal
    file = file.replace(/const handleMail = \(\) => \{[\s\S]*?w\.document\.close\(\)\r?\n\s*\}\r?\n\s*\}/, `const handleMail = () => {
        if (!can(user, 'SEND_EMAIL')) return alert('No tienes permisos para usar esta función.')
        setSelectedMailDays(weekDays.map(d => formatDate(d)))
        setShowMailModal(true)
    }

    const confirmMail = () => {
        const daysToRender = weekDays.filter(d => selectedMailDays.includes(formatDate(d)));
        if (daysToRender.length === 0) return alert('Selecciona al menos un día.');
        
        const html = renderAgendaTableHTML(daysToRender)
        const w = window.open('', '_blank', 'width=1000,height=800')
        if (w) {
            w.document.write(\`
                <html><head><title>Copiado de Agenda</title></head>
                <body style="font-family:sans-serif; padding: 20px;">
                    <div id="status-banner" style="background:#fef3c7; border: 1px solid #f59e0b; color:#92400e; padding:16px; margin-bottom:24px; border-radius:8px; text-align:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                        <h3 style="margin:0 0 8px 0;">Copiando tabla mágica...</h3>
                        <p style="margin:0; font-weight:normal;">Procesando el portapapeles en segundo plano...</p>
                    </div>
                    <div id="agenda-table-html">
                        \${html}
                    </div>
                    <script>
                        window.onload = async () => {
                            const tableBlock = document.getElementById('agenda-table-html');
                            const banner = document.getElementById('status-banner');
                            
                            const range = document.createRange();
                            range.selectNodeContents(tableBlock);
                            window.getSelection().removeAllRanges();
                            window.getSelection().addRange(range);

                            try {
                                const type = "text/html";
                                const blob = new Blob([tableBlock.innerHTML], { type });
                                const data = [new ClipboardItem({ [type]: blob })];
                                await navigator.clipboard.write(data);
                                banner.innerHTML = "<h3 style='margin:0 0 8px 0'>✅ Copiado Automáticamente</h3><p style='margin:0; font-weight:normal'>Agenda lista para pegar en correo → abre Outlook y pulsa <b>CTRL+V</b>.</p>";
                                banner.style.background = "#dcfce3";
                                banner.style.color = "#166534";
                                banner.style.borderColor = "#22c55e";
                            } catch (err) {
                                try {
                                    document.execCommand('copy');
                                    banner.innerHTML = "<h3 style='margin:0 0 8px 0'>✅ Copiado Automático</h3><p style='margin:0; font-weight:normal'>Agenda lista para pegar en correo → abre Outlook y pulsa <b>CTRL+V</b>.</p>";
                                    banner.style.background = "#dcfce3";
                                    banner.style.color = "#166534";
                                    banner.style.borderColor = "#22c55e";
                                } catch(e) {
                                    banner.innerHTML = "<h3 style='margin:0 0 8px 0'>⚠️ Requiere Copia Manual</h3><p style='margin:0; font-weight:normal'>El navegador bloqueó la copia silenciosa. Pulsa <b>CTRL+C</b> para copiar la selección activada, luego abre Outlook y pégalo <b>(CTRL+V)</b>.</p>";
                                }
                            }
                        }
                    </script>
                </body></html>
            \`)
            w.document.close()
            setShowMailModal(false)
        }
    }`);

    // 5. Add Modal JSX at the end of the file before the final </div>)
    const modalJSX = `
            {showMailModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card" style={{ width: 320, background: 'var(--bg-card)', borderRadius: 12, padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ padding: '16px 20px', background: 'var(--mercedes-cyan)', color: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>Configurar Envío Mail</h3>
                            <button onClick={() => setShowMailModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--bg-card)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: 20 }}>
                            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--text-muted)' }}>Selecciona qué días quieres incluir en la tabla del correo:</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {weekDays.map(d => {
                                    const dateStr = formatDate(d);
                                    const isSelected = selectedMailDays.includes(dateStr);
                                    return (
                                        <label key={dateStr} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', background: isSelected ? 'var(--active-bg)' : 'transparent', border: '1px solid', borderColor: isSelected ? 'var(--mercedes-cyan)' : 'var(--border-strong)', borderRadius: 6, transition: 'all 0.2s' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedMailDays(prev => [...prev, dateStr].sort());
                                                    else setSelectedMailDays(prev => prev.filter(x => x !== dateStr));
                                                }}
                                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                                            />
                                            <span style={{ fontSize: 14, fontWeight: isSelected ? 700 : 500, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                                                {d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                        <div style={{ padding: '12px 20px', background: 'var(--active-bg)', borderTop: '1px solid var(--border-strong)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button onClick={() => setShowMailModal(false)} style={{ background: 'transparent', border: 'none', color: '#4b5563', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={confirmMail} style={{ background: 'var(--mercedes-cyan)', border: 'none', color: 'var(--bg-card)', fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Mail size={16} /> Generar y Copiar
                            </button>
                        </div>
                    </div>
                </div>
            )}
    `;

    // Inject before the final </div>)
    const lastDivIndex = file.lastIndexOf('</div>\n    )');
    if (lastDivIndex !== -1 && !file.includes('showMailModal &&')) {
        file = file.substring(0, lastDivIndex) + modalJSX + file.substring(lastDivIndex);
    } else {
        const fallbackIndex = file.lastIndexOf('</div>');
        if (!file.includes('showMailModal &&')) {
            file = file.substring(0, fallbackIndex) + modalJSX + file.substring(fallbackIndex);
        }
    }

    fs.writeFileSync(filePath, file);
}

// Ensure state is injected correctly by finding 'const [loading, setLoading]'
function injectState(filePath) {
    let file = fs.readFileSync(filePath, 'utf8');
    if (!file.includes('showMailModal')) {
        file = file.replace(/const \[loading, setLoading\] = useState\(true\)/, "const [loading, setLoading] = useState(true)\n    const [showMailModal, setShowMailModal] = useState(false)\n    const [selectedMailDays, setSelectedMailDays] = useState<string[]>([])");
        fs.writeFileSync(filePath, file);
    }
}

injectState('src/app/seguimiento-ventas/agenda/page.tsx');
injectState('src/app/seguimiento-ventas/agenda-cristina/page.tsx');

applyMailModal('src/app/seguimiento-ventas/agenda/page.tsx');
applyMailModal('src/app/seguimiento-ventas/agenda-cristina/page.tsx');

