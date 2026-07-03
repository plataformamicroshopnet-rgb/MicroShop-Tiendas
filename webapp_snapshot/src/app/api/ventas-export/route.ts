import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Export de ventas para el ERP (mi-nuevo-erp) — espejo del ventas-export de FFVV.
// Autenticado server-to-server por el secreto compartido PRV_FEED_SECRET
// (cabecera x-prv-secret), sin sesión. El ERP TIRA (pull) de aquí para meter las
// ventas de Tiendas en su cotejo (Revisión de Liquidaciones) desde junio 2026.
const prisma = new PrismaClient()
const SECRET = process.env.PRV_FEED_SECRET || ''

export const dynamic = 'force-dynamic'

// El detalle de la venta ya es el nombre de palanca que entiende el ERP
// (resolver_tab), salvo 'Ti' que allí se llama 'Contratos Móvil'.
const GRUPO_ERP: Record<string, string> = { 'Ti': 'Contratos Móvil' }

export async function GET(request: Request) {
  if (!SECRET || request.headers.get('x-prv-secret') !== SECRET) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const desde = searchParams.get('desde') || '' // YYYY-MM: ventas con fecha de ese mes en adelante
  try {
    const sales = await prisma.sale.findMany({
      orderBy: { fecha: 'desc' },
      select: {
        id: true, fecha: true, detalle: true, codigo: true, producto: true, nif: true,
        nombreCliente: true, telf: true, telefonoMovil: true, imei: true,
        numeroPedido: true, vendedor: true, cuota: true, anulado: true, pendiente: true,
      },
    })
    const ymOf = (f: string) =>
      (f && f.length >= 10 && f[2] === '/' && f[5] === '/') ? f.slice(6, 10) + '-' + f.slice(3, 5) : ''
    const ventas = sales
      .filter(s => {
        // Anuladas fuera (mismo criterio que el export "Revisión ERP")
        const an = String(s.anulado || '').toLowerCase()
        if (an === 'si' || an === 'sí' || String(s.pendiente || '') === 'Anulado') return false
        return !desde || ymOf(String(s.fecha || '')) >= desde
      })
      .map(s => ({
        id: s.id,
        fecha: s.fecha,
        grupo: GRUPO_ERP[String(s.detalle || '')] || s.detalle || '',
        codigo: s.codigo,          // tienda
        producto: s.producto,
        nif: s.nif,
        nombreCliente: s.nombreCliente,
        telf: s.telf || s.telefonoMovil || '',
        imei: s.imei || '',
        numeroPedido: s.numeroPedido || '',
        vendedor: s.vendedor,
        cuota: s.cuota,
        pendiente: s.pendiente,
      }))
    return NextResponse.json({ success: true, count: ventas.length, desde, ventas })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
