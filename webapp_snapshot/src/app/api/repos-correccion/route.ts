import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { PALANCA_REPOS, PALANCA_REPO_FUTBOL } from '@/lib/salesUtils'

const prisma = new PrismaClient()
export const dynamic = 'force-dynamic'

/**
 * CORRECCIÓN CONTABLE DE LOS REPOS (ago-2026).
 *
 * Los precios de los repos estaban mal desde siempre: el «Extra Repos up destino
 * Fútbol» se registraba a 10 €, pero esos 10 € eran un EXTRA a mayores — el repo
 * de verdad vale 78 € y nunca se apuntó. Y las suscripciones de TV llevaban
 * precios viejos.
 *
 * Esto NO reescribe ninguna venta. A cada operación mal valorada se le cuelga una
 * venta HIJA con el producto y el importe buenos:
 *   · la hija vive en la palanca «Repos UP», que NO paga comisión en meses
 *     anteriores a agosto de 2026 (candado en panelComisionesTiendas);
 *   · la madre queda marcada `sustituida`: sigue pagando la comisión que se pactó
 *     con los comerciales, pero deja de sumar en lo que factura la empresa.
 * Resultado: la nómina del mes no se mueve NI UN CÉNTIMO y la facturación queda
 * con el precio de verdad.
 *
 * GET  → vista previa. No escribe nada. Devuelve cliente por cliente lo que se
 *        crearía y el antes/después de lo que se cobra.
 * POST → lo ejecuta. Es IDEMPOTENTE: si una operación ya tiene su corrección, se
 *        salta. Se puede lanzar dos veces sin duplicar nada.
 *
 * Funciona aunque el mes esté CERRADO (histórico): la corrección es justamente de
 * meses ya liquidados. Lo que protege el mes no es el candado de la pantalla, es
 * que la palanca nueva no paga comisión.
 */

// Tarifa correcta, con vigencia 01/07/2026. Clave = producto tal y como está
// tecleado hoy; valor = [producto bueno, importe]. Los «Repos destino BAF
// miMovistar/Fusión incremento de ARPU …» NO se tocan (decisión del dueño).
const TARIFA: Record<string, [string, number]> = {
  'Netflix sin anuncios': ['Netflix con anuncios', 7.86],
  'Movistar+': ['Movistar+', 24.00],
  'Netflix Estándar': ['Netflix Estándar x2', 20.98],
  'Netflix Premium': ['Netflix Premium x4', 29.98],
  'Deportes total PROMO': ['Deportes PROMO', 28.00],
  'Motor PROMO': ['Motor PROMO', 28.00],
  'Ficción total': ['Ficción Total PROMO', 36.00],
  'Champions': ['Champions', 38.00],
  'LaLiga': ['La Liga PROMO', 58.00],
  'HBO Estándar': ['HBO MAX', 21.98],
  'SkyShowtime': ['SkyShowtime', 11.99],
  'Disney + sin anuncios': ['Disney + sin anuncios', 7.86],
  'Disney + Estándar': ['Disney + Estándar PROMO', 12.36],
  'Disney + Premium': ['Disney + Premium PROMO', 23.98],
  'Futbol Total PROMO': ['Futbol Total PROMO Repo Up Destino Fútbol', 78.00],
}

const REPO_FUTBOL = 'Futbol Total PROMO Repo Up Destino Fútbol'
const EXTRA_FUTBOL = 'Repo Up Destino Fútbol'
const IMPORTE_EXTRA_FUTBOL = 10.00

const esFutbol = (p: string) => {
  const t = String(p || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return t.includes('extra repo') && t.includes('futbol')
}
const esTV = (d: string) => {
  const t = String(d || '').toLowerCase()
  return t.startsWith('suscripciones tv') || t.startsWith('suscripcion tv')
}
const anulada = (s: any) => {
  const a = String(s.anulado || '').toLowerCase()
  return a === 'si' || a === 'sí' || String(s.pendiente || '').toLowerCase() === 'anulado'
}

/** Qué hijas le tocan a una venta. [] = no hay que corregirla. */
function hijasDe(s: any): Array<{ producto: string; cuota: number; concepto: string; palanca: string }> {
  if (esFutbol(s.producto || '')) {
    // El cliente de fútbol pasa a valer 88 €, en DOS palancas distintas:
    //   · el repo de verdad (78 €) en «Repos (Arpu)» → entra en el % de Repos;
    //   · el extra (10 €) en «Repo Fútbol» → cuenta como UNA unidad de esa regla
    //     y NO engorda la base del %.
    return [
      { producto: REPO_FUTBOL, cuota: 78.00, palanca: PALANCA_REPOS,
        concepto: 'Repo de fútbol (el precio que faltaba)' },
      { producto: EXTRA_FUTBOL, cuota: IMPORTE_EXTRA_FUTBOL, palanca: PALANCA_REPO_FUTBOL,
        concepto: 'El extra de siempre' },
    ]
  }
  if (esTV(s.detalle || '')) {
    const t = TARIFA[String(s.producto || '').trim()]
    if (!t) return []
    return [{ producto: t[0], cuota: t[1], palanca: PALANCA_REPOS,
              concepto: 'Suscripción con el precio bueno' }]
  }
  return []
}

async function analizar(periodKey: string) {
  const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
  if (!wp) return { error: `El mes ${periodKey} no existe.` }

  const ventas = await prisma.sale.findMany({ where: { periodId: wp.id } })
  const yaCorregidas = new Set(
    ventas.filter(v => v.sustituyeA).map(v => String(v.sustituyeA))
  )

  const filas: any[] = []
  const sinTarifa: Record<string, number> = {}
  let cobroAntes = 0
  let cobroDespues = 0

  for (const s of ventas) {
    if (anulada(s)) continue
    // ya es una corrección (de cualquiera de las dos palancas nuevas)
    if (String(s.detalle || '') === PALANCA_REPOS) continue
    if (String(s.detalle || '') === PALANCA_REPO_FUTBOL) continue
    const hijas = hijasDe(s)
    if (esTV(s.detalle || '') && hijas.length === 0) {
      const k = String(s.producto || '(sin producto)')
      sinTarifa[k] = (sinTarifa[k] || 0) + 1
      continue
    }
    if (hijas.length === 0) continue

    const antes = Number(s.cuota || 0)
    const despues = hijas.reduce((a, h) => a + h.cuota, 0)
    cobroAntes += antes
    cobroDespues += despues
    filas.push({
      id: s.id,
      fecha: s.fecha,
      comercial: s.vendedor,
      tienda: s.codigo,
      cliente: s.nombreCliente || s.nif,
      nif: s.nif,
      productoActual: s.producto,
      importeActual: antes,
      hijas,
      importeNuevo: despues,
      yaHecha: yaCorregidas.has(s.id),
    })
  }

  filas.sort((a, b) => String(a.comercial).localeCompare(String(b.comercial)) ||
                       String(a.fecha).localeCompare(String(b.fecha)))
  return {
    periodKey,
    periodId: wp.id,
    estadoMes: wp.status,
    filas,
    sinTarifa,
    pendientes: filas.filter(f => !f.yaHecha).length,
    yaHechas: filas.filter(f => f.yaHecha).length,
    lineasACrear: filas.filter(f => !f.yaHecha).reduce((a, f) => a + f.hijas.length, 0),
    cobroAntes: Math.round(cobroAntes * 100) / 100,
    cobroDespues: Math.round(cobroDespues * 100) / 100,
    diferencia: Math.round((cobroDespues - cobroAntes) * 100) / 100,
  }
}

export async function GET(request: Request) {
  // La VISTA PREVIA no escribe nada: la puede pedir el administrador desde la
  // pantalla, o el propio servidor con el secreto (para poder verificarla sin
  // sesión). Ejecutar (POST) es SIEMPRE solo del administrador.
  const secreto = process.env.PRV_FEED_SECRET
  const conSecreto = !!secreto && request.headers.get('x-prv-secret') === secreto
  if (!conSecreto) {
    const session = await getSession()
    if (!session || String(session.user.role || '').toUpperCase() !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Solo el administrador.' }, { status: 403 })
    }
  }
  const mes = new URL(request.url).searchParams.get('mes') || '2026_07'
  try {
    const r = await analizar(mes)
    if ((r as any).error) return NextResponse.json({ success: false, ...r }, { status: 400 })
    return NextResponse.json({ success: true, ...r })
  } catch (e: any) {
    console.error('[Corrección Repos] preview:', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || String(session.user.role || '').toUpperCase() !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Solo el administrador.' }, { status: 403 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const mes = String(body.mes || '2026_07')
    // Doble llave: hay que escribir el mes a mano para ejecutar.
    if (String(body.confirmar || '') !== mes) {
      return NextResponse.json({
        success: false,
        error: `Para ejecutar hay que confirmar escribiendo «${mes}».`
      }, { status: 400 })
    }

    const r: any = await analizar(mes)
    if (r.error) return NextResponse.json({ success: false, error: r.error }, { status: 400 })

    const aCrear = r.filas.filter((f: any) => !f.yaHecha)
    if (aCrear.length === 0) {
      return NextResponse.json({ success: true, creadas: 0, marcadas: 0,
        message: 'No hay nada que corregir: ya estaba todo hecho.' })
    }

    const madres = await prisma.sale.findMany({
      where: { id: { in: aCrear.map((f: any) => f.id) } }
    })
    const porId = new Map(madres.map(m => [m.id, m]))

    let creadas = 0
    for (const f of aCrear) {
      const m: any = porId.get(f.id)
      if (!m) continue
      for (const h of f.hijas) {
        const { id: _drop, createdAt: _c, updatedAt: _u, ...resto } = m
        await prisma.sale.create({
          data: {
            ...resto,
            sheet: h.palanca,
            detalle: h.palanca,
            producto: h.producto,
            cuota: h.cuota,
            sustituyeA: m.id,
            sustituida: null,
            anotaciones: [m.anotaciones, `Corrección de precio (${mes})`]
              .filter(Boolean).join(' | '),
          }
        })
        creadas++
      }
      await prisma.sale.update({ where: { id: m.id }, data: { sustituida: true } })
    }

    return NextResponse.json({
      success: true, creadas, marcadas: aCrear.length,
      message: `${aCrear.length} operación(es) corregidas con ${creadas} línea(s) nuevas. ` +
               `Las comisiones del mes no cambian.`
    })
  } catch (e: any) {
    console.error('[Corrección Repos] ejecutar:', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  }
}
