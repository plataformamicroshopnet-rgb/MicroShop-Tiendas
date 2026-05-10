import fs from 'fs';
let file = fs.readFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'utf8');

// Change the header font sizes to match the screenshot
file = file.replace(/<h3 style=\{\{ margin: 0, fontSize: 16 \}\}>\{editingCell\.nombre\}<\/h3>/g, '<h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{editingCell.nombre}</h3>');
file = file.replace(/<div style=\{\{ fontSize: 12, opacity: 0\.9 \}\}>\{formatDisplayDate\(editingCell\.fecha\)\}<\/div>/g, '<div style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{formatDisplayDate(editingCell.fecha)}</div>');

// Replace all occurrences of --mercedes-cyan with the requested blue color #0ea5e9
file = file.replace(/var\(--mercedes-cyan\)/g, '#0ea5e9');

fs.writeFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', file);
