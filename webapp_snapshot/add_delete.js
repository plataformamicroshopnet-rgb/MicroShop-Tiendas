const fs = require('fs');

let content = fs.readFileSync('src/app/operaciones/page.tsx', 'utf8');

const target1 = `    } catch (error) {
       alert('Error de conexión')
    }
  }`;

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

// Replace only the first occurrence (which is inside OperationsContent near deleteSale)
content = content.replace(target1, replacement1);

const target2 = `<td style={{ padding: '4px 6px', color: '#059669', fontSize: 12 }}></td>
                </tr>
              ))}
            </tbody>`;

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
              ))}
            </tbody>`;

content = content.replace(target2, replacement2);

fs.writeFileSync('src/app/operaciones/page.tsx', content, 'utf8');
console.log('Done');
