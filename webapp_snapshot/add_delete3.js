const fs = require('fs');

let content = fs.readFileSync('src/app/operaciones/page.tsx', 'utf8');

const targetRegex = /<td style=\{\{ padding: '4px 6px', color: '#059669', fontSize: 12 \}\}><\/td>/g;
const replacement = `<td style={{ padding: '4px 6px', textAlign: 'center' }}>
                     <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                       {canCancel && (
                         <button onClick={() => deleteExtra(ex.id)} style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#EF4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Eliminar Extra">
                           <Trash2 size={12} />
                         </button>
                       )}
                     </div>
                  </td>`;

content = content.replace(targetRegex, replacement);

fs.writeFileSync('src/app/operaciones/page.tsx', content, 'utf8');
console.log('Done');
