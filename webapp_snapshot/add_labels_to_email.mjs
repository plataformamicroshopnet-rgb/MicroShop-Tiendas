import fs from 'fs';

function addLabelsToEmail(filePath, type) {
    let file = fs.readFileSync(filePath, 'utf8');

    const renderStart = file.indexOf('const renderAgendaTableHTML');
    const renderEnd = file.indexOf('const handlePrint =');
    if (renderStart === -1 || renderEnd === -1) return;

    let before = file.substring(0, renderStart);
    let renderBlock = file.substring(renderStart, renderEnd);
    let after = file.substring(renderEnd);

    if (type === 'salva') {
        renderBlock = renderBlock.replace(/💼 \$\{ent\.ventas\}/g, '💼 Ventas: ${ent.ventas}');
        renderBlock = renderBlock.replace(/📞 \$\{ent\.visitas\}/g, '📞 Llamadas: ${ent.visitas}');
        renderBlock = renderBlock.replace(/💻 \$\{ent\.teams\}/g, '💻 MLPs: ${ent.teams}');
        renderBlock = renderBlock.replace(/📺 \$\{ent\.demos\}/g, '📺 Demos: ${ent.demos}');
        
        renderBlock = renderBlock.replace(/💼 \$\{weekVts\}/g, '💼 Ventas: ${weekVts}');
        renderBlock = renderBlock.replace(/📞 \$\{weekVis\}/g, '📞 Llamadas: ${weekVis}');
        renderBlock = renderBlock.replace(/💻 \$\{weekTms\}/g, '💻 MLPs: ${weekTms}');
        renderBlock = renderBlock.replace(/📺 \$\{weekDms\}/g, '📺 Demos: ${weekDms}');
    } else if (type === 'cristina') {
        renderBlock = renderBlock.replace(/🎯 \$\{ent\.campanas\}/g, '🎯 Campañas: ${ent.campanas}');
        renderBlock = renderBlock.replace(/📞 \$\{ent\.clientesPropios\}/g, '📞 Cl. Propios: ${ent.clientesPropios}');
        renderBlock = renderBlock.replace(/💻 \$\{ent\.dispositivos\}/g, '💻 Dispos: ${ent.dispositivos}');
        renderBlock = renderBlock.replace(/📺 \$\{ent\.baf\}/g, '📺 BAF: ${ent.baf}');
        renderBlock = renderBlock.replace(/📦 \$\{ent\.repos\}/g, '📦 Repos: ${ent.repos}');
        renderBlock = renderBlock.replace(/🗃️ \$\{ent\.bdSalva\}/g, '🗃️ BD Salva: ${ent.bdSalva}');
        renderBlock = renderBlock.replace(/⚔️ \$\{ent\.competencia\}/g, '⚔️ Compet.: ${ent.competencia}');

        renderBlock = renderBlock.replace(/🎯 \$\{weekCampanas\}/g, '🎯 Campañas: ${weekCampanas}');
        renderBlock = renderBlock.replace(/📞 \$\{weekClientes\}/g, '📞 Cl. Propios: ${weekClientes}');
        renderBlock = renderBlock.replace(/💻 \$\{weekDisp\}/g, '💻 Dispos: ${weekDisp}');
        renderBlock = renderBlock.replace(/📺 \$\{weekBaf\}/g, '📺 BAF: ${weekBaf}');
        renderBlock = renderBlock.replace(/📦 \$\{weekRepos\}/g, '📦 Repos: ${weekRepos}');
        renderBlock = renderBlock.replace(/🗃️ \$\{weekBdSalva\}/g, '🗃️ BD Salva: ${weekBdSalva}');
        renderBlock = renderBlock.replace(/⚔️ \$\{weekComp\}/g, '⚔️ Compet.: ${weekComp}');
    }

    file = before + renderBlock + after;
    fs.writeFileSync(filePath, file);
}

addLabelsToEmail('src/app/seguimiento-ventas/agenda/page.tsx', 'salva');
addLabelsToEmail('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'cristina');

