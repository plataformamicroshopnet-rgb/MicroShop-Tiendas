import fs from 'fs';
let file = fs.readFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'utf8');

file = file.replace(/💻 Dispositivos/g, '💻 Dispos');
file = file.replace(/⚔️ Competencia/g, '⚔️ Compet.');

fs.writeFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', file);
