export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { computePanelComisionesTiendas } from '@/lib/panelComisionesTiendas'
import { loadPanelInputs } from '@/lib/panelComisionesTiendasServer'
import { parseTorneosConfig, TORNEOS_CONFIG_KEY, TORNEOS_CONFIG_KEY_MES,
         periodKeyActual, repartoPorVenta, resolverObjetivosTorneo,
         canonizaVendedores } from '@/lib/torneosConfig'

// ─────────────────────────────────────────────────────────────────────────────
// LO QUE LLEVA EL COMERCIAL, PARA ENSEÑARLO MIENTRAS GRABA (dueño, 28-ago-2026).
//
// La pantalla de Nueva Venta necesita saber, ANTES de guardar, qué le va a contar
// esa venta a quien la está metiendo: en qué palanca cae, cuánto lleva, a cuánto
// está del segundo tramo y qué torneos hay abiertos.
//
// Aquí NO se calcula nada nuevo: se llama al MISMO motor que saca la nómina
// (computePanelComisionesTiendas) con los MISMOS insumos (loadPanelInputs). Si un
// mes cambia una regla, un objetivo o un torneo, esto cambia solo. Cualquier otra
// forma de hacerlo acabaría enseñando una cifra que luego no es la que cobran, que
// es peor que no enseñar nada.
//
// Devuelve lo justo para pintar el recuadro: por palanca, lo que lleva, sus dos
// objetivos y las dos tarifas; y los torneos abiertos con lo que lleva el equipo.
// ─────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient()

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const periodKey = String(searchParams.get('periodKey') || '').trim()
  const vendedor = String(searchParams.get('vendedor') || '').trim()
  if (!/^\d{4}_\d{2}$/.test(periodKey)) {
    return NextResponse.json({ success: false, error: 'Falta periodKey (YYYY_MM)' }, { status: 400 })
  }
  if (!vendedor) {
    return NextResponse.json({ success: false, error: 'Falta vendedor' }, { status: 400 })
  }

  try {
    const { input } = await loadPanelInputs(prisma, periodKey)
    if (!input.tiendaRules?.length) {
      // Sin reglas no hay nada que enseñar, y enseñar ceros engañaría.
      return NextResponse.json({ success: true, hayReglas: false, reglas: [], torneos: [] })
    }

    const result = computePanelComisionesTiendas(input)
    // El nombre se busca como lo escribe el motor: él canoniza los vendedores
    // (mayúsculas, acentos, apodos) y aquí llega tal cual lo eligió el desplegable.
    const iguales = (a: any, b: any) =>
      String(a || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
      === String(b || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    // El motor llama `name` a la persona (no `seller`, que es el campo de los extras).
    const mio = (result.sellerStats || []).find((s: any) => iguales(s.name, vendedor))

    const porNombre: Record<string, any> = {}
    for (const r of (input.tiendaRules || [])) porNombre[String(r.nombre)] = r

    const reglas = ((mio?.objetivosResumen || []) as any[]).map(o => {
      const r = porNombre[o.grupo] || {}
      return {
        grupo: o.grupo,
        // qué ventas casan con ella (lo necesita la pantalla para saber si la línea cuenta)
        productosCuentan: r.productosCuentan || '',
        // el % se cuenta en EUROS; el resto, en unidades
        esPorcentaje: String(r.importePrimerTramo || '').includes('%'),
        importe1: r.importePrimerTramo || '',
        importe2: r.importeSegundoTramo || '',
        importe3: r.importeTercerTramo || '',
        llevas: o.conseguido1,
        objetivo1: o.objetivo1,
        objetivo2: o.objetivo2,
        conseguido2: o.conseguido2,
        esEquipoObj2: o.esEquipoObj2,
        // en qué tramo se está pagando AHORA MISMO
        tramo: o.hito,
        cumplido: o.cumplido,
        topeAplicado: !!o.topeAplicado,
        topeMotivo: o.topeMotivo || null,
      }
    })

    // ── LOS TORNEOS ABIERTOS ────────────────────────────────────────────────
    // Mismo criterio que la liquidación: los del MES, y la clave global solo como
    // puente para el mes en curso hasta que se guarde una vez el configurador.
    let ts = await prisma.appSetting.findUnique({ where: { key: TORNEOS_CONFIG_KEY_MES(periodKey) } })
    if (!ts && periodKey === periodKeyActual()) {
      ts = await prisma.appSetting.findUnique({ where: { key: TORNEOS_CONFIG_KEY } })
    }
    const cfg = parseTorneosConfig(ts?.value)

    // El estado de cada torneo lo da SU PROPIO reparto: cuenta solo las ventas de
    // su ventana de fechas, resuelve los objetivos que van en % de la palanca, y
    // sabe si el mínimo del equipo está cumplido y si el bote se ha agotado. Contar
    // aquí las unidades del mes entero daría una cifra que no es la del torneo.
    const canon = canonizaVendedores(input.sales || [])
    const items = (input.sales || [])
      .filter((s: any) => {
        const v = String(s.vendedor || '').trim()
        if (!v || v.toLowerCase() === 'marta') return false
        const an = String(s.anulado || '').toLowerCase()
        const pe = String(s.pendiente || '').toLowerCase()
        return an !== 'si' && pe !== 'anulado'
      })
      .map((s: any) => ({ name: canon(String(s.vendedor || '').trim()), sale: s }))

    const torneos = (cfg?.concursos || [])
      .filter((c: any) => (c.premioModo || 'podio') === 'porVenta' && Number(c.importePorVenta) > 0)
      .map((cRaw: any) => {
        // resolverObjetivosTorneo RETIRADO (30-ago-2026): los % son los candados del motor.
        const c = cRaw
        const rep = repartoPorVenta(items, c, input.catalogs || {}, input.tiendaRules || [])
        return {
          id: c.id,
          nombre: c.nombre,
          tipoVenta: c.tipoVenta,
          desde: c.fechaInicio || '',
          hasta: c.fechaFin || '',
          importePorVenta: Number(c.importePorVenta) || 0,
          importePorVenta2: rep.importePorVenta2 || 0,
          minGrupal: rep.minGrupal,
          objetivo2Grupal: rep.objetivo2Grupal || 0,
          topeBote: rep.tope,
          // TODO del torneo, no del mes: solo las ventas de su ventana
          llevaEquipo: rep.teamVentas,
          cumplido: rep.grupalCumplido,
          objetivo2Cumplido: rep.objetivo2Cumplido,
          // el € por venta que se está pagando AHORA (el 2º si el equipo llegó)
          rateActual: rep.rateActual,
          agotado: rep.agotado,
        }
      })

    return NextResponse.json({ success: true, hayReglas: true, periodKey, vendedor, reglas, torneos })
  } catch (e: any) {
    console.error('Error en /api/comisiones-al-vuelo:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Error del servidor' }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
