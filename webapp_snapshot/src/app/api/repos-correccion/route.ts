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

const clave = (t: string) => String(t || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
// Indice de TARIFA por clave normalizada: un espacio de mas o una tilde distinta
// dejaba el producto sin corregir y solo se veia en un aviso de la vista previa.
const TARIFA_NORM: Record<string, [string, number]> = Object.fromEntries(
  Object.entries(TARIFA).map(([k, v]) => [clave(k), v])
)

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
    const t = TARIFA_NORM[clave(s.producto)]
    if (!t) return []
    // El mismo cliente de futbol se puede haber tecleado en «Suscripciones TV»
    // con el producto «Futbol Total PROMO». Vale igual: 78 € + su extra de 10 €.
    // Sin esto valia 88 € si se tecleo en Repos y 78 € si se tecleo en TV.
    if (t[0] === REPO_FUTBOL) {
      return [
        { producto: REPO_FUTBOL, cuota: t[1], palanca: PALANCA_REPOS,
          concepto: 'Repo de fútbol (el precio que faltaba)' },
        { producto: EXTRA_FUTBOL, cuota: IMPORTE_EXTRA_FUTBOL, palanca: PALANCA_REPO_FUTBOL,
          concepto: 'El extra de siempre' },
      ]
    }
    return [{ producto: t[0], cuota: t[1], palanca: PALANCA_REPOS,
              concepto: 'Suscripción con el precio bueno' }]
  }
  return []
}

/** Ventas de agosto de 2026 en adelante: NO se corrigen. Sus hijas naceran con
 *  fecha de agosto, el candado de fecha ya no las protege y PAGARIAN comision
 *  ademas de la madre: la misma operacion cobrada y pagada dos veces. */
const esDeAgostoEnAdelante = (fecha: any): boolean => {
  const f = String(fecha || '').trim()
  if (f.length < 10 || f[2] !== '/' || f[5] !== '/') return false
  const d = new Date(Number(f.slice(6, 10)), Number(f.slice(3, 5)) - 1, Number(f.slice(0, 2)))
  return d >= new Date(2026, 7, 1)
}

async function analizar(periodKey: string) {
  const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
  if (!wp) return { error: `El mes ${periodKey} no existe.` }

  const ventas = await prisma.sale.findMany({ where: { periodId: wp.id } })
  // Hijas VIVAS por madre (las anuladas no cuentan): «ya hecha» tiene que
  // significar «tiene las hijas que le tocan», no «tiene alguna». Si no, una
  // familia a medias (p. ej. el repo creado y el extra no) se daba por buena
  // para siempre y nadie volvia a mirarla.
  const hijasVivas: Record<string, Set<string>> = {}
  for (const v of ventas) {
    if (!v.sustituyeA) continue
    if (anulada(v)) continue
    const k = String(v.sustituyeA)
    if (!hijasVivas[k]) hijasVivas[k] = new Set()
    hijasVivas[k].add(`${String(v.detalle || '')}|${String(v.producto || '')}`)
  }

  const filas: any[] = []
  const sinTarifa: Record<string, number> = {}
  let cobroAntes = 0
  let cobroDespues = 0

  let saltadasPorFecha = 0
  for (const s of ventas) {
    if (anulada(s)) continue
    if (esDeAgostoEnAdelante(s.fecha)) { saltadasPorFecha++; continue }
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
      yaHecha: hijas.every(h => (hijasVivas[s.id] || new Set()).has(`${h.palanca}|${h.producto}`)),
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
    saltadasPorFecha,
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
    // Meses que se pueden corregir: los anteriores a agosto de 2026 (de agosto en
    // adelante manda ya la palanca nueva). Van a un desplegable: antes el mes era
    // un campo de texto libre y bastaba escribirlo mal para tocar otro.
    const periodos = await prisma.workPeriod.findMany({ orderBy: { period_key: 'desc' } })
    const meses = periodos
      .map(p => ({ mes: p.period_key, estado: p.status }))
      .filter(m => m.mes < '2026_08')
    const r = await analizar(mes)
    if ((r as any).error) return NextResponse.json({ success: false, meses, ...r }, { status: 400 })
    return NextResponse.json({ success: true, meses, ...r })
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
    // Sin valor por defecto: un POST sin mes corregia julio por su cuenta.
    const mes = String(body.mes || '').trim()
    if (!/^\d{4}_\d{2}$/.test(mes)) {
      return NextResponse.json({ success: false, error: 'Falta el mes (formato AAAA_MM).' }, { status: 400 })
    }
    // Agosto de 2026 en adelante NO se corrige: ahi la palanca nueva SI paga
    // comision, asi que la hija cobraria ademas de la madre.
    if (mes >= '2026_08') {
      return NextResponse.json({
        success: false,
        error: 'Este mes ya usa la palanca nueva: corregirlo pagaría la misma operación dos veces. ' +
               'La corrección es solo para los meses anteriores a agosto de 2026.'
      }, { status: 400 })
    }
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
      // Una familia entera o ninguna: si se cae a medias, la madre quedaba
      // marcada como corregida con solo una de sus dos hijas (o al reves, con
      // hijas y sin marcar, y entonces se cobraba dos veces).
      await prisma.$transaction(async (tx) => {
        for (const h of f.hijas) {
          const { id: _drop, createdAt: _c, updatedAt: _u, ...resto } = m
          await tx.sale.create({
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
        await tx.sale.update({ where: { id: m.id }, data: { sustituida: true } })
      })
    }

    return NextResponse.json({
      success: true, creadas, marcadas: aCrear.length,
      sinTarifa: r.sinTarifa,
      message: `${aCrear.length} operación(es) corregidas con ${creadas} línea(s) nuevas. ` +
               `Las comisiones del mes no cambian.`
    })
  } catch (e: any) {
    console.error('[Corrección Repos] ejecutar:', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  }
}
