import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { isSaleCancelled, isVentaWithinDates, esRepoArpuManual } from '@/lib/salesUtils'

// Los repos de «incremento de ARPU» se teclean con las casillas Fact. Anterior /
// Fact. Nueva: su precio no está en la tarifa. Mismo reconocedor que Nueva Venta.
const esIncrementoArpu = (producto: any) =>
  String(producto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .includes('incremento de arpu')
import { runExtrasEngine } from '@/lib/extrasEngine'

// Corrección masiva de operaciones tras cambiar el catálogo de un periodo.
// El precio se CONGELA en la venta al teclearla (Rent: Sale.cuota = precio del
// dispositivo; Seguro: Sale.cuota y Sale.seguroImporte = prima anual), así que
// corregir el catálogo a posteriori NO corrige las ventas ya tecleadas. Este
// endpoint re-aplica el snapshot: para cada venta Rent/Seguro/Repos (Arpu) del
// periodo, busca la vigencia que CUBRE la fecha de la venta y reescribe su importe.
// Es la pareja del reprice del FFVV (patrón vigencias, commit efdbf27), pero
// para las palancas de Tiendas que guardan foto del precio. ESTRICTO: si
// ninguna vigencia cubre la fecha, la venta NO se toca (mejor dejarla como
// está que adivinar un precio).
const prisma = new PrismaClient()

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !['ADMIN', 'JEFE DE VENTAS'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const { periodKey } = await request.json()
    if (!periodKey) {
      return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 })
    }
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
    if (!wp) {
      return NextResponse.json({ success: false, error: 'El WorkPeriod indicado no existe' }, { status: 404 })
    }
    if (wp.status === 'HISTORIC') {
      return NextResponse.json({ success: false, error: 'Operación RECHAZADA: el periodo está cerrado (HISTORIC).' }, { status: 403 })
    }

    // Catálogo del periodo, solo las palancas con foto del precio en la venta.
    // OJO: la clave es trim+minúsculas, NO normalizeString — normalizeString
    // elimina el "+" y colapsa "Galaxy S26" con "Galaxy S26+" (pares reales del
    // catálogo Rent), lo que repreciaría una venta con la tarifa del otro modelo.
    // Nueva Venta autofilla por nombre EXACTO, así que aquí el exacto es lo seguro.
    // 'Repos UP' es la palanca «Repos (Arpu)»: su precio también se congela en la
    // venta (cuota = comisión × multiplicador), así que cambiar la tarifa a mitad de
    // mes tampoco corregía las ventas ya tecleadas.
    const rows = await prisma.productCatalog.findMany({ where: { periodId: wp.id, categoria: { in: ['Rent', 'Seguro', 'Repos UP'] } } })
    const byName: Record<string, Record<string, any[]>> = { Rent: {}, Seguro: {}, 'Repos UP': {} }
    for (const r of rows) {
      const k = String(r.producto || '').trim().toLowerCase()
      if (!k) continue
      const cat = String(r.categoria)
      if (!byName[cat][k]) byName[cat][k] = []
      byName[cat][k].push(r)
    }

    // Mismo criterio híbrido que el GET de ventas: las del periodo anclado MÁS
    // las huérfanas (periodId null, tecleadas antes de crear el WorkPeriod o
    // des-ancladas al mover la fecha) que caen en el mes por su fecha. Si no,
    // esas ventas se ven en pantalla pero el reprice las saltaría en silencio.
    const mm = String(wp.month).padStart(2, '0')
    const sales = await prisma.sale.findMany({
      where: {
        OR: [
          { periodId: wp.id },
          { periodId: null, fecha: { contains: `/${mm}/${wp.year}` } },
        ],
      },
    })

    const num = (v: any): number => {
      const n = v === null || v === undefined || v === '' ? NaN : parseFloat(String(v).replace(',', '.'))
      return isNaN(n) ? 0 : n
    }
    const precioDe = (c: any): number | null => {
      // Repos (Arpu): el importe es comisión × multiplicador, igual que lo calcula
      // Nueva Venta. Un multiplicador a 0 o vacío vale 1 (mismo criterio que allí).
      if (String(c.categoria) === 'Repos UP') {
        if (c.comision === null || c.comision === undefined || c.comision === '') return null
        const mult = num(c.comisionConCoste)
        return Math.round(num(c.comision) * (mult === 0 ? 1 : mult) * 100) / 100
      }
      // Rent: 'anual' = Cuota Total del dispositivo. Seguro: 'anual' = prima anual.
      const raw = c.anual || c.mensual
      const n = raw ? parseFloat(String(raw).replace(',', '.')) : NaN
      return isNaN(n) ? null : n
    }

    let actualizadas = 0
    let sinCambio = 0
    let sinVigencia = 0
    let manuales = 0
    const detalles: any[] = []
    const updates: any[] = []

    for (const s of sales) {
      // Las anuladas no cuentan en ningún cálculo: no se tocan.
      if (isSaleCancelled(s)) continue

      // ¿Rent, Seguro o Repos (Arpu)? Mismo criterio que las pantallas (detalle con
      // respaldo grupo/sheet: en las ventas de repos el sheet suele venir como 'OP').
      const det = String(s.detalle || '').toLowerCase()
      const grp = String(s.grupo || s.sheet || '').toLowerCase()
      const esRent = det === 'rent' || det === 'tma' || grp === 'rent'
      const esSeguro = det === 'seguro' || grp === 'seguro'
      const esRepo = det === 'repos up' || grp === 'repos up'
      if (!esRent && !esSeguro && !esRepo) continue

      if (esRepo) {
        // Estos dos NO tienen precio de tarifa: salen de casillas que teclea la
        // persona (el incremento de ARPU, o Fact. Anterior/Fact. Nueva). Reprecarlos
        // sería inventarles un importe.
        if (esRepoArpuManual(s.producto) || esIncrementoArpu(s.producto)) { manuales++; continue }
        // Un repo a 0 € es una suscripción sobre un traslado, que Telefónica no
        // abona a propósito. Darle precio ahora sería cobrar de más.
        if (Number(s.cuota || 0) === 0) { manuales++; continue }
      }

      const catKey = esSeguro ? 'Seguro' : (esRepo ? 'Repos UP' : 'Rent')
      const k = String(s.producto || '').trim().toLowerCase()
      if (!k) continue
      const cands = byName[catKey][k]
      if (!cands || cands.length === 0) continue // producto fuera del catálogo: no se toca

      // Vigencia que CUBRE la fecha de la venta (una vigencia sin fechas cubre todo).
      // ESTRICTO: aquí no vale el "si ninguna cubre, la primera" de las pantallas;
      // sin cobertura no se toca la venta.
      const covering = cands.filter((c: any) => isVentaWithinDates(s.fecha, c.validFrom, c.validTo))
      const elegido = covering.length > 0 ? covering[0] : null
      if (!elegido) { sinVigencia++; continue }

      const nuevo = precioDe(elegido)
      if (nuevo === null) { sinVigencia++; continue }

      // Valor actual de la foto: Seguro mira la prima (seguroImporte, con respaldo
      // cuota); Rent mira la cuota (precio del dispositivo).
      const actualRaw = esSeguro ? (s.seguroImporte ?? s.cuota) : s.cuota
      const actual = (actualRaw === null || actualRaw === undefined) ? null : Number(actualRaw)
      const seguroDesalineado = esSeguro && s.seguroImporte !== null && s.cuota !== null && Math.abs(Number(s.seguroImporte) - Number(s.cuota)) >= 0.005
      if (actual !== null && Math.abs(actual - nuevo) < 0.005 && !seguroDesalineado) { sinCambio++; continue }

      // PRECIO MANUAL RESPETADO: si el valor actual no coincide con NINGUNA
      // tarifa de las vigencias del producto, es un precio tecleado a mano
      // (p.ej. un descuento negociado) → no se machaca. Solo se corrige lo que
      // claramente vino de un autorrelleno con la tarifa equivocada.
      const tarifas = cands.map(precioDe).filter((p): p is number => p !== null)
      const esManual = actual !== null && actual !== 0 && !tarifas.some(p => Math.abs(p - actual) < 0.005)
      if (esManual) { manuales++; continue }

      const data: any = { cuota: nuevo }
      if (esSeguro) data.seguroImporte = nuevo
      updates.push(prisma.sale.update({ where: { id: s.id }, data }))
      actualizadas++
      if (detalles.length < 40) {
        detalles.push({ producto: s.producto, fecha: s.fecha, vendedor: s.vendedor, de: actual, a: nuevo })
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates)
      // Mismo disparador reactivo que el PATCH de ventas: las reglas de extras
      // dependen de los importes, así que se re-evalúan tras el cambio masivo.
      await runExtrasEngine(wp.id).catch(console.error)
    }

    return NextResponse.json({ success: true, actualizadas, sinCambio, sinVigencia, manuales, detalles })
  } catch (e: any) {
    console.error('Error en POST /api/catalogs/reprice:', e)
    return NextResponse.json({ success: false, error: 'Error del servidor: ' + e.message }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
