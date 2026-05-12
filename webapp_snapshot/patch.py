import re

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Types
types_replacement = '''type GroupedSale = {
  fecha: string
  producto: string
  comision: number
  varios: string
  estado: string
}

const TIPOS_VENTA = [
  'Contratos Móvil', 'Rent', 'O2 MovilFree', 'Seguro', 'miMovistar',
  'Suscripciones TV', 'Prepago', 'Varios', 'Repos', 'Resto BAF'
]
'''
content = re.sub(r'type GroupedSale = \{.*?type TiendaGroup = \{.*?\}', types_replacement, content, flags=re.DOTALL)

# Replace state and useMemo logic
logic_replacement = '''
  const [expandedTiendas, setExpandedTiendas] = useState<Record<string, boolean>>({})
  const [expandedCell, setExpandedCell] = useState<string | null>(null) // "Tienda-Comercial-Tipo"

  const toggleTienda = (tienda: string) => setExpandedTiendas(prev => ({ ...prev, [tienda]: !prev[tienda] }))
  const toggleCell = (key: string) => setExpandedCell(prev => prev === key ? null : key)

  const formatEuro = (val: number) => {
    return val.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' '
  }

  // Effect stays the same
'''
content = re.sub(r'  const \[expandedTiendas.*?(?=  useEffect)', logic_replacement, content, flags=re.DOTALL)

# Replace useMemo and Return
usememo_return_replacement = '''
  const matrixData = useMemo(() => {
    if (sales.length === 0 && !loading) {
       // We still want to show the matrix even if 0 sales!
    }

    const getCurrentMonthString = () => {
      const now = new Date()
      return ${now.getFullYear()}
    }

    const salesWithCommission = sales.map(sale => {
      if (sale.anulado === 'Si' || sale.pendiente === 'Anulado') {
        return { ...sale, comisionReal: 0 }
      }

      const tipoVenta = (String(sale.sheet || '')).trim().toLowerCase()
      const codigo = (String(sale.codigo || '')).trim().toLowerCase()
      const prod = (String(sale.producto || '')).trim().toLowerCase()
      const cat = (String(sale.categoria || '')).trim().toLowerCase()
      const codigoLower = String(sale.codigo || '').trim().toLowerCase()

      const isBasico = codigoLower.includes('básico xcu') || codigoLower.includes('basico xcu')
      const plusCodesExact = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7']
      const isPlus = plusCodesExact.some(c => codigoLower.includes(c))

      let saleMonth = ''
      if (sale.fecha) {
         const parts = sale.fecha.split('/')
         if (parts.length === 3) saleMonth = ${parts[2]}
         else if (sale.fecha.includes('-')) {
             const p = sale.fecha.split('-')
             if (p.length >= 2) saleMonth = ${p[0]}
         }
      }

      const getFallbackValue = () => {
           let val = sale.importe || sale.cuota || 0;
           const det = (sale.detalle || '').toLowerCase();
           if (!val && (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro')) {
               let catalogKey = '';
               if (det === 'ti') catalogKey = 'Ti';
               if (det === 'tma' || det === 'rent') catalogKey = 'RENT';
               if (det === 'micro') catalogKey = 'Micro';
               
               const list = catalogs[catalogKey] || [];
               const found = list.find((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
               if (found) {
                   val = Number(String(found.anual || 0).replace(',','.'));
               }
           }
           return val;
      }

      const parseToNumber = (val: any): number => {
        if (typeof val === 'number') return isNaN(val) ? 0 : val;
        if (!val) return 0;
        const parsed = Number(String(val).replace(',', '.').trim());
        return isNaN(parsed) ? 0 : parsed;
      }

      if (!saleMonth) return { ...sale, comisionReal: parseToNumber(getFallbackValue()) }

      const viewingPeriod = activePeriodObj
          ? ${activePeriodObj.year}
          : getCurrentMonthString();
      
      if (saleMonth !== viewingPeriod) return { ...sale, comisionReal: parseToNumber(getFallbackValue()) }
      
      const dashboardRows = isPlus ? pymeRows : captadorRows;
      const det = (sale.detalle || '').toLowerCase();
      
      if (det === 'o2' || det === 'seguro' || det === 'mimovistar' || det === 'repos' || det === 'varios' || det === 'suscripciones tv' || det === 'prepago') {
          return { ...sale, comisionReal: parseToNumber(sale.importe || sale.cuota || 0) };
      }
      
      let overrideBaseValue: number | undefined = undefined;
      if (det === 'ti' || det === 'tma' || det === 'rent' || det === 'micro') {
          let catalogKey = '';
          if (det === 'ti') catalogKey = 'Ti';
          if (det === 'tma' || det === 'rent') catalogKey = 'RENT';
          if (det === 'micro') catalogKey = 'Micro';
          
          const list = catalogs[catalogKey] || [];
          const matchingProducts = list.filter((c: any) => normalizeString(c.producto) === normalizeString(sale.producto));
          
          let found = matchingProducts[0];
          if (matchingProducts.length > 1) {
              const correctlyDated = matchingProducts.find((c: any) => {
                  if (!c.validFrom) return false;
                  return true;
              });
              if (correctlyDated) {
                  found = correctlyDated;
              }
          }

          if (found) {
              overrideBaseValue = parseToNumber(found.anual);
              
              if (det === 'ti') {
                  return { ...sale, comisionReal: overrideBaseValue };
              }
              
              if (det === 'tma' || det === 'rent') {
                  const isConCoste = sale.rentConCoste && (sale.rentConCoste.toLowerCase() === 'sí' || sale.rentConCoste.toLowerCase() === 'si');
                  if (isConCoste) {
                      return { ...sale, comisionReal: parseToNumber(found.comisionConCoste) };
                  } else {
                      return { ...sale, comisionReal: parseToNumber(found.comision) };
                  }
              }
          }
      }

      const finalCommission = parseToNumber(calculateDynamicCommission(sale, dashboardRows, overrideBaseValue));
      return { ...sale, comisionReal: finalCommission }
    })

    const result = Object.entries(TIENDAS_COMERCIALES).map(([tiendaName, comerciales]) => {
      const rows = comerciales.map(comercial => {
        const cells = {} as Record<string, { total: number, sales: any[] }>
        TIPOS_VENTA.forEach(t => cells[t] = { total: 0, sales: [] })
        return { nombre: comercial, cells, totalGlobal: 0 }
      })
      
      const footerTotals = {} as Record<string, number>
      TIPOS_VENTA.forEach(t => footerTotals[t] = 0)
      
      return { nombre: tiendaName, rows, footerTotals, totalTienda: 0 }
    })

    salesWithCommission.forEach(s => {
      const vendedor = s.vendedor || 'Desconocido'
      let tiendaObj = result.find(t => t.rows.some(r => r.nombre.toLowerCase() === vendedor.toLowerCase()))
      
      if (!tiendaObj) return;

      let tipo = 'Resto BAF'
      const det = (s.detalle || '').toLowerCase()
      if (det === 'ti') tipo = 'Contratos Móvil'
      else if (det === 'tma' || det === 'rent') tipo = 'Rent'
      else if (det === 'o2') tipo = 'O2 MovilFree'
      else if (det === 'seguro') tipo = 'Seguro'
      else if (det === 'mimovistar') tipo = 'miMovistar'
      else if (det === 'suscripciones tv') tipo = 'Suscripciones TV'
      else if (det === 'prepago') tipo = 'Prepago'
      else if (det === 'varios') tipo = 'Varios'
      else if (det === 'repos') tipo = 'Repos'

      const row = tiendaObj.rows.find(r => r.nombre.toLowerCase() === vendedor.toLowerCase())
      if (row && row.cells[tipo]) {
          row.cells[tipo].sales.push(s)
          row.cells[tipo].total += s.comisionReal
          row.totalGlobal += s.comisionReal
          tiendaObj.footerTotals[tipo] += s.comisionReal
          tiendaObj.totalTienda += s.comisionReal
      }
    })

    result.sort((a, b) => b.totalTienda - a.totalTienda)
    return result
  }, [sales, pymeRows, captadorRows, catalogs])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--mercedes-cyan)', fontWeight: 'bold' }}>Cargando Rentabilidad por Tiendas...</div>
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
      <PageHeader 
        title="Rentabilidad por Tiendas" 
        subtitle="Mtricas globales de ventas y comisiones por sede."
        icon={Building2}
      />

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {matrixData.map(tienda => (
          <div key={tienda.nombre} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div 
              onClick={() => toggleTienda(tienda.nombre)}
              style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: expandedTiendas[tienda.nombre] ? 'rgba(16, 185, 129, 0.05)' : 'transparent', borderBottom: expandedTiendas[tienda.nombre] ? '1px solid var(--border-color)' : 'none', transition: 'background-color 0.2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {expandedTiendas[tienda.nombre] ? <ChevronUp size={24} color="#10b981" /> : <ChevronDown size={24} color="var(--medium-gray)" />}
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: 'var(--light-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {tienda.nombre}
                  </h3>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{formatEuro(tienda.totalTienda)}</div>
              </div>
            </div>

            {expandedTiendas[tienda.nombre] && (
              <div style={{ overflowX: 'auto', padding: '10px 20px 20px 20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1000 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: 'var(--light-text)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)', zIndex: 2 }}>Comercial</th>
                      {TIPOS_VENTA.map(t => (
                        <th key={t} style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--medium-gray)', fontWeight: 600 }}>{t}</th>
                      ))}
                      <th style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--light-text)', fontWeight: 800 }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tienda.rows.map(row => (
                      <React.Fragment key={row.nombre}>
                        <tr style={{ borderBottom: '1px solid var(--border-light)', transition: 'background-color 0.2s' }} className="table-row-hover">
                          <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--mercedes-cyan)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)', zIndex: 1, borderRight: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <User size={14} />
                              {row.nombre}
                            </div>
                          </td>
                          {TIPOS_VENTA.map(t => {
                            const cell = row.cells[t]
                            const hasSales = cell.sales.length > 0
                            const cellKey = ${tienda.nombre}--
                            return (
                              <td 
                                key={t} 
                                onClick={() => hasSales ? toggleCell(cellKey) : null}
                                style={{ 
                                  padding: '12px 8px', 
                                  textAlign: 'right', 
                                  color: hasSales ? 'var(--light-text)' : 'var(--text-muted)',
                                  cursor: hasSales ? 'pointer' : 'default',
                                  fontWeight: hasSales ? 600 : 400,
                                  backgroundColor: expandedCell === cellKey ? 'rgba(0,173,239,0.1)' : 'transparent'
                                }}
                                title={hasSales ? 'Clic para ver operaciones' : ''}
                              >
                                {hasSales ? formatEuro(cell.total) : '-'}
                              </td>
                            )
                          })}
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: '#3b82f6', borderLeft: '1px solid var(--border-light)' }}>
                            {formatEuro(row.totalGlobal)}
                          </td>
                        </tr>
                        {TIPOS_VENTA.map(t => {
                          const cellKey = ${tienda.nombre}--
                          if (expandedCell === cellKey && row.cells[t].sales.length > 0) {
                            return (
                              <tr key={expanded-}>
                                <td colSpan={TIPOS_VENTA.length + 2} style={{ padding: 0 }}>
                                  <div style={{ padding: '16px 24px', backgroundColor: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-light)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--mercedes-cyan)', fontSize: 14 }}>
                                      Operaciones de {row.nombre} en {t}
                                    </h4>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                      <thead>
                                        <tr style={{ color: 'var(--medium-gray)', borderBottom: '1px solid var(--border-light)' }}>
                                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Fecha</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Producto</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'left' }}>Anotaciones</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Estado</th>
                                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Rentabilidad</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {row.cells[t].sales.map((v, idx) => (
                                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{v.fecha}</td>
                                            <td style={{ padding: '6px 8px', color: 'var(--light-text)' }}>{v.producto}</td>
                                            <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{v.anotaciones || '-'}</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                              {v.estado === 'NULL' ? (
                                                <span style={{ color: '#FF453A', fontSize: 11, fontWeight: 700 }}>NULL</span>
                                              ) : v.estado === 'PED' ? (
                                                <span style={{ color: '#FF9500', fontSize: 11, fontWeight: 700 }}>PED</span>
                                              ) : (
                                                <span style={{ color: '#34C759', fontSize: 11, fontWeight: 700 }}>OK</span>
                                              )}
                                            </td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#3b82f6' }}>{formatEuro(v.comisionReal)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )
                          }
                          return null
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--light-text)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>TOTAL TIENDA</td>
                      {TIPOS_VENTA.map(t => (
                        <td key={t} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--light-text)' }}>
                          {formatEuro(tienda.footerTotals[t])}
                        </td>
                      ))}
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                        {formatEuro(tienda.totalTienda)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
'''
content = re.sub(r'  const groupedData = useMemo\(\(\) => \{.*$', usememo_return_replacement, content, flags=re.DOTALL)

with open('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement successful")
