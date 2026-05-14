const fs = require('fs');
let code = fs.readFileSync('src/app/cristina-admin/gastos/page.tsx', 'utf8');

// 1. Update imports
code = code.replace(/import { Receipt, ArrowLeft, Download, Plus, Save, TrendingUp, X, Filter, BarChart2, Table as TableIcon } from 'lucide-react'/, 
  "import { Receipt, ArrowLeft, Download, Plus, Save, TrendingUp, X, Filter, BarChart2, Table as TableIcon, Edit2, Trash2 } from 'lucide-react'");

// 2. Add state and functions
const stateBlock = `  // State for Expanded Columns
  const [expandedMonths, setExpandedMonths] = useState<number[]>([])

  const toggleMonth = (monthId: number) => {
    setExpandedMonths(prev => 
      prev.includes(monthId) ? prev.filter(m => m !== monthId) : [...prev, monthId]
    )
  }

  // State for Add Row & Edit
  const [showAddRow, setShowAddRow] = useState(false)
  const [newRowGrupo, setNewRowGrupo] = useState('Gastos Fijos')
  const [newRowConcepto, setNewRowConcepto] = useState('')
  
  const [editingConcepto, setEditingConcepto] = useState<{ grupo: string, oldConcepto: string } | null>(null)
  const [newConceptoName, setNewConceptoName] = useState('')

  const handleRenameConcepto = async () => {
    if (!editingConcepto || !newConceptoName.trim() || newConceptoName === editingConcepto.oldConcepto) {
      setEditingConcepto(null)
      return
    }
    const { grupo, oldConcepto } = editingConcepto
    const name = newConceptoName.trim()
    
    // optimistic
    setGastos(prev => prev.map(g => g.grupo === grupo && g.concepto === oldConcepto ? { ...g, concepto: name } : g))
    setEditingConcepto(null)

    try {
      await fetch('/api/gastos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: activeYear, grupo, oldConcepto, newConcepto: name })
      })
    } catch (e) { console.error(e) }
  }

  const handleAddRow = async () => {
    if (!newRowConcepto.trim()) return
    const concepto = newRowConcepto.trim()
    
    const newGasto: any = { id: Math.random().toString(), year: activeYear, month: 1, grupo: newRowGrupo, concepto, importe_c: 0, importe_r: 0, importe_dif: 0, importe_total: 0 }
    setGastos(prev => [...prev, newGasto])
    setShowAddRow(false)
    setNewRowConcepto('')
    
    try {
      await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: activeYear, month: 1, grupo: newRowGrupo, concepto, importe_total: 0 })
      })
    } catch (e) { console.error(e) }
  }`;
  
code = code.replace(/  \/\/ State for Expanded Columns[\s\S]*?  \}/, stateBlock);

// 3. Update table font size
code = code.replace(/fontSize: 13, minWidth: 1000/, "fontSize: 12, minWidth: 1000");

// 4. Update Header Buttons
const headerButtons = `        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={() => setShowAddRow(true)}
            className="btn"
            style={{ padding: '8px 16px', background: '#00C853', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={16} /> Añadir Fila
          </button>
          <button 
            onClick={() => setShowPasteModal(true)}
            className="btn"
            style={{ padding: '8px 16px', background: 'var(--mercedes-cyan)', color: '#000', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Download size={16} /> Importar Excel
          </button>
        </div>`;
code = code.replace(/<button [\s\S]*?Importar Excel[\s\S]*?<\/button>/, headerButtons);

// 5. Update Concept Row Name
const conceptRowName = `<td style={{ padding: '8px 16px', fontWeight: 600, color: 'var(--light-text)', position: 'sticky', left: 0, background: 'var(--bg-card)' }}>
                      {editingConcepto?.grupo === grupo.grupo && editingConcepto?.oldConcepto === concepto.concepto ? (
                        <input 
                          type="text"
                          value={newConceptoName}
                          onChange={e => setNewConceptoName(e.target.value)}
                          onBlur={handleRenameConcepto}
                          onKeyDown={e => e.key === 'Enter' && handleRenameConcepto()}
                          autoFocus
                          style={{ width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--mercedes-cyan)', background: 'var(--active-bg)', color: 'var(--text-main)', fontSize: 12 }}
                        />
                      ) : (
                        concepto.concepto
                      )}
                    </td>`;
code = code.replace(/<td style={{ padding: '8px 16px', fontWeight: 600, color: 'var\(--light-text\)', position: 'sticky', left: 0, background: 'var\(--bg-card\)' }}>\s*\{concepto.concepto\}\s*<\/td>/, conceptRowName);

// 6. Update Action Buttons
const actionButtons = `<td style={{ padding: '8px 12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', height: '100%' }}>
                      <button 
                        onClick={() => { setEditingConcepto({ grupo: grupo.grupo, oldConcepto: concepto.concepto }); setNewConceptoName(concepto.concepto); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--mercedes-cyan)', cursor: 'pointer', padding: 0 }}
                        title="Editar Nombre"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        onClick={() => handleDeleteConcepto(grupo.grupo, concepto.concepto)}
                        style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', padding: 0 }}
                        title="Eliminar Partida"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>`;
code = code.replace(/<td style=\{\{ padding: '8px 16px', textAlign: 'center' \}\}>[\s\S]*?<\/td>/g, actionButtons);

// Make sure to replace the `-` in the <th> for actions:
code = code.replace(/<th style=\{\{ padding: '12px 16px', textAlign: 'center' \}\}>-<\/th>/, `<th style={{ padding: '12px 16px', textAlign: 'center' }}>Ac.</th>`);

// 7. Add AddRow Modal
const addRowModal = `      {/* MODAL AÑADIR FILA */}
      {showAddRow && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: 400, padding: 32, position: 'relative', background: 'var(--bg-card)', borderRadius: 20, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => { setShowAddRow(false); setNewRowConcepto(''); }}
              style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--medium-gray)' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 20, color: 'var(--mercedes-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={24} /> Añadir Fila
            </h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--medium-gray)', marginBottom: 8, fontWeight: 600 }}>Grupo</label>
              <select 
                className="form-select" 
                style={{ width: '100%' }}
                value={newRowGrupo}
                onChange={e => setNewRowGrupo(e.target.value)}
              >
                {GRUPOS_PREDEFINIDOS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--medium-gray)', marginBottom: 8, fontWeight: 600 }}>Nombre de la Partida</label>
              <input 
                type="text" 
                value={newRowConcepto}
                onChange={e => setNewRowConcepto(e.target.value)}
                placeholder="Ej: Suministros Extra"
                style={{ width: '100%', background: 'var(--active-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-main)', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                onClick={() => setShowAddRow(false)}
                className="btn"
                style={{ padding: '10px 20px', background: 'transparent', color: 'var(--light-text)', borderRadius: 8, fontWeight: 600, border: '1px solid var(--border-color)', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleAddRow}
                className="btn"
                style={{ padding: '10px 20px', background: '#00C853', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPORTAR EXCEL */}`;
code = code.replace(/      \{\/\* MODAL IMPORTAR EXCEL \*\/\}/, addRowModal);

// 8. Fix input font sizes in cells
code = code.replace(/fontSize: 13/g, "fontSize: 12");
code = code.replace(/fontSize: 14/g, "fontSize: 13"); // For sub-cells or inputs

fs.writeFileSync('src/app/cristina-admin/gastos/page.tsx', code, 'utf8');
