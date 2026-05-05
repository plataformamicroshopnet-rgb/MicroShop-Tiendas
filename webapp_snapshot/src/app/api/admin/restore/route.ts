import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getExcelFilePath, uploadExcelFileToDrive } from '@/lib/driveSync'
import ExcelJS from 'exceljs'
import * as fs from 'fs'
import path from 'path'

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado. Solo Administradores.' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se envió ningún archivo.' }, { status: 400 })
    }

    if (!file.name.endsWith('.xlsx')) {
        return NextResponse.json({ success: false, error: 'El archivo debe ser un formato Excel (.xlsx).' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(bytes))

    const uploadedWorkbook = new ExcelJS.Workbook()
    await uploadedWorkbook.xlsx.load(buffer as any)

    // 1. Restaurar Usuarios
    const usersSheet = uploadedWorkbook.getWorksheet('Usuarios')
    if (usersSheet) {
      const restoredUsers: any[] = []
      usersSheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return // skip header
        const vals = row.values as any[]
        if (vals[1]) {
           restoredUsers.push({
             username: vals[1],
             password: vals[2] || '1234',
             role: vals[3] || 'COMERCIAL',
             permissions: vals[4] ? vals[4].toString().split(',').map((p:string) => p.trim()) : []
           })
        }
      })
      
      const USERS_FILE = path.join(process.cwd(), 'users.json')
      fs.writeFileSync(USERS_FILE, JSON.stringify({ users: restoredUsers }, null, 2))
    }

    // 2. Restaurar Operaciones
    const opsSheet = uploadedWorkbook.getWorksheet('Operaciones')
    if (opsSheet) {
       const newWorkbook = new ExcelJS.Workbook()
       const basicHeader = ['Cuenta', 'Vendedor', 'Fecha', 'Código', 'Producto', 'NIF', 'PO', 'Teléfono', 'Acti.', 'Pte.', 'Anul.', 'Anotaciones', 'Cuota', 'Detalle Producto']
       
       const opWs = newWorkbook.addWorksheet('OP')
       const vfWs = newWorkbook.addWorksheet('Venta Fija')
       const vmWs = newWorkbook.addWorksheet('Venta Móvil')

       opWs.addRow(basicHeader)
       vfWs.addRow(basicHeader)
       vmWs.addRow(basicHeader)

       opsSheet.eachRow((row, rowNum) => {
          if (rowNum === 1) return
          const values = row.values as any[]
          // Recortar la fila basándonos en los headers importados
          const cleanRow = []
          for (let i = 1; i <= basicHeader.length; i++) {
             cleanRow.push(values[i] !== undefined ? values[i] : '')
          }
          
          opWs.addRow(cleanRow)
          
          // Distribuir también a las subpestañas por simplificar.
          // En la vida real, dependiendo del "Código" (FIJO o MOVIL) iría a una u otra.
          // Como es un restore básico de datos muertos, lo inyectamos todo a OP y podemos dejar vacías la FF/MM 
          // o meterlas todas. Decisión: Sólo en OP para no duplicar si hay lógicas internas complejas, 
          // pero el código de inserción actual unifica varias pantallas.
       })

       const excelFilePath = await getExcelFilePath()
       const uint8Array = await newWorkbook.xlsx.writeBuffer()
       fs.writeFileSync(excelFilePath, Buffer.from(uint8Array))
       
       if (process.env.EXCEL_FILE_ID || process.env.FILE_ID || process.env.SPREADSHEET_ID) {
          await uploadExcelFileToDrive(excelFilePath)
       }
    } else {
       // Si no era un pure backup con la pestaña operaciones, tratamos de sobreescribir el archivo entero
       const excelFilePath = await getExcelFilePath()
       fs.writeFileSync(excelFilePath, buffer)
       if (process.env.EXCEL_FILE_ID || process.env.FILE_ID || process.env.SPREADSHEET_ID) {
          await uploadExcelFileToDrive(excelFilePath)
       }
    }

    return NextResponse.json({ success: true, message: 'La copia de seguridad ha sido restaurada con éxito (incluidos los Usuarios).' })
  } catch (error: any) {
    console.error('Error restaurando backup:', error)
    return NextResponse.json({ success: false, error: 'Error interno del servidor al restaurar el archivo.' }, { status: 500 })
  }
}
