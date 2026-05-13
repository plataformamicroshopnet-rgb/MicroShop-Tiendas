import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
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
    const { action, items, item } = body

    if (action === 'bulk' && items && Array.isArray(items)) {
      // Borrar todos los registros actuales para hacer un reemplazo completo, 
      // o se podrian insertar nuevos. Normalmente en estas hojas pegan todo de nuevo.
      // Por seguridad, si mandan bulk, reemplazamos todo.
      await prisma.vencimiento.deleteMany({})
      
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

    const updated = await prisma.vencimiento.update({
      where: { id },
      data: {
        proveedor: data.proveedor,
        fechaFactura: data.fechaFactura,
        albaran: data.albaran,
        nFactura: data.nFactura,
        vencimiento: data.vencimiento,
        pagado: data.pagado,
        recargo: parseFloat(data.recargo) || 0,
        tarjetas: parseFloat(data.tarjetas) || 0,
        accesorios: parseFloat(data.accesorios) || 0,
        moviles: parseFloat(data.moviles) || 0,
        iva: parseFloat(data.iva) || 0,
        totalFactura: parseFloat(data.totalFactura) || 0
      }
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
