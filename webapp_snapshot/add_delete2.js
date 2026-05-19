const fs = require('fs');

let content = fs.readFileSync('src/app/operaciones/page.tsx', 'utf8');

// 1. Add deleteExtra function
const target1 = /    } catch \(error\) \{\s*alert\('Error de conexión'\)\s*\}\s*\}/;

const replacement1 = `    } catch (error) {
       alert('Error de conexión')
    }
  }

  const deleteExtra = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este extra permanentemente?')) return;
    try {
      const res = await fetch(\`/api/extras/assignments?id=\${id}\`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        fetchSales() // Reload
      } else {
        alert(data.error || 'Error al eliminar. Puede que no tengas permisos.')
      }
    } catch (error) {
       alert('Error de conexión')
    }
  }`;

content = content.replace(target1, replacement1);

// 2. Add button
const target2 = /<td style=\{\{ padding: '4px 6px', color: '#059669', fontSize: 12 \}\}>\S*<\/td>\s*<\/tr>\s*\}\}\)\)/g;

const replacement2 = `<td style={{ padding: '4px 6px', textAlign: 'center' }}>
                     <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                       {canCancel && (
                         <button onClick={() => deleteExtra(ex.id)} style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#EF4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Eliminar Extra">
                           <Trash2 size={12} />
                         </button>
                       )}
                     </div>
                  </td>
                </tr>
              ))}`;

content = content.replace(target2, replacement2);

fs.writeFileSync('src/app/operaciones/page.tsx', content, 'utf8');
console.log('Done');
