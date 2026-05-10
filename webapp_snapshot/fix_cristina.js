const fs = require('fs');
let file = fs.readFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'utf8');

// Inject cristinaComerciales
file = file.replace(/const \[currentWeekStart, setCurrentWeekStart\] = useState/, "const cristinaComerciales = comerciales.filter(c => !c.name.toLowerCase().includes('salva')).map(c => { if (c.name.toLowerCase().includes('cristina')) return { ...c, team: 'Jefa de Llamadas' }; return c; });\n    const [currentWeekStart, setCurrentWeekStart] = useState");

// Replace mapping iterators properly since earlier attempt might have been wiped or partially done
file = file.replace(/comerciales\.map\(/g, 'cristinaComerciales.map(');
file = file.replace(/comerciales\.length/g, 'cristinaComerciales.length');
file = file.replace(/Array\.isArray\(comerciales\)/g, 'Array.isArray(cristinaComerciales)');

// Fix weekVts in HTML and Excel
file = file.replace(/weekVts \+= ent\.ventas \|\| 0;/g, 'weekCampanas += ent.campanas || 0; weekClientes += ent.clientesPropios || 0; weekDisp += ent.dispositivos || 0; weekBaf += ent.baf || 0; weekRepos += ent.repos || 0; weekBdSalva += ent.bdSalva || 0; weekComp += ent.competencia || 0;');
file = file.replace(/weekVis \+= ent\.visitas \|\| 0;/g, '');
file = file.replace(/weekTms \+= ent\.teams \|\| 0;/g, '');
file = file.replace(/weekDms \+= ent\.demos \|\| 0;/g, '');

// Fix summary underneath name
file = file.replace(/<span>\?\? \{weekVts\}<\/span>/g, '<span title="Campañas">🎯 {weekCampanas}</span>');

file = file.replace(/let weekVts = 0, weekVis = 0, weekTms = 0, weekDms = 0;?/g, 'let weekCampanas=0, weekClientes=0, weekDisp=0, weekBaf=0, weekRepos=0, weekBdSalva=0, weekComp=0;');

fs.writeFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', file);
