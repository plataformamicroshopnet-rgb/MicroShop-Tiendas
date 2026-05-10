import fs from 'fs';
let file = fs.readFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'utf8');

file = file.replace(/weekVts \+= ent\.ventas \|\| 0/g, 'weekCampanas += ent.campanas || 0');
file = file.replace(/weekVis \+= ent\.visitas \|\| 0/g, 'weekClientes += ent.clientesPropios || 0');
file = file.replace(/weekTms \+= ent\.teams \|\| 0/g, 'weekDisp += ent.dispositivos || 0');
file = file.replace(/weekDms \+= ent\.demos \|\| 0/g, 'weekBaf += ent.baf || 0; weekRepos += ent.repos || 0; weekBdSalva += ent.bdSalva || 0; weekComp += ent.competencia || 0');

file = file.replace(/Total Acumulado: V: \$\{weekVts\}  📞: \$\{weekVis\}  💻: \$\{weekTms\}  📺: \$\{weekDms\}/g, 'Total Acumulado: C: ${weekCampanas} | CP: ${weekClientes} | D: ${weekDisp} | B: ${weekBaf} | R: ${weekRepos} | BD: ${weekBdSalva} | CO: ${weekComp}');

fs.writeFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', file);
