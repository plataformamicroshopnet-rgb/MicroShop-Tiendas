import fs from 'fs';

function fixEmailHTML(filePath, type) {
    let file = fs.readFileSync(filePath, 'utf8');

    // Make CSS variables hardcoded for Email compatibility inside renderAgendaTableHTML
    // We only replace them inside renderAgendaTableHTML.
    const renderStart = file.indexOf('const renderAgendaTableHTML');
    const renderEnd = file.indexOf('const handlePrint =');
    if (renderStart === -1 || renderEnd === -1) return;

    let before = file.substring(0, renderStart);
    let renderBlock = file.substring(renderStart, renderEnd);
    let after = file.substring(renderEnd);

    renderBlock = renderBlock.replace(/var\(--text-main\)/g, '#111827');
    renderBlock = renderBlock.replace(/var\(--text-muted\)/g, '#6b7280');
    renderBlock = renderBlock.replace(/var\(--border-strong\)/g, '#d1d5db');
    // For the background of the comercial's totals row
    renderBlock = renderBlock.replace(/background: #f3f4f6;/g, 'background: #f3f4f6;');

    if (type === 'salva') {
        renderBlock = renderBlock.replace(
            /if \(ent\.ventas > 0\) cellHTML \+= `<span style="color:#10b981; margin-right:8px; background: rgba\(16,185,129,0\.1\); padding: 2px 4px; border-radius: 4px;">V: \$\{ent\.ventas\}<\/span>`;/g,
            'if (ent.ventas > 0) cellHTML += `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px;">💼 ${ent.ventas}</span>`;'
        );
        renderBlock = renderBlock.replace(
            /if \(ent\.visitas > 0\) cellHTML \+= `<span style="color:#0ea5e9; margin-right:8px; background: rgba\(14,165,233,0\.1\); padding: 2px 4px; border-radius: 4px;">Lla: \$\{ent\.visitas\}<\/span>`;/g,
            'if (ent.visitas > 0) cellHTML += `<span style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px;">📞 ${ent.visitas}</span>`;'
        );
        renderBlock = renderBlock.replace(
            /if \(ent\.teams > 0\) cellHTML \+= `<span style="color:#8b5cf6; background: rgba\(139,92,246,0\.1\); padding: 2px 4px; border-radius: 4px;">MLP: \$\{ent\.teams\}<\/span>`;/g,
            'if (ent.teams > 0) cellHTML += `<span style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px;">💻 ${ent.teams}</span>`;'
        );
        renderBlock = renderBlock.replace(
            /if \(ent\.demos > 0\) cellHTML \+= `<span style="color:#f59e0b; background: rgba\(245,158,11,0\.1\); padding: 2px 4px; border-radius: 4px; margin-left: 8px;">D: \$\{ent\.demos\}<\/span>`;/g,
            'if (ent.demos > 0) cellHTML += `<span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700;">📺 ${ent.demos}</span>`;'
        );
        
        renderBlock = renderBlock.replace(
            /V: \$\{weekVts\} \| Lla: \$\{weekVis\} \| MLP: \$\{weekTms\} \| D: \$\{weekDms\}/g,
            '💼 ${weekVts} &nbsp;|&nbsp; 📞 ${weekVis} &nbsp;|&nbsp; 💻 ${weekTms} &nbsp;|&nbsp; 📺 ${weekDms}'
        );
    } else if (type === 'cristina') {
        renderBlock = renderBlock.replace(
            /if \(ent\.campanas > 0\) cellHTML \+= `<span[^>]*>C: \$\{ent\.campanas\}<\/span>`;/g,
            'if (ent.campanas > 0) cellHTML += `<span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">🎯 ${ent.campanas}</span>`;'
        );
        renderBlock = renderBlock.replace(
            /if \(ent\.clientesPropios > 0\) cellHTML \+= `<span[^>]*>CP: \$\{ent\.clientesPropios\}<\/span>`;/g,
            'if (ent.clientesPropios > 0) cellHTML += `<span style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">📞 ${ent.clientesPropios}</span>`;'
        );
        renderBlock = renderBlock.replace(
            /if \(ent\.dispositivos > 0\) cellHTML \+= `<span[^>]*>D: \$\{ent\.dispositivos\}<\/span>`;/g,
            'if (ent.dispositivos > 0) cellHTML += `<span style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">💻 ${ent.dispositivos}</span>`;'
        );
        renderBlock = renderBlock.replace(
            /if \(ent\.baf > 0\) cellHTML \+= `<span[^>]*>B: \$\{ent\.baf\}<\/span>`;/g,
            'if (ent.baf > 0) cellHTML += `<span style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">📺 ${ent.baf}</span>`;'
        );
        renderBlock = renderBlock.replace(
            /if \(ent\.repos > 0\) cellHTML \+= `<span[^>]*>R: \$\{ent\.repos\}<\/span>`;/g,
            'if (ent.repos > 0) cellHTML += `<span style="background: rgba(236, 72, 153, 0.1); color: #ec4899; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">📦 ${ent.repos}</span>`;'
        );
        renderBlock = renderBlock.replace(
            /if \(ent\.bdSalva > 0\) cellHTML \+= `<span[^>]*>BD: \$\{ent\.bdSalva\}<\/span>`;/g,
            'if (ent.bdSalva > 0) cellHTML += `<span style="background: rgba(239, 68, 68, 0.1); color: #ef4444; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-right: 4px; display: inline-block; margin-bottom: 2px;">🗃️ ${ent.bdSalva}</span>`;'
        );
        renderBlock = renderBlock.replace(
            /if \(ent\.competencia > 0\) cellHTML \+= `<span[^>]*>CO: \$\{ent\.competencia\}<\/span>`;/g,
            'if (ent.competencia > 0) cellHTML += `<span style="background: rgba(63, 98, 18, 0.1); color: #3f6212; padding: 2px 4px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; margin-bottom: 2px;">⚔️ ${ent.competencia}</span>`;'
        );

        renderBlock = renderBlock.replace(
            /C: \$\{weekCampanas\} \| CP: \$\{weekClientes\} \| D: \$\{weekDisp\} \| B: \$\{weekBaf\} \| R: \$\{weekRepos\} \| BD: \$\{weekBdSalva\} \| CO: \$\{weekComp\}/g,
            '🎯 ${weekCampanas} &nbsp;|&nbsp; 📞 ${weekClientes} &nbsp;|&nbsp; 💻 ${weekDisp} &nbsp;|&nbsp; 📺 ${weekBaf} &nbsp;|&nbsp; 📦 ${weekRepos} &nbsp;|&nbsp; 🗃️ ${weekBdSalva} &nbsp;|&nbsp; ⚔️ ${weekComp}'
        );
    }

    file = before + renderBlock + after;
    fs.writeFileSync(filePath, file);
}

fixEmailHTML('src/app/seguimiento-ventas/agenda/page.tsx', 'salva');
fixEmailHTML('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'cristina');

