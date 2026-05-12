import re

filepath = 'src/app/liquidacion/territorial/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add modalSalesList state
content = content.replace(
    "const [modalStoreTargets, setModalStoreTargets] = useState<{ ruleId: string, tramo: 1 | 2 } | null>(null)",
    "const [modalStoreTargets, setModalStoreTargets] = useState<{ ruleId: string, tramo: 1 | 2 } | null>(null)\n  const [modalSalesList, setModalSalesList] = useState<{ store: string, ruleName: string, logs: any[], isMoneyType: boolean } | null>(null)"
)

# 2. Add X to lucide-react import if not present (Wait, it might be there. Let's just blindly add X just in case, wait, it might duplicate. Let's import X specifically if not there. I will just use a generic replace for lucide)
if " X," not in content and "{ X," not in content:
    content = content.replace("import { ArrowLeft", "import { ArrowLeft, X")

# 3. Change countSalesForStoreAndType to getSalesDataForStoreAndType
old_fn = """  const countSalesForStoreAndType = (storeName: string, tipoVenta: string) => {
    if (!tipoVenta) return 0;
    
    const isProductMatch = (sale: any) => matchTipoVenta(sale, tipoVenta);

    // Obtener los comerciales de la tienda
    let storeSellers: string[] = [];
    if (storeName === 'O2') {
      storeSellers = TIENDAS_COMERCIALES['O2'] || ['Marta'];
    } else {
      // Intentar encontrar la tienda exacta, manejando tildes
      const key = Object.keys(TIENDAS_COMERCIALES).find(k => k.toLowerCase().replace('é','e') === storeName.toLowerCase().replace('é','e'));
      if (key) storeSellers = TIENDAS_COMERCIALES[key];
    }

    const filtered = sales.filter(s => {
      if (s.anulado === 'Si' || s.pendiente === 'Anulado') return false;
      if (!storeSellers.some(seller => (s.vendedor || '').toLowerCase() === seller.toLowerCase())) return false;
      return isProductMatch(s);
    });

    // Si es "Dispositivos" o algo que parece dinero, podríamos querer sumar los importes en lugar de contar?
    // Según la imagen, Dispositivos tiene un objetivo de "96.542 €" y un importe de "3,5%".
    // Eso requiere sumar importes.
    const isMoneyType = tipoVenta.toLowerCase().includes('dispositivos') || tipoVenta.toLowerCase().includes('importe');

    if (isMoneyType) {
      return filtered.reduce((acc, s) => acc + (parseFloat(s.importe || s.cuota || '0') || 0), 0);
    }
    
    return filtered.length;
  }"""

new_fn = """  const getSalesDataForStoreAndType = (storeName: string, tipoVenta: string) => {
    if (!tipoVenta) return { value: 0, logs: [] };
    
    const isProductMatch = (sale: any) => matchTipoVenta(sale, tipoVenta);

    // Obtener los comerciales de la tienda
    let storeSellers: string[] = [];
    if (storeName === 'O2') {
      storeSellers = TIENDAS_COMERCIALES['O2'] || ['Marta'];
    } else {
      // Intentar encontrar la tienda exacta, manejando tildes
      const key = Object.keys(TIENDAS_COMERCIALES).find(k => k.toLowerCase().replace('é','e') === storeName.toLowerCase().replace('é','e'));
      if (key) storeSellers = TIENDAS_COMERCIALES[key];
    }

    const filtered = sales.filter(s => {
      if (s.anulado === 'Si' || s.pendiente === 'Anulado') return false;
      if (!storeSellers.some(seller => (s.vendedor || '').toLowerCase() === seller.toLowerCase())) return false;
      return isProductMatch(s);
    });

    const isMoneyType = tipoVenta.toLowerCase().includes('dispositivos') || tipoVenta.toLowerCase().includes('importe');

    if (isMoneyType) {
      return { value: filtered.reduce((acc, s) => acc + (parseFloat(s.importe || s.cuota || '0') || 0), 0), logs: filtered };
    }
    
    return { value: filtered.length, logs: filtered };
  }

  const renderSalesCell = (value: number, logs: any[], storeName: string, rule: any) => {
    const isMoney = String(rule.tipoVenta).toLowerCase().includes('dispositivos');
    const displayVal = isMoney ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value) : value;
    if (value === 0) return <span>{displayVal}</span>;
    return (
      <span 
        onClick={() => setModalSalesList({ store: storeName, ruleName: rule.nombre || rule.tipoVenta, logs, isMoneyType: isMoney })}
        style={{ cursor: 'pointer', color: '#0284c7', textDecoration: 'underline' }}
      >
        {displayVal}
      </span>
    );
  }"""
content = content.replace(old_fn, new_fn)

# 4. Replace tiendasRules usages
old_tiendas_map = """                const salesAux = countSalesForStoreAndType('Auxiliadora 45', rule.tipoVenta);
                const salesCor = countSalesForStoreAndType('Correhuela', rule.tipoVenta);
                const salesVil = countSalesForStoreAndType('Villamayor', rule.tipoVenta);
                const salesBej = countSalesForStoreAndType('Béjar', rule.tipoVenta);"""
new_tiendas_map = """                const dataAux = getSalesDataForStoreAndType('Auxiliadora 45', rule.tipoVenta);
                const dataCor = getSalesDataForStoreAndType('Correhuela', rule.tipoVenta);
                const dataVil = getSalesDataForStoreAndType('Villamayor', rule.tipoVenta);
                const dataBej = getSalesDataForStoreAndType('Béjar', rule.tipoVenta);
                const salesAux = dataAux.value;
                const salesCor = dataCor.value;
                const salesVil = dataVil.value;
                const salesBej = dataBej.value;"""
content = content.replace(old_tiendas_map, new_tiendas_map)

# Replace table 1 cells
content = content.replace(
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{String(rule.tipoVenta).toLowerCase().includes('dispositivos') ? `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesAux)}` : salesAux}</td>",
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{renderSalesCell(salesAux, dataAux.logs, 'Auxiliadora 45', rule)}</td>"
)
content = content.replace(
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{String(rule.tipoVenta).toLowerCase().includes('dispositivos') ? `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesCor)}` : salesCor}</td>",
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{renderSalesCell(salesCor, dataCor.logs, 'Correhuela', rule)}</td>"
)
content = content.replace(
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{String(rule.tipoVenta).toLowerCase().includes('dispositivos') ? `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesVil)}` : salesVil}</td>",
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{renderSalesCell(salesVil, dataVil.logs, 'Villamayor', rule)}</td>"
)
content = content.replace(
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{String(rule.tipoVenta).toLowerCase().includes('dispositivos') ? `${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(salesBej)}` : salesBej}</td>",
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold' }}>{renderSalesCell(salesBej, dataBej.logs, 'Béjar', rule)}</td>"
)

# 5. Replace o2Rules usages
old_o2_map = "const totalSales = countSalesForStoreAndType('O2', rule.tipoVenta);"
new_o2_map = "const dataO2 = getSalesDataForStoreAndType('O2', rule.tipoVenta);\n                const totalSales = dataO2.value;"
content = content.replace(old_o2_map, new_o2_map)

# Replace table 2 cell
content = content.replace(
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold', color: 'var(--mercedes-cyan)' }}>{totalSales}</td>",
    "<td style={{ padding: 4, textAlign: 'center', fontWeight: 'bold', color: 'var(--mercedes-cyan)' }}>{renderSalesCell(totalSales, dataO2.logs, 'O2', rule)}</td>"
)

# 6. Add Modal to the bottom
modal_ui = """      {/* MODAL LISTA DE VENTAS */}
      {modalSalesList && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="card" style={{ width: 800, maxWidth: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: 'var(--mercedes-cyan)' }}>Ventas {modalSalesList.store} - {modalSalesList.ruleName}</h3>
              <button onClick={() => setModalSalesList(null)} style={{ background: 'transparent', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer' }}><X size={20}/></button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--section-bg)', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Vendedor</th>
                    <th style={{ padding: 8 }}>Cliente</th>
                    <th style={{ padding: 8 }}>NIF/Tel</th>
                    <th style={{ padding: 8 }}>Producto</th>
                    <th style={{ padding: 8 }}>Fecha</th>
                    {modalSalesList.isMoneyType && <th style={{ padding: 8 }}>Importe</th>}
                  </tr>
                </thead>
                <tbody>
                  {modalSalesList.logs.map((log: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: 8 }}>{log.vendedor}</td>
                      <td style={{ padding: 8 }}>{log.cliente}</td>
                      <td style={{ padding: 8 }}>{log.nif || log.linea || '-'}</td>
                      <td style={{ padding: 8 }}>{log.producto} {log.detalle}</td>
                      <td style={{ padding: 8 }}>{new Date(log.timestamp).toLocaleDateString('es-ES')}</td>
                      {modalSalesList.isMoneyType && <td style={{ padding: 8 }}>{log.importe || log.cuota} €</td>}
                    </tr>
                  ))}
                  {modalSalesList.logs.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center' }}>No hay ventas registradas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}"""

content = content.replace("    </div>\n  )\n}", modal_ui)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Sales modal added")
