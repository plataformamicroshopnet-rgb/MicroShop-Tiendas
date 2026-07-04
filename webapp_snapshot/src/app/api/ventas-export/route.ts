import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSaleCommission, getSaleCommissionBase, isLegacySwap } from '@/lib/saleCommission'
import { isSolar360 } from '@/lib/salesUtils'

// Export de ventas para el ERP (mi-nuevo-erp) — espejo del ventas-export de FFVV.
// Autenticado server-to-server por el secreto compartido PRV_FEED_SECRET
// (cabecera x-prv-secret), sin sesión. El ERP TIRA (pull) de aquí para meter las
// ventas de Tiendas en su cotejo (Revisión de Liquidaciones) desde junio 2026.
// Envía la COMISIÓN REAL (getSaleCommission, misma que Operaciones por Grupo
// Cliente) para que el ERP muestre "lo que hemos ganado" antes de que Telefónica
// liquide — no la cuota (que en Rent/Seguro es precio/base, no comisión).
const prisma = new PrismaClient()
const SECRET = process.env.PRV_FEED_SECRET || ''

export const dynamic = 'force-dynamic'

// El detalle de la venta ya es el nombre de palanca que entiende el ERP
// (resolver_tab), salvo 'Ti' que allí se llama 'Contratos Móvil'.
const GRUPO_ERP: Record<string, string> = { 'Ti': 'Contratos Móvil' }

const ymOf = (f: string) =>
  (f && f.length >= 10 && f[2] === '/' && f[5] === '/') ? f.slice(6, 10) + '-' + f.slice(3, 5) : ''

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
        rentConCoste: true, seguro: true, seguroImporte: true, isSwap: true,
      },
    })

    // ── Catálogos por categoría (para getSaleCommission) — todos los periodos,
    // el matching por producto+fechas elige la vigencia correcta de cada venta ──
    const catRows = await prisma.productCatalog.findMany({
      select: {
        categoria: true, producto: true, anual: true, comision: true,
        comisionConCoste: true, validFrom: true, validTo: true, subcategoria: true, gama: true,
      },
    })
    const catalogs: Record<string, any[]> = {}
    for (const c of catRows) {
      (catalogs[c.categoria] ||= []).push(c)
    }

    const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
    const ventas: any[] = []
    for (const s of sales) {
      const an = String(s.anulado || '').toLowerCase()
      if (an === 'si' || an === 'sí' || String(s.pendiente || '') === 'Anulado') continue
      if (isSolar360(s)) continue  // Solar360 no la cobra la empresa (igual que Op. Grupo Cliente)
      if (desde && ymOf(String(s.fecha || '')) < desde) continue

      const saleMonth = ymOf(String(s.fecha || '')).replace('-', '') // 'YYYYMM'
      const ctx = { catalogs, dashRowsPlus: [], dashRowsBasico: [], viewingPeriod: saleMonth }
      // Swap ANTIGUO (< jul 2026): físicamente es una línea de otra palanca (Rent…)
      // con la casilla marcada. Op. Grupo Cliente lo refleja en Varios (15 €). Para
      // que el ERP vea las mismas operaciones, la línea madre va SIN el +15 (comisión
      // base) y se emite un ESPEJO en Varios de 15 € (sin duplicar el importe).
      const legacySwap = isLegacySwap(s)
      let comision = 0
      try {
        comision = legacySwap ? getSaleCommissionBase(s, ctx) : getSaleCommission(s, ctx)
      } catch { comision = 0 }
      ventas.push({
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
        comision: r2(comision),
        pendiente: s.pendiente,
      })
      if (legacySwap) {
        ventas.push({
          id: `${s.id}-swap`,
          fecha: s.fecha,
          grupo: 'Varios',
          codigo: s.codigo,
          producto: `Swap de ${s.producto || ''}`.trim(),
          nif: s.nif,
          nombreCliente: s.nombreCliente,
          telf: s.telf || s.telefonoMovil || '',
          imei: '',
          numeroPedido: '',
          vendedor: s.vendedor,
          cuota: 15,
          comision: 15,
          pendiente: s.pendiente,
        })
      }
    }
    return NextResponse.json({ success: true, count: ventas.length, desde, ventas })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
