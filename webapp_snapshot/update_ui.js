const fs = require('fs');

let content = fs.readFileSync('src/app/operaciones/page.tsx', 'utf8');

// 1. Header Row Background
content = content.replace(/backgroundColor: 'var\(--active-bg\)'/g, "backgroundColor: '#0078D4'");
content = content.replace(/boxShadow: '0 1px 0 var\(--table-border\)'/g, "boxShadow: '0 1px 0 rgba(0,0,0,0.1)'");

// 2. Header Text Color & Style
content = content.replace(/color: 'var\(--medium-gray\)'(.*?)>(.*?)<\/th>/g, (match, p1, p2) => {
    return `color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px'${p1}>${p2}</th>`;
});

// 3. Table cells text color
content = content.replace(/color: 'var\(--medium-gray\)'/g, "color: '#555555'");
content = content.replace(/color: 'var\(--light-text\)'/g, "color: '#333333'");

// 4. "var(--mercedes-cyan)" to standard blue in the table body (Codigo)
content = content.replace(/color: 'var\(--mercedes-cyan\)'/g, "color: '#0078D4'");

// 5. Badges for PTE and ANUL
// Before: <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', padding: '4px 10px', borderRadius: '12px', fontWeight: 800, fontSize: '11.5px', display: 'inline-block', minWidth: '46px' }}>PED</span>
// The editable table doesn't have badges for "No", just for "Si".
// Wait, the view says: sale.pendiente === 'Si' ? "Si" : "No". Let's search for how `sale.pendiente` is rendered in `OperationsContent`.
// In OperationsContent: `) : sale.pendiente}`
content = content.replace(/\) : sale\.pendiente\}/g, `) : (sale.pendiente === 'Si' ? <span style={{ backgroundColor: '#FFF4E5', color: '#E59837', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px' }}>Sí</span> : <span style={{ color: '#555555', fontSize: '11px' }}>No</span>)}`);

content = content.replace(/\) : \(sale\.anulado === 'Si' \|\| sale\.pendiente === 'Anulado' \? 'Si' : sale\.anulado\)\}/g, `) : (sale.anulado === 'Si' || sale.pendiente === 'Anulado' ? <span style={{ backgroundColor: '#FEE2E2', color: '#EF4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '10px' }}>Sí</span> : <span style={{ color: '#555555', fontSize: '11px' }}>No</span>)}`);

// 6. Action buttons (Edit & Delete)
// Edit button: <Edit2 size={16} /> -> <span style={{fontSize: '10px', fontWeight: 'bold'}}>EDIT</span>
content = content.replace(/<button onClick=\{\(\) => startEdit\(sale\)\} style=\{\{ background: 'transparent', border: '1px solid var\(--border-color\)', color: 'var\(--light-text\)', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' \}\} title="Editar">/g, 
`<button onClick={() => startEdit(sale)} style={{ background: '#FFFFFF', border: '1px solid #0078D4', color: '#0078D4', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Editar">`);

content = content.replace(/<Edit2 size=\{16\} \/>/g, `<span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.5px' }}>EDIT</span>`);

// Delete button: 
content = content.replace(/<button onClick=\{\(\) => deleteSale\(sale\.id\)\} style=\{\{ background: 'rgba\(239, 68, 68, 0\.1\)', border: '1px solid rgba\(239, 68, 68, 0\.2\)', color: '#EF4444', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' \}\} title="Eliminar">/g,
`<button onClick={() => deleteSale(sale.id)} style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#EF4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Eliminar">`);

// Replace Trash icon size
content = content.replace(/<Trash2 size=\{16\} \/>/g, `<Trash2 size={12} />`);


// Force table background to white, ignoring dark mode for this specific component
content = content.replace(/<table style=\{\{ width: '100%', borderCollapse: 'collapse'/g, `<table style={{ backgroundColor: '#FFFFFF', width: '100%', borderCollapse: 'collapse'`);

// Also need to make sure text is generally dark in the table
content = content.replace(/<tr key=\{i\} style=\{\{ borderBottom: '1px solid var\(--border-color\)'/g, `<tr key={i} style={{ color: '#333333', borderBottom: '1px solid #F0F0F0'`);
content = content.replace(/<tr style=\{\{ borderBottom: '1px solid var\(--border-color\)'/g, `<tr style={{ color: '#333333', borderBottom: '1px solid #F0F0F0'`);

// For extras rows:
content = content.replace(/borderBottom: '1px solid var\(--border-color\)', backgroundColor: 'rgba\(16, 185, 129, 0\.05\)'/g, `borderBottom: '1px solid #F0F0F0', backgroundColor: '#F0FDF4'`);

// The "Valor" column is already green because of color: '#10b981' but maybe it was overridden.
// In the current code it's: color: 'var(--mercedes-cyan)', fontWeight: 'bold'
// Wait, I replaced all 'var(--mercedes-cyan)' with '#0078D4' above. But Valor should be green.
// Let's fix that specifically. The column is formatCurrency(...)
// The TD has: style={{ padding: '4px 6px', textAlign: 'center', color: '#0078D4', fontWeight: 'bold' }}>
// Let's make it green if it has formatCurrency
content = content.replace(/<td style=\{\{ padding: '4px 6px', textAlign: 'center', color: '#0078D4', fontWeight: 'bold' \}\}>\s*\{editingId/g, 
`<td style={{ padding: '4px 6px', textAlign: 'center', color: '#10B981', fontWeight: 'bold' }}>
                      {editingId`);

fs.writeFileSync('src/app/operaciones/page.tsx', content, 'utf8');
console.log('UI Updated.');
