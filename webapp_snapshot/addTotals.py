import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add precalculation
old_return = "  if (isLoadingPeriods || loading) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando datos...</div>\n\n  return ("
new_return = """  // Pre-calcular totales
  const grandTotalTiendas = tiendasRules.reduce((acc, rule) => {
    const dataAux = getSalesDataForStoreAndType('Auxiliadora 45', rule.tipoVenta);
    const dataCor = getSalesDataForStoreAndType('Correhuela', rule.tipoVenta);
    const dataVil = getSalesDataForStoreAndType('Villamayor', rule.tipoVenta);
    const dataBej = getSalesDataForStoreAndType('Béjar', rule.tipoVenta);
    const salesTot = dataAux.value + dataCor.value + dataVil.value + dataBej.value;

    const impAux = calculateTiendaImporte(rule, 'Auxiliadora 45', dataAux.value, salesTot);
    const impCor = calculateTiendaImporte(rule, 'Correhuela', dataCor.value, salesTot);
    const impVil = calculateTiendaImporte(rule, 'Villamayor', dataVil.value, salesTot);
    const impBej = calculateTiendaImporte(rule, 'Béjar', dataBej.value, salesTot);
    
    return acc + impAux + impCor + impVil + impBej;
  }, 0);

  const grandTotalO2 = o2Rules.reduce((acc, rule) => {
    const dataO2 = getSalesDataForStoreAndType('O2', rule.tipoVenta);
    return acc + calculateO2Importe(rule, dataO2.value);
  }, 0);

  if (isLoadingPeriods || loading) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando datos...</div>

  return ("""
content = content.replace(old_return, new_return)

# Update UI header
old_header = """          <button 
            onClick={handleSave} 
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--mercedes-cyan)', color: 'var(--bg-card)', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>"""
new_header = """          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ display: 'flex', gap: 24, borderRight: '1px solid var(--border-color)', paddingRight: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Tiendas</div>
                <div style={{ fontSize: 18, color: '#10b981', fontWeight: 'bold' }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalTiendas)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--medium-gray)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total O2</div>
                <div style={{ fontSize: 18, color: '#10b981', fontWeight: 'bold' }}>{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(grandTotalO2)}</div>
              </div>
            </div>
            <button 
              onClick={handleSave} 
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--mercedes-cyan)', color: 'var(--bg-card)', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>"""
content = content.replace(old_header, new_header)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Grand totals added to header")
