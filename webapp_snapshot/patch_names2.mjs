import fs from 'fs';
let file = fs.readFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'utf8');

file = file.replace(/Dispositivos/g, 'Dispos');
file = file.replace(/Competencia/g, 'Compet.');

// Also fix the case where Competencia became Compet. in object keys by mistake if any
// (It shouldn't because object keys are 'competencia' lowercase, but just in case)
file = file.replace(/compet\./g, 'competencia');

fs.writeFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', file);
