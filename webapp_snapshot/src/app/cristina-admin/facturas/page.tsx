'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Receipt, Calendar, Printer, Download, RefreshCw, FileText, ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { can } from '@/lib/permissions'

type SaleItem = {
  id: string
  numeroFactura?: number | null
  vendedor: string | null
  tienda: string
  nifCliente: string | null
  nombreCliente: string | null
  importeTotal: number
  metodoPago: string | null
  estado: string
  fechaVenta: string
  tipoDocumento: string | null
  facturaSerie: string | null
  appSource: 'MicroShop' | 'MovilFree'
}

export default function FacturasTicketsPage() {
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState<'facturas' | 'tickets'>('facturas')
  const [sales, setSales] = useState<SaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Filters
  const [search, setSearch] = useState('')
  const [storeFilter, setStoreFilter] = useState('Todas')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Usuario logueado: Cristina/Admin ven todo; el resto (Marta) solo MovilFree.
  const [user, setUser] = useState<any>(undefined)
  const movilfreeOnly = user ? !(can(user, 'MODULE_CRISTINA') || String(user.role || '').toUpperCase() === 'ADMIN') : false

  const fetchSales = async (onlyMovilfree: boolean) => {
    setLoading(true)
    try {
      const movilfreeRes = await fetch('/api/movilfree/sales')
      const movilfreeData = await movilfreeRes.json()
      const movilfreeSales: SaleItem[] = (Array.isArray(movilfreeData) ? movilfreeData : []).map(s => ({
        ...s,
        appSource: 'MovilFree'
      }))

      // Solo se traen las ventas de MicroShop Accesorios para usuarios con acceso completo.
      let microshopSales: SaleItem[] = []
      if (!onlyMovilfree) {
        const microshopRes = await fetch('/api/microshop-accesorios/sales')
        const microshopData = await microshopRes.json()
        microshopSales = (Array.isArray(microshopData) ? microshopData : []).map(s => ({
          ...s,
          appSource: 'MicroShop'
        }))
      }

      // Combine and sort by date descending
      const combined = [...microshopSales, ...movilfreeSales].sort((a, b) => {
        return new Date(b.fechaVenta).getTime() - new Date(a.fechaVenta).getTime()
      })

      setSales(combined)
    } catch (e) {
      console.error("Error fetching sales data:", e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // 1) Cargar el usuario; 2) cuando esté, cargar las ventas con el alcance que le corresponda.
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json())
      .then(d => setUser(d && d.authenticated ? d.user : null))
      .catch(() => setUser(null))
  }, [])

  useEffect(() => {
    if (user === undefined) return
    const only = user ? !(can(user, 'MODULE_CRISTINA') || String(user.role || '').toUpperCase() === 'ADMIN') : false
    if (only) setStoreFilter('O2')   // bloqueado a MovilFree
    fetchSales(only)
  }, [user])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchSales(movilfreeOnly)
  }

  // Filter logic
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      // 1. Tab filter
      const isFactura = s.tipoDocumento === 'factura'
      if (activeTab === 'facturas' && !isFactura) return false
      if (activeTab === 'tickets' && isFactura) return false
      
      // 2. Store filter
      if (storeFilter !== 'Todas') {
        if (storeFilter === 'O2' && s.tienda !== 'O2' && s.tienda !== 'MovilFree') return false
        if (storeFilter !== 'O2' && s.tienda !== storeFilter) return false
      }
      
      // 3. Date range filter
      const saleDate = new Date(s.fechaVenta)
      if (dateFrom) {
        const fromLimit = new Date(dateFrom + 'T00:00:00')
        if (saleDate < fromLimit) return false
      }
      if (dateTo) {
        const toLimit = new Date(dateTo + 'T23:59:59')
        if (saleDate > toLimit) return false
      }
      
      // 4. Search query filter
      if (search.trim()) {
        const query = search.toLowerCase()
        const clientName = (s.nombreCliente || '').toLowerCase()
        const clientNif = (s.nifCliente || '').toLowerCase()
        const seller = (s.vendedor || '').toLowerCase()
        const invoiceNum = s.numeroFactura ? s.numeroFactura.toString() : ''
        const invoiceSerie = (s.facturaSerie || '').toLowerCase()
        const storeName = s.tienda.toLowerCase()
        
        return (
          clientName.includes(query) ||
          clientNif.includes(query) ||
          seller.includes(query) ||
          invoiceNum.includes(query) ||
          invoiceSerie.includes(query) ||
          storeName.includes(query)
        )
      }
      
      return true
    })
  }, [sales, activeTab, storeFilter, dateFrom, dateTo, search])

  const totals = useMemo(() => {
    const totalAmount = filteredSales.reduce((sum, s) => sum + s.importeTotal, 0)
    return {
      count: filteredSales.length,
      amount: totalAmount
    }
  }, [filteredSales])

  const formatEuro = (val: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val)
  }

  const getStoreDisplayName = (store: string) => {
    if (store === 'O2' || store === 'MovilFree') return 'Movilfree'
    return store
  }

  const getDocIdentifier = (sale: SaleItem) => {
    if (sale.tipoDocumento === 'factura') {
      return sale.facturaSerie || '---'
    }
    return sale.numeroFactura ? `#${sale.numeroFactura}` : '🎫 ---'
  }

  const handlePrint = (sale: SaleItem, type: 'ticket' | 'factura') => {
    const route = sale.appSource === 'MicroShop' ? 'microshop-accesorios' : 'movilfree'
    window.open(`/${route}/print/${sale.id}?type=${type}`, '_blank')
  }

  const handleExportExcel = async () => {
    try {
      let ExcelJS = (await import('exceljs')) as any
      if (ExcelJS.default) {
        ExcelJS = ExcelJS.default
      }
      const workbook = new ExcelJS.Workbook()
      const sheetTitle = activeTab === 'facturas' ? 'Facturas Emitidas' : 'Tickets Emitidos'
      const worksheet = workbook.addWorksheet(sheetTitle)
      
      worksheet.views = [{ showGridLines: true }]
      
      // Design styles
      const primaryColor = activeTab === 'facturas' ? 'FF1E3A8A' : 'FFE91E97' // dark blue or fuchsia
      const lightBg = activeTab === 'facturas' ? 'FFF0F5FF' : 'FFFFF0F7'
      
      worksheet.columns = [
        { header: 'Fecha', key: 'Fecha', width: 15 },
        { header: 'Serie/Número', key: 'DocId', width: 18 },
        { header: 'Tienda', key: 'Tienda', width: 15 },
        { header: 'Módulo', key: 'Modulo', width: 15 },
        { header: 'NIF Cliente', key: 'NIF', width: 15 },
        { header: 'Nombre Cliente', key: 'Nombre', width: 30 },
        { header: 'Vendedor', key: 'Vendedor', width: 15 },
        { header: 'Método Pago', key: 'Pago', width: 15 },
        { header: 'Importe Total', key: 'Importe', width: 18 }
      ]
      
      // Format Header Row
      const headerRow = worksheet.getRow(1)
      headerRow.height = 28
      headerRow.eachCell((cell: any) => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryColor } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      
      // Add data rows
      filteredSales.forEach(s => {
        const fechaStr = new Date(s.fechaVenta).toLocaleDateString('es-ES')
        worksheet.addRow({
          Fecha: fechaStr,
          DocId: getDocIdentifier(s),
          Tienda: getStoreDisplayName(s.tienda),
          Modulo: s.appSource,
          NIF: s.nifCliente || '---',
          Nombre: s.nombreCliente || '---',
          Vendedor: s.vendedor || '---',
          Pago: s.metodoPago || 'Efectivo',
          Importe: s.importeTotal
        })
      })
      
      const currencyFmt = '#,##0.00" €"'
      worksheet.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
        if (rowNumber === 1) return
        row.height = 20
        const isEven = rowNumber % 2 === 0
        
        row.eachCell((cell: any, colNumber: number) => {
          cell.font = { name: 'Segoe UI', size: 10 }
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFF9FAFB' : 'FFFFFFFF' }
          }
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          }
          
          if ([1, 2, 3, 4, 5, 7, 8].includes(colNumber)) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          } else if (colNumber === 6) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' }
          } else if (colNumber === 9) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' }
            cell.numFmt = currencyFmt
          }
        })
      })
      
      // Add total summary row
      const totalRowIndex = filteredSales.length + 2
      worksheet.addRow([]) // empty row
      const totalRow = worksheet.getRow(totalRowIndex)
      totalRow.height = 24
      
      worksheet.getCell(`G${totalRowIndex}`).value = 'Total Suma'
      worksheet.getCell(`G${totalRowIndex}`).font = { name: 'Segoe UI', size: 11, bold: true }
      worksheet.getCell(`G${totalRowIndex}`).alignment = { horizontal: 'right', vertical: 'middle' }
      
      worksheet.getCell(`I${totalRowIndex}`).value = totals.amount
      worksheet.getCell(`I${totalRowIndex}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: primaryColor } }
      worksheet.getCell(`I${totalRowIndex}`).alignment = { horizontal: 'right', vertical: 'middle' }
      worksheet.getCell(`I${totalRowIndex}`).numFmt = currencyFmt
      worksheet.getCell(`I${totalRowIndex}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightBg } }
      
      // Download file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      
      const filePrefix = activeTab === 'facturas' ? 'facturas' : 'tickets'
      const dateStr = new Date().toISOString().slice(0, 10)
      const fileName = `${filePrefix}_emitidos_${dateStr}.xlsx`
      
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error("Error exporting to Excel:", e)
      alert("Error al intentar exportar los registros a Excel.")
    }
  }

  return (
    <div style={{ padding: 20, minHeight: '100vh', background: '#F8FAFC' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .tab-btn {
          padding: 12px 24px;
          border-radius: 8px;
          border: none;
          font-weight: bold;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .filter-input {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #CBD5E1;
          font-size: 13px;
          background: white;
          outline: none;
        }
        .filter-input:focus {
          border-color: #3b82f6;
        }
        .sales-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .sales-table th {
          padding: 12px 16px;
          background: #F1F5F9;
          color: #475569;
          font-weight: 600;
          font-size: 13px;
          border-bottom: 2px solid #E2E8F0;
        }
        .sales-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #E2E8F0;
          font-size: 13px;
          color: #334155;
        }
        .sales-table tr:hover {
          background: #F8FAFC;
        }
        .badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 11px;
          text-transform: uppercase;
        }
        .badge-micro {
          background: #e0f2fe;
          color: #0369a1;
        }
        .badge-movil {
          background: #fce7f3;
          color: #be185d;
        }
      `}} />

      <PageHeader 
        title="Control de Facturación" 
        subtitle="Consulta, búsqueda y exportación de facturas y tickets emitidos en tiendas."
        showBack={true}
        backFallback="/cristina-admin"
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button 
          className="tab-btn" 
          onClick={() => setActiveTab('facturas')}
          style={{
            background: activeTab === 'facturas' ? '#1E3A8A' : '#E2E8F0',
            color: activeTab === 'facturas' ? 'white' : '#475569',
            boxShadow: activeTab === 'facturas' ? '0 4px 10px rgba(30, 58, 138, 0.2)' : 'none'
          }}
        >
          📄 Facturas Emitidas
        </button>
        <button 
          className="tab-btn" 
          onClick={() => setActiveTab('tickets')}
          style={{
            background: activeTab === 'tickets' ? '#E91E97' : '#E2E8F0',
            color: activeTab === 'tickets' ? 'white' : '#475569',
            boxShadow: activeTab === 'tickets' ? '0 4px 10px rgba(233, 30, 151, 0.2)' : 'none'
          }}
        >
          🎫 Tickets Emitidos (Simplificadas)
        </button>
      </div>

      {/* Filters and Controls Block */}
      <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flexGrow: 1 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 260, flexGrow: 1, maxWidth: 400 }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 11 }} />
              <input 
                type="text" 
                placeholder="Buscar por cliente, NIF, documento, vendedor..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="filter-input"
                style={{ width: '100%', paddingLeft: 36, boxSizing: 'border-box' }}
              />
            </div>
            
            {/* Store Filter — oculto cuando el usuario está limitado a MovilFree (Marta) */}
            {!movilfreeOnly && (
              <select
                value={storeFilter}
                onChange={e => setStoreFilter(e.target.value)}
                className="filter-input"
                style={{ height: 38, cursor: 'pointer' }}
              >
                <option value="Todas">Todas las tiendas</option>
                <option value="Auxiliadora 45">Auxiliadora 45</option>
                <option value="Correhuela">Correhuela</option>
                <option value="Villamayor">Villamayor</option>
                <option value="Béjar">Béjar</option>
                <option value="O2">Movilfree</option>
              </select>
            )}
            
            {/* Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 'bold' }}>Desde:</span>
              <input 
                type="date" 
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="filter-input"
                style={{ height: 38 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 'bold' }}>Hasta:</span>
              <input 
                type="date" 
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="filter-input"
                style={{ height: 38 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              onClick={handleRefresh}
              className="filter-input"
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 'bold', color: '#475569', height: 38 }}
              title="Refrescar lista"
            >
              <RefreshCw size={16} className={refreshing ? 'spin' : ''} /> Refrescar
            </button>
            
            <button 
              onClick={handleExportExcel}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#10B981',
                color: 'white',
                fontWeight: 'bold',
                fontSize: 13,
                cursor: 'pointer',
                height: 38
              }}
            >
              <Download size={16} /> Exportar Excel
            </button>
          </div>

        </div>

        {/* Filter Summary */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
          <div style={{ background: '#F8FAFC', padding: '10px 16px', borderRadius: 8, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>Documentos</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#1E293B' }}>{totals.count}</div>
          </div>
          <div style={{ background: '#F0FDF4', padding: '10px 16px', borderRadius: 8, minWidth: 160, border: '1px solid #BBF7D0' }}>
            <div style={{ fontSize: 11, color: '#166534', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>Total Facturado</div>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#15803d' }}>{formatEuro(totals.amount)}</div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748B' }}>
            <RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px' }} />
            Cargando registros...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Serie / Número</th>
                  <th>Tienda</th>
                  <th>Módulo</th>
                  <th>Cliente NIF</th>
                  <th>Nombre Cliente</th>
                  <th>Vendedor</th>
                  <th>Método Pago</th>
                  <th style={{ textAlign: 'right' }}>Importe Total</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748B' }}>
                      No se encontraron documentos que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id}>
                      <td style={{ fontWeight: 600 }}>{new Date(sale.fechaVenta).toLocaleDateString('es-ES')}</td>
                      <td style={{ fontWeight: 'bold', color: activeTab === 'facturas' ? '#1E3A8A' : '#E91E97' }}>
                        {getDocIdentifier(sale)}
                      </td>
                      <td>{getStoreDisplayName(sale.tienda)}</td>
                      <td>
                        <span className={`badge ${sale.appSource === 'MicroShop' ? 'badge-micro' : 'badge-movil'}`}>
                          {sale.appSource}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{sale.nifCliente || '---'}</td>
                      <td>{sale.nombreCliente || 'Cliente Contado'}</td>
                      <td>{sale.vendedor || '---'}</td>
                      <td>{sale.metodoPago || 'Efectivo'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#1E293B' }}>{formatEuro(sale.importeTotal)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button 
                            onClick={() => handlePrint(sale, 'ticket')}
                            style={{ padding: '6px 10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Ver/Imprimir Ticket Térmico"
                          >
                            <Printer size={12} /> Ticket
                          </button>
                          <button 
                            onClick={() => handlePrint(sale, 'factura')}
                            style={{ padding: '6px 10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}
                            title="Ver/Imprimir Factura A4"
                          >
                            <FileText size={12} /> A4
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
