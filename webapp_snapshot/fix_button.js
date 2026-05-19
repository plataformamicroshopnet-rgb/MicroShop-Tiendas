const fs = require('fs');
let content = fs.readFileSync('src/app/operaciones/page.tsx', 'utf8');

content = content.replace(/<button onClick=\{\(\) => startEdit\(sale\)\} style=\{\{ background: 'transparent', border: '1px solid var\(--border-color\)', color: '#333333', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' \}\} title="Editar">/g, 
`<button onClick={() => startEdit(sale)} style={{ background: '#FFFFFF', border: '1px solid #0078D4', color: '#0078D4', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Editar">`);

fs.writeFileSync('src/app/operaciones/page.tsx', content, 'utf8');
