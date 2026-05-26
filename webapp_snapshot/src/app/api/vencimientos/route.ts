import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const items = await prisma.vencimiento.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json({ success: true, data: items })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, items, item, replace } = body

    if (action === 'bulk' && items && Array.isArray(items)) {
      // Eliminar registros existentes con el mismo proveedor y nº factura para evitar duplicados
      const conditions = items.filter((i: any) => i.nFactura && i.proveedor).map((i: any) => ({
        proveedor: i.proveedor,
        nFactura: i.nFactura
      }))
      
      if (conditions.length > 0) {
        await prisma.vencimiento.deleteMany({
          where: { OR: conditions }
        })
      }
      
      const created = await prisma.vencimiento.createMany({
        data: items.map((i: any) => ({
          proveedor: i.proveedor || '',
          fechaFactura: i.fechaFactura || '',
          albaran: i.albaran || '',
          nFactura: i.nFactura || '',
          vencimiento: i.vencimiento || '',
          pagado: i.pagado || false,
          recargo: parseFloat(i.recargo) || 0,
          tarjetas: parseFloat(i.tarjetas) || 0,
          accesorios: parseFloat(i.accesorios) || 0,
          moviles: parseFloat(i.moviles) || 0,
          iva: parseFloat(i.iva) || 0,
          totalFactura: parseFloat(i.totalFactura) || 0
        }))
      })
      return NextResponse.json({ success: true, count: created.count })
    }

    if (action === 'create' && item) {
      const created = await prisma.vencimiento.create({
        data: {
          proveedor: item.proveedor || '',
          fechaFactura: item.fechaFactura || '',
          albaran: item.albaran || '',
          nFactura: item.nFactura || '',
          vencimiento: item.vencimiento || '',
          pagado: item.pagado || false,
          recargo: parseFloat(item.recargo) || 0,
          tarjetas: parseFloat(item.tarjetas) || 0,
          accesorios: parseFloat(item.accesorios) || 0,
          moviles: parseFloat(item.moviles) || 0,
          iva: parseFloat(item.iva) || 0,
          totalFactura: parseFloat(item.totalFactura) || 0
        }
      })
      return NextResponse.json({ success: true, data: created })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    const { id, ...data } = body
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })

    const updateData: any = {}
    if (data.proveedor !== undefined) updateData.proveedor = data.proveedor
    if (data.fechaFactura !== undefined) updateData.fechaFactura = data.fechaFactura
    if (data.albaran !== undefined) updateData.albaran = data.albaran
    if (data.nFactura !== undefined) updateData.nFactura = data.nFactura
    if (data.vencimiento !== undefined) updateData.vencimiento = data.vencimiento
    if (data.pagado !== undefined) updateData.pagado = data.pagado
    if (data.recargo !== undefined) updateData.recargo = parseFloat(data.recargo) || 0
    if (data.tarjetas !== undefined) updateData.tarjetas = parseFloat(data.tarjetas) || 0
    if (data.accesorios !== undefined) updateData.accesorios = parseFloat(data.accesorios) || 0
    if (data.moviles !== undefined) updateData.moviles = parseFloat(data.moviles) || 0
    if (data.iva !== undefined) updateData.iva = parseFloat(data.iva) || 0
    if (data.totalFactura !== undefined) updateData.totalFactura = parseFloat(data.totalFactura) || 0

    const updated = await prisma.vencimiento.update({
      where: { id },
      data: updateData
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    
    if (id) {
      await prisma.vencimiento.delete({ where: { id } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
