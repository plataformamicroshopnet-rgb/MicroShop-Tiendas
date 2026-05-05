import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import ExcelJS from 'exceljs'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'MicroShop Admin'
    workbook.lastModifiedBy = 'Admin'
    workbook.created = new Date()

    // 1. OBTENER DATOS MASIVOS
    const [
      sales, 
      periods, 
      users, 
      catalogs, 
      objectives,
      condicionesPlus,
      importePyme,
      importePlus,
      trackingPeriods,
      trackingGroups,
      trackingRows
    ] = await Promise.all([
      prisma.sale.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.workPeriod.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
      prisma.user.findMany({ orderBy: { username: 'asc' } }),
      prisma.productCatalog.findMany(),
      prisma.objective.findMany(),
      prisma.condicionPlus.findMany(),
      prisma.importePyme.findMany(),
      prisma.importePlus.findMany(),
      prisma.trackingPeriod.findMany(),
      prisma.trackingGroup.findMany(),
      prisma.trackingRow.findMany()
    ])

    // Función auxiliar para estilar cabeceras
    const styleHeader = (worksheet: ExcelJS.Worksheet) => {
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }
    }

    // --- HOJA SALES ---
    const sheetSales = workbook.addWorksheet('Sales')
    sheetSales.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'PeriodId', key: 'periodId', width: 36 },
      { header: 'Form', key: 'sheet', width: 15 },
      { header: 'Vendedor', key: 'vendedor', width: 25 },
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'NIF', key: 'nif', width: 15 },
      { header: 'Cliente', key: 'nombreCliente', width: 30 },
      { header: 'Producto', key: 'producto', width: 20 },
      { header: 'Grupo', key: 'grupo', width: 15 },
      { header: 'Cuota (€)', key: 'cuota', width: 12 },
      { header: 'Pendiente', key: 'pendiente', width: 12 },
      { header: 'Anulado', key: 'anulado', width: 12 },
      { header: 'Creado El', key: 'createdAt', width: 20 }
    ]
    styleHeader(sheetSales)
    sales.forEach(s => sheetSales.addRow({
      id: s.id, periodId: s.periodId, sheet: s.sheet, vendedor: s.vendedor, 
      fecha: s.fecha, nif: s.nif, nombreCliente: s.nombreCliente, producto: s.producto,
      grupo: s.grupo, cuota: s.cuota, pendiente: s.pendiente, anulado: s.anulado,
      createdAt: s.createdAt.toISOString()
    }))

    // --- HOJA WORKPERIODS ---
    const sheetPeriods = workbook.addWorksheet('WorkPeriods')
    sheetPeriods.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Clave', key: 'period_key', width: 15 },
      { header: 'Año', key: 'year', width: 10 },
      { header: 'Mes', key: 'month', width: 10 },
      { header: 'Estado', key: 'status', width: 15 }
    ]
    styleHeader(sheetPeriods)
    periods.forEach(p => sheetPeriods.addRow(p))

    // --- HOJA USERS ---
    const sheetUsers = workbook.addWorksheet('Users')
    sheetUsers.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Rol', key: 'role', width: 15 },
      { header: 'Código Com', key: 'codigoComercial', width: 15 }
    ]
    styleHeader(sheetUsers)
    users.forEach(u => sheetUsers.addRow(u))

    // --- HOJA CATALOGS ---
    const sheetCatalogs = workbook.addWorksheet('ProductCatalogs')
    if(catalogs.length > 0) {
      sheetCatalogs.columns = Object.keys(catalogs[0]).map(k => ({ header: k.toUpperCase(), key: k, width: 20 }))
      styleHeader(sheetCatalogs)
      catalogs.forEach(c => sheetCatalogs.addRow(c))
    }

    // --- HOJA OBJECTIVES ---
    const sheetObj = workbook.addWorksheet('Objectives')
    if(objectives.length > 0) {
      sheetObj.columns = Object.keys(objectives[0]).map(k => ({ header: k.toUpperCase(), key: k, width: 20 }))
      styleHeader(sheetObj)
      objectives.forEach(o => sheetObj.addRow(o))
    }

    // --- OTRAS HOJAS DE SETUP BANCARIO ---
    const addStdSheet = (name: string, data: any[]) => {
      const sh = workbook.addWorksheet(name)
      if(data.length > 0) {
        sh.columns = Object.keys(data[0]).map(k => ({ header: k.toUpperCase(), key: k, width: 20 }))
        styleHeader(sh)
        data.forEach(d => sh.addRow(d))
      }
    }
    addStdSheet('ImportesPyme', importePyme)
    addStdSheet('ImportesPlus', importePlus)
    addStdSheet('CondicionesPlus', condicionesPlus)

    // --- HOJA TRACKING GENERAL ---
    addStdSheet('TrackingPeriods', trackingPeriods)
    addStdSheet('TrackingGroups', trackingGroups)
    addStdSheet('TrackingRows', trackingRows)

    // Generar buffer final
    const buffer = await workbook.xlsx.writeBuffer()

    const now = new Date()
    const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="MicroShop_Exportacion_${dateStr}.xlsx"`
      }
    })

  } catch (error: any) {
    console.error('EXPORT EXCEL ERROR:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
