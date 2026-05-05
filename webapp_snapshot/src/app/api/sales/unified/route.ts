import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { PrismaClient } from '@prisma/client'
import { runExtrasEngine } from '@/lib/extrasEngine'

const prisma = new PrismaClient()

function resolveGrupo(prod: any): string {
  const cat = prod.categoria || ''
  const prodName = prod.producto || ''

  if (cat === 'Ti') return 'TI'
  if (cat === 'TMA') return 'TMA'
  if (cat === 'Micro') return 'MIC'

  const productMap: Record<string, string[]> = {
    'FD': [
      'Alta FD Total', 'Alta FD Total NC', 'Migra FD Total', 
      'Alta FD Flex', 'Alta FD Flex NC', 'Migra FD Flex'
    ],
    'BAF': [
      'Alta BAF Total', 'Alta BAF Total NC', 
      'Respaldo 5G', 'Migra BAF Total'
    ],
    'REN': [
      'Renovación', 'Renovación Base', 'Renovación Extra = 1', 
      'Renovación Extra > 1', 'Renovación + Dispositivo', 
      'Renovación + Dispositivo [Solo Comisiones]'
    ],
    'ALTA': [
      'Alta Móvil AV', 'Alta Móvil MV', 'Alta Móvil BV'
    ],
    'PORTA': [
      'Porta Móvil AV', 'Porta Móvil AV NC', 'Porta Móvil MV', 
      'Porta Móvil MV NC', 'Porta Móvil BV', 'Porta Móvil BV NC'
    ],
    'MPA': [
      'Alarma Directa', 'Alarma Asistida o Esencial', 'Venta MPA'
    ]
  }

  for (const [gName, names] of Object.entries(productMap)) {
    if (names.includes(prodName)) return gName
  }

  return '-'
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_TIENDAS')) {
      return NextResponse.json({ success: false, error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }

    const { user } = session
    const data = await request.json()

    if (!data.vendedor) return NextResponse.json({ success: false, error: 'Selecciona el vendedor' }, { status: 400 })
    if (!data.nombreCliente) return NextResponse.json({ success: false, error: 'Indica el nombre del cliente' }, { status: 400 })
    if (!data.nif) return NextResponse.json({ success: false, error: 'Comprueba el NIF del Titular' }, { status: 400 })

    const numValidProducts = data.productos.filter((p: any) => p.producto !== '').length
    if (numValidProducts === 0) return NextResponse.json({ success: false, error: 'Configura al menos un producto' }, { status: 400 })

    let activePeriod = null
    if (data.periodKey) {
      activePeriod = await prisma.workPeriod.findUnique({
        where: { period_key: data.periodKey }
      })
    }

    const salesToInsert = []

    for (let x = 0; x < data.productos.length; x++) {
      const prod = data.productos[x]
      if (prod.producto === '') continue

      // Pad date for dd/mm/yyyy format based on today
      const now = new Date()
      const d = String(now.getDate()).padStart(2, '0')
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const y = now.getFullYear()
      const fechaStr = `${d}/${m}/${y}`

      let sheetCategory = 'OP'
      if (['Fija y Móvil', 'Ti', 'TMA', 'Micro'].includes(prod.categoria)) {
        sheetCategory = 'Venta Fija'
      }

      const calculatedGroup = resolveGrupo(prod)

      console.log('--- NUEVA VENTA DETECTADA ---')
      console.log('prod.categoria:', prod.categoria)
      console.log('prod.producto:', prod.producto)
      console.log('Valor final asignado a grupo:', calculatedGroup)

      salesToInsert.push({
        sheet: sheetCategory,
        vendedor: data.vendedor,
        fecha: fechaStr,
        codigo: data.codigo || '',
        producto: prod.producto,
        nombreCliente: data.nombreCliente.toUpperCase(),
        nif: data.nif.toUpperCase(),
        potencial: prod.noCliente || '',
        telf: prod.telf || '',
        pendiente: prod.pendiente || '',
        anulado: 'No',
        anotaciones: data.anotaciones || '',
        telefonoFijo: data.telefonoFijo || '',
        telefonoMovil: data.telefonoMovil || '',
        boletin: data.boletin || '',
        grupo: calculatedGroup,
        cuota: prod.importe ? parseFloat(prod.importe.toString().replace(',','.')) : null,
        detalle: prod.categoria || '',
        periodId: activePeriod?.id || null
      })
    }

    if (salesToInsert.length > 0) {
      await prisma.sale.createMany({
        data: salesToInsert
      })

      // Disparador Reactivo: Calcular Reglas Extra para el Mes de las ventas importadas
      if (activePeriod?.id) {
        await runExtrasEngine(activePeriod.id).catch(console.error)
      }
    }
    
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in Unified Sales API:', error)
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
