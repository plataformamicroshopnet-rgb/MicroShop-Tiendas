const fs = require('fs');
let file = fs.readFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'utf8');

file = file.replace(/weekVts/g, 'weekCampanas');
file = file.replace(/weekVis/g, 'weekClientes');
file = file.replace(/weekTms/g, 'weekDisp');
file = file.replace(/weekDms/g, 'weekBaf');

fs.writeFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', file);
