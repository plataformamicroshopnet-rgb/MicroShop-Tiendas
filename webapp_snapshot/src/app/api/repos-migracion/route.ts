import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { getSession } from '@/lib/auth'
import { PALANCA_REPOS, PALANCA_REPO_FUTBOL } from '@/lib/salesUtils'
import { loadPanelInputs } from '@/lib/panelComisionesTiendasServer'
import { computePanelComisionesTiendas } from '@/lib/panelComisionesTiendas'
import { computeComisionJefeTiendas, jefePctKeysTodas, resolverJefePcts } from '@/lib/comisionJefeTiendas'

const prisma = new PrismaClient()
export const dynamic = 'force-dynamic'

/**
 * PASAR LAS VENTAS DEL MES EN CURSO A LA PALANCA NUEVA DE LOS REPOS.
 *
 * Es el hermano de /api/repos-correccion, para el otro lado del calendario:
 *
 *  · ANTES del 01/08/2026 (meses ya pagados) → repos-correccion: la venta NO se
 *    toca y se le cuelga una hija con el precio bueno. La nómina no se mueve
 *    porque la palanca nueva no comisiona en esas fechas.
 *  · DESDE el 01/08/2026 (mes vivo) → ESTO: la venta se CONVIERTE en el sitio.
 *    Aquí no hay nada que proteger (agosto se paga el 1 de diciembre) y colgarle
 *    una hija pagaría DOS veces, porque en agosto la palanca nueva sí comisiona.
 *
 * Qué le pasa a cada venta:
 *  · «Extra Repos up destino Fútbol» (10 €) → se convierte en el repo de verdad,
 *    «Futbol Total PROMO Repo Up Destino Fútbol» 78 € en «Repos (Arpu)», y se le
 *    crea al lado su extra de 10 € en «Repo Fútbol», ENLAZADO: anular una se
 *    lleva la otra. Es exactamente lo que hace Nueva Venta al teclearla hoy.
 *  · Suscripción de TV → pasa a «Repos (Arpu)» con su producto y precio buenos.
 *  · Los «Repos destino BAF miMovistar/Fusión incremento de ARPU …» NO se tocan:
 *    no existen en la palanca nueva y se siguen vendiendo tal cual.
 *
 * GET  → vista previa. No escribe nada. Dice venta por venta lo que pasaría, lo
 *        que cambia en lo que factura la empresa Y lo que cambia en la comisión
 *        de cada comercial (que aquí SÍ se mueve: hay que verlo antes de pulsar).
 * POST → lo ejecuta. Solo ADMIN, doble llave (hay que teclear el mes) y por
 *        familias en transacción. Es idempotente: lo ya convertido se salta.
 */

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
const clave = (t: any) => String(t || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const TARIFA_NORM: Record<string, [string, number]> = Object.fromEntries(
  Object.entries(TARIFA).map(([k, v]) => [clave(k), v])
)

const REPO_FUTBOL = 'Futbol Total PROMO Repo Up Destino Fútbol'
const EXTRA_FUTBOL = 'Repo Up Destino Fútbol'
const IMPORTE_EXTRA = 10.00

const anulada = (s: any) => {
  const a = String(s?.anulado || '').toLowerCase()
  return a === 'si' || a === 'sí' || String(s?.pendiente || '').toLowerCase() === 'anulado'
}
const esFutbolViejo = (p: any) => {
  const t = clave(p)
  return t.includes('extra repo') && t.includes('futbol')
}
const esTVVieja = (d: any) => clave(d).startsWith('suscripciones tv') || clave(d).startsWith('suscripcion tv')
/** Solo se convierte lo del mes vivo: de agosto de 2026 en adelante. */
const esDeAgostoEnAdelante = (fecha: any): boolean => {
  const f = String(fecha || '').trim()
  if (f.length < 10 || f[2] !== '/' || f[5] !== '/') return false
  const d = new Date(Number(f.slice(6, 10)), Number(f.slice(3, 5)) - 1, Number(f.slice(0, 2)))
  return d >= new Date(2026, 7, 1)
}

/** Cómo queda una venta convertida. null = esta venta no se toca. */
function conversionDe(s: any): { producto: string; cuota: number; extra: boolean } | null {
  if (esFutbolViejo(s.producto)) return { producto: REPO_FUTBOL, cuota: 78.00, extra: true }
  if (esTVVieja(s.detalle || s.sheet)) {
    const t = TARIFA_NORM[clave(s.producto)]
    if (!t) return null
    // Un fútbol tecleado como suscripción de TV vale igual: 78 € + su extra.
    if (t[0] === REPO_FUTBOL) return { producto: REPO_FUTBOL, cuota: t[1], extra: true }
    return { producto: t[0], cuota: t[1], extra: false }
  }
  return null
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

async function analizar(mes: string) {
  const { input, ventas, wp } = await loadPanelInputs(prisma, mes)
  if (!wp) return { error: `El mes ${mes} no existe.` }

  // Ya convertidas: las que viven en la palanca nueva. Y los extras ya creados,
  // para no duplicar el de 10 € si el proceso se lanza dos veces.
  const conExtra = new Set(
    ventas.filter((v: any) => String(v.detalle || '') === PALANCA_REPO_FUTBOL && v.sustituyeA)
          .map((v: any) => String(v.sustituyeA))
  )

  const filas: any[] = []
  const sinTarifa: Record<string, number> = {}
  let cobroAntes = 0, cobroDespues = 0
  let fueraDeFecha = 0, intocables = 0

  for (const s of ventas as any[]) {
    if (anulada(s)) continue
    const det = String(s.detalle || s.sheet || '')
    if (det === PALANCA_REPOS || det === PALANCA_REPO_FUTBOL) continue   // ya está
    if (!esFutbolViejo(s.producto) && !esTVVieja(det)) {
      if (clave(det) === 'repos') intocables++      // los «incremento de ARPU»
      continue
    }
    if (!esDeAgostoEnAdelante(s.fecha)) { fueraDeFecha++; continue }
    const conv = conversionDe(s)
    if (!conv) { const k = String(s.producto || '(sin producto)'); sinTarifa[k] = (sinTarifa[k] || 0) + 1; continue }

    const antes = Number(s.cuota || 0)
    const despues = conv.cuota + (conv.extra && !conExtra.has(s.id) ? IMPORTE_EXTRA : 0)
    cobroAntes += antes; cobroDespues += despues
    filas.push({
      id: s.id, fecha: s.fecha, comercial: s.vendedor, tienda: s.codigo,
      cliente: s.nombreCliente || s.nif, nif: s.nif,
      palancaActual: det, productoActual: s.producto, importeActual: antes,
      productoNuevo: conv.producto, importeNuevo: conv.cuota,
      creaExtra: conv.extra && !conExtra.has(s.id),
      total: despues,
    })
  }

  // ── Lo que cambia en la NÓMINA. Se calcula con el mismo motor que paga, sobre
  //    una copia en memoria de las ventas ya convertidas: no se escribe nada.
  const porId = new Map(filas.map(f => [f.id, f]))
  const ventasDespues: any[] = []
  for (const s of ventas as any[]) {
    const f = porId.get(s.id)
    if (!f) { ventasDespues.push(s); continue }
    ventasDespues.push({ ...s, sheet: PALANCA_REPOS, detalle: PALANCA_REPOS,
                         producto: f.productoNuevo, cuota: f.importeNuevo,
                         importe: String(f.importeNuevo) })
    if (f.creaExtra) {
      ventasDespues.push({ ...s, id: `${s.id}-extra`, sheet: PALANCA_REPO_FUTBOL,
                           detalle: PALANCA_REPO_FUTBOL, producto: EXTRA_FUTBOL,
                           cuota: IMPORTE_EXTRA, importe: String(IMPORTE_EXTRA),
                           sustituyeA: s.id })
    }
  }
  const antes: any = computePanelComisionesTiendas(input)
  const despues: any = computePanelComisionesTiendas({ ...input, sales: ventasDespues })

  // El JEFE va aparte (su comisión es un % sobre la BASE de cada palanca, no sobre
  // lo que cobra el equipo), y es justo el que más se mueve: la base de Repos se
  // multiplica al poner los precios de verdad. Mismos insumos que usa la
  // liquidación que se manda al ERP, para que no haya dos cifras del mismo mes.
  let jefeAntes = 0, jefeDespues = 0, jefeNombre = 'Salva'
  try {
    const [pctSettings, terrSetting, jefeUser] = await Promise.all([
      prisma.appSetting.findMany({ where: { key: { in: jefePctKeysTodas(mes) } } }),
      prisma.appSetting.findUnique({ where: { key: `territorial_tiendas_${mes}` } }),
      prisma.user.findFirst({ where: { role: 'JEFE DE VENTAS' } }),
    ])
    const { pcts } = resolverJefePcts(new Map(pctSettings.map(x => [x.key, x.value])), mes)
    let terr: any[] = []
    if (terrSetting?.value) { try { terr = JSON.parse(terrSetting.value) || [] } catch {} }
    jefeNombre = jefeUser?.username || 'Salva'
    const vp = mes.replace(/[_-]/g, '')
    jefeAntes = r2(computeComisionJefeTiendas({
      sellerStats: antes.sellerStats, adjustedTiendaRules: antes.adjustedTiendaRules,
      territorialTiendasRules: terr, monthSales: ventas,
      catalogs: input.catalogs || {}, viewingPeriod: vp, pcts,
    }).total)
    jefeDespues = r2(computeComisionJefeTiendas({
      sellerStats: despues.sellerStats, adjustedTiendaRules: despues.adjustedTiendaRules,
      territorialTiendasRules: terr, monthSales: ventasDespues,
      catalogs: input.catalogs || {}, viewingPeriod: vp, pcts,
    }).total)
  } catch (e) {
    console.warn('[Migración Repos] no se pudo calcular el jefe:', e)
  }
  // El motor devuelve `sellerStats` (la liquidacion es quien luego lo convierte
  // en `porComercial`); aqui se suma directamente de ahi, que es la misma cifra
  // que sale en el Panel de Comisiones y en el abonare.
  const sumar = (r: any) => {
    const out: Record<string, number> = {}
    for (const st of r.sellerStats || []) {
      out[st.name || st.comercial] = r2(Number(st.totalComision || 0) + Number(st.totalExtras || 0))
    }
    return out
  }
  const pa = sumar(antes), pd = sumar(despues)
  const nomina = Object.keys({ ...pa, ...pd }).sort().map(k => ({
    comercial: k, antes: pa[k] || 0, despues: pd[k] || 0, dif: r2((pd[k] || 0) - (pa[k] || 0))
  })).filter(x => x.antes !== 0 || x.despues !== 0)

  filas.sort((a, b) => String(a.comercial).localeCompare(String(b.comercial)) ||
                       String(a.fecha).localeCompare(String(b.fecha)))
  return {
    mes, estadoMes: wp.status, filas, sinTarifa, fueraDeFecha, intocables,
    aConvertir: filas.length,
    extrasACrear: filas.filter(f => f.creaExtra).length,
    cobroAntes: r2(cobroAntes), cobroDespues: r2(cobroDespues), diferencia: r2(cobroDespues - cobroAntes),
    nomina,
    nominaAntes: r2(nomina.reduce((a, x) => a + x.antes, 0)),
    nominaDespues: r2(nomina.reduce((a, x) => a + x.despues, 0)),
    jefeNombre, jefeAntes, jefeDespues,
  }
}

export async function GET(request: Request) {
  const secreto = process.env.PRV_FEED_SECRET
  const conSecreto = !!secreto && request.headers.get('x-prv-secret') === secreto
  if (!conSecreto) {
    const session = await getSession()
    if (!session || String(session.user.role || '').toUpperCase() !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Solo el administrador.' }, { status: 403 })
    }
  }
  const mes = new URL(request.url).searchParams.get('mes') || ''
  if (!/^\d{4}_\d{2}$/.test(mes)) {
    return NextResponse.json({ success: false, error: 'Falta el mes (formato AAAA_MM).' }, { status: 400 })
  }
  if (mes < '2026_08') {
    return NextResponse.json({
      success: false,
      error: 'Los meses anteriores a agosto de 2026 no se convierten: para esos está la ' +
             'Corrección de precios, que no mueve la nómina de nadie.'
    }, { status: 400 })
  }
  try {
    const r: any = await analizar(mes)
    if (r.error) return NextResponse.json({ success: false, ...r }, { status: 400 })
    return NextResponse.json({ success: true, ...r })
  } catch (e: any) {
    console.error('[Migración Repos] preview:', e)
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
    const mes = String(body.mes || '').trim()
    if (!/^\d{4}_\d{2}$/.test(mes)) {
      return NextResponse.json({ success: false, error: 'Falta el mes (formato AAAA_MM).' }, { status: 400 })
    }
    if (mes < '2026_08') {
      return NextResponse.json({ success: false, error: 'Solo de agosto de 2026 en adelante.' }, { status: 400 })
    }
    if (String(body.confirmar || '') !== mes) {
      return NextResponse.json({ success: false, error: `Para ejecutar hay que confirmar escribiendo «${mes}».` }, { status: 400 })
    }

    const r: any = await analizar(mes)
    if (r.error) return NextResponse.json({ success: false, error: r.error }, { status: 400 })
    if (r.filas.length === 0) {
      return NextResponse.json({ success: true, convertidas: 0, extras: 0,
        message: 'No hay nada que pasar: ya estaba todo en la palanca nueva.' })
    }

    const madres = await prisma.sale.findMany({ where: { id: { in: r.filas.map((f: any) => f.id) } } })
    const porId = new Map(madres.map(m => [m.id, m]))

    let convertidas = 0, extras = 0
    for (const f of r.filas) {
      const m: any = porId.get(f.id)
      if (!m) continue
      // La venta y su extra viajan juntos: si se cae a medias, el cliente
      // quedaría con el repo de 78 € y sin su extra de 10 €, o al revés.
      await prisma.$transaction(async (tx) => {
        await tx.sale.update({
          where: { id: m.id },
          data: {
            sheet: PALANCA_REPOS, detalle: PALANCA_REPOS,
            producto: f.productoNuevo, cuota: f.importeNuevo,
            anotaciones: [m.anotaciones, `Pasada a Repos (Arpu) (${mes})`].filter(Boolean).join(' | '),
          }
        })
        convertidas++
        if (f.creaExtra) {
          const { id: _d, createdAt: _c, updatedAt: _u, ...resto } = m
          await tx.sale.create({
            data: {
              ...resto, id: randomUUID(),
              sheet: PALANCA_REPO_FUTBOL, detalle: PALANCA_REPO_FUTBOL,
              producto: EXTRA_FUTBOL, cuota: IMPORTE_EXTRA,
              sustituyeA: m.id, sustituida: null,
              anotaciones: 'Extra del repo de fútbol (lo crea el programa)',
            }
          })
          extras++
        }
      })
    }

    return NextResponse.json({
      success: true, convertidas, extras, sinTarifa: r.sinTarifa,
      message: `${convertidas} venta(s) pasadas a «Repos (Arpu)» y ${extras} extra(s) de 10 € creados.`
    })
  } catch (e: any) {
    console.error('[Migración Repos] ejecutar:', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  }
}
