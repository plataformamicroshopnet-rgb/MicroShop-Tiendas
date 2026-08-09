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
 * CLASIFICAR LOS REPOS DE PAQUETES DE TV QUE SE QUEDARON EN LA PALANCA VIEJA.
 *
 * La migración de agosto movió a las palancas nuevas los productos del fútbol y
 * las suscripciones de TV, pero dejó a propósito los «Repos destino BAF
 * miMovistar/Fusión incremento de ARPU…» — los repos de paquetes (Netflix,
 * Deportes, Movistar Plus, Disney+…) — porque no tenían sitio en el catálogo
 * nuevo. El dueño pasó el 09-ago-2026 la lista de cuáles son y a dónde van:
 *
 *  · Cada operación de su lista → «Repos (Arpu)» con su cuota (o «Repo Fútbol»
 *    si la línea localizada es el extra de 10 €).
 *  · Dos venían tecleadas con erratas y se corrigen de paso: el Netflix de
 *    Raquel (tecleado el 16/07, era del 15/07) y el Motor de la S.L. (tecleado
 *    el 03/07 con el CIF en la casilla del boletín, era del 05/07).
 *  · Dos no estaban tecleadas y se dan de alta a 0 €: el Deportes de Raquel
 *    (25/07) y la Ficción de la S.L. (02/07).
 *  · Lo que quede en la palanca vieja con fecha de JULIO o AGOSTO y no esté en
 *    la lista SE ELIMINA (instrucción del dueño). Junio y anteriores NI SE
 *    TOCAN: son lo que coteja el ERP contra Telefónica. Las madres corregidas
 *    (sustituida) tampoco: son el ancla contable de sus hijas.
 *
 * GET  → vista previa completa: qué se mueve, qué se corrige, qué se da de
 *        alta, qué se elimina y cómo queda la nómina de julio y agosto.
 * POST → lo ejecuta. Solo ADMIN, doble llave (hay que escribir CLASIFICAR).
 *        Idempotente: lo ya movido sale como «ya está» y no se toca.
 */

// ── LA LISTA DEL DUEÑO (09-ago-2026), tal cual la pasó ───────────────────────
// destinoFijo solo se usa cuando la línea no se localiza y hay que darla de
// alta; para las localizadas el destino lo decide su producto.
interface Encargo {
  nif: string; nombre: string; contrato: string; fecha: string; boletin: string
  /** Cómo encontrarla si el boletín no está donde debe (las dos con erratas). */
  buscarBoletin?: string
  /** Fecha con la que está tecleada, si no es la buena. */
  fechaTecleada?: string
  /** Si no aparece tecleada: darla de alta (a 0 €). */
  altaSiFalta?: boolean
  /** Al mover, corregir también el boletín (la S.L. llevaba el CIF). */
  corregirBoletin?: boolean
}

const LISTA: Encargo[] = [
  { nif: '07868715R', nombre: 'Jerónimo Cañada Isidro', contrato: 'Ficción Total con Netflix', fecha: '05/08/2026', boletin: 'CO26087HLZUFVE' },
  { nif: '70935711P', nombre: 'Oscar', contrato: 'Movistar Plus', fecha: '03/08/2026', boletin: 'CO2608TPE1ENTJ' },
  { nif: '07811149G', nombre: 'Jose Antonio', contrato: 'Fútbol Total', fecha: '01/08/2026', boletin: 'CO2608TLDRM8QV' },
  { nif: '07797253T', nombre: 'Emilio Isidro Del Collado', contrato: 'Movistar Plus', fecha: '04/08/2026', boletin: 'CO2608IU6NKNZJ' },
  { nif: '07860437A', nombre: 'Jose Manuel Martin Picado', contrato: 'Netflix', fecha: '13/07/2026', boletin: 'CO2607SEBRBRF9' },
  { nif: '45085683W', nombre: 'Jesus Maria', contrato: 'Motor', fecha: '31/07/2026', boletin: 'CO2607VIRWJHHC' },
  { nif: '45085683W', nombre: 'Jesus Maria', contrato: 'Ficción Total con Disney', fecha: '31/07/2026', boletin: 'CO2607T51FWMDI' },
  { nif: '70868707A', nombre: 'Roberto Angel', contrato: 'Disney+', fecha: '29/07/2026', boletin: 'CO2607ZWA5ZPCK' },
  { nif: '07698363X', nombre: 'Maria Teresa', contrato: 'Deportes', fecha: '28/07/2026', boletin: 'CO2607V3OED3WF' },
  { nif: '07698363X', nombre: 'Maria Teresa', contrato: 'Movistar Plus', fecha: '27/07/2026', boletin: 'CO2607THYH6IN9' },
  { nif: '08103365M', nombre: 'Iluminada', contrato: 'Deportes', fecha: '28/07/2026', boletin: 'CO2607V7S2FKBK' },
  { nif: '07849546Z', nombre: 'Emilio', contrato: 'Movistar Plus', fecha: '25/07/2026', boletin: 'CO2607XSEDTN29' },
  { nif: '07730987C', nombre: 'Volusiano', contrato: 'Movistar Plus', fecha: '24/07/2026', boletin: 'CO26073R1QCQS1' },
  { nif: '07823055L', nombre: 'Emilio', contrato: 'Deportes', fecha: '24/07/2026', boletin: 'CO2607TFE6IOJV' },
  { nif: '07745250T', nombre: 'Juan Antonio', contrato: 'Deportes', fecha: '23/07/2026', boletin: 'CO26072AD4GCOC' },
  { nif: '07849277K', nombre: 'Luis Alberto', contrato: 'Netflix', fecha: '22/07/2026', boletin: 'CO2607IQ71I856' },
  { nif: '07849277K', nombre: 'Luis Alberto', contrato: 'Fútbol Total', fecha: '21/07/2026', boletin: 'CO2607T9H7HIY1' },
  { nif: '07959366D', nombre: 'Francisco', contrato: 'HBO MAX', fecha: '22/07/2026', boletin: 'CO260778MNKOYC' },
  { nif: '76028735G', nombre: 'Veronica', contrato: 'Fútbol Total', fecha: '27/07/2026', boletin: 'CO2607XSEJ4DFG' },
  { nif: '06916490E', nombre: 'Felix', contrato: 'Movistar Plus', fecha: '11/07/2026', boletin: 'CO26077HY432F6' },
  { nif: '12729698A', nombre: 'Ramiro', contrato: 'Movistar Plus', fecha: '06/07/2026', boletin: 'CO2607ZWDZ9OIC' },
  { nif: '12729698A', nombre: 'Ramiro', contrato: 'Ficción total con Netflix', fecha: '07/07/2026', boletin: 'CO2607T8UHKOAK' },
  { nif: '07789750H', nombre: 'Sonsoles', contrato: 'Netflix', fecha: '03/07/2026', boletin: 'CO2607T57814SV' },
  { nif: '07810885Q', nombre: 'Pedro', contrato: 'Ficción total con Netflix', fecha: '02/07/2026', boletin: 'CO26072LR5S28I' },
  // Las dos con erratas de tecleo (aclaradas por el dueño el 09-ago):
  { nif: '70893967D', nombre: 'Raquel', contrato: 'Netflix (dio de alta el 15/7)', fecha: '15/07/2026', boletin: 'CO26073W9Y1LLJ', buscarBoletin: 'CO26073W9Y1LLJ', fechaTecleada: '16/07/2026' },
  { nif: 'B37034972', nombre: 'Inmuebles y Edificios Salamanca S.L.', contrato: 'Motor (dio de alta el 5/7)', fecha: '05/07/2026', boletin: '', buscarBoletin: 'B37034972', fechaTecleada: '03/07/2026', corregirBoletin: true },
  // Las dos que faltan por teclear (alta nueva a 0 € si en producción tampoco están):
  { nif: '70893967D', nombre: 'Raquel', contrato: 'Deportes', fecha: '25/07/2026', boletin: 'CO2607ZCXGXTMC', altaSiFalta: true },
  { nif: 'B37034972', nombre: 'Inmuebles y Edificios Salamanca S.L.', contrato: 'Ficción total con Netflix', fecha: '02/07/2026', boletin: 'CO2607XXHM16L1', altaSiFalta: true },
]

const PRODUCTO_ALTA = 'Repos destino BAF miMovistar/Fusión incremento de ARPU >=6€ y <10€'

const norm = (t: any) => String(t || '').trim().toUpperCase()
const clave = (t: any) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const anulada = (s: any) => {
  const a = String(s?.anulado || '').toLowerCase()
  return a === 'si' || a === 'sí' || String(s?.pendiente || '').toLowerCase() === 'anulado'
}
const esJulAgo = (fecha: any) => {
  const f = String(fecha || '')
  return f.endsWith('/07/2026') || f.endsWith('/08/2026')
}
const esPalancaVieja = (s: any) => clave(s.detalle || s.sheet) === 'repos'
const esTV = (s: any) => clave(s.detalle || s.sheet).startsWith('suscripcion')
const esExtraFutbol = (p: any) => { const t = clave(p); return t.includes('extra repo') && t.includes('futbol') }

async function analizar() {
  const ventas = await prisma.sale.findMany()
  // El boletín puede vivir en numeroPedido (Nueva Venta de hoy) o en el campo
  // boletin antiguo: se indexan LOS DOS.
  const porBoletin = new Map<string, any[]>()
  const indexa = (k: string, v: any) => {
    if (!k) return
    if (!porBoletin.has(k)) porBoletin.set(k, [])
    const l = porBoletin.get(k)!
    if (!l.includes(v)) l.push(v)
  }
  for (const v of ventas) { indexa(norm(v.numeroPedido), v); indexa(norm((v as any).boletin), v) }

  const usadas = new Set<string>()
  const mover: any[] = []       // localizada en palanca vieja/TV → se mueve
  const yaEsta: any[] = []      // ya vive en una palanca nueva
  const yaCorregida: any[] = [] // madre sustituida: sus hijas ya están migradas
  const altas: any[] = []       // no aparece: alta nueva a 0 €
  const dudosas: any[] = []     // localizada pero en una palanca inesperada

  for (const e of LISTA) {
    // 1º por boletín (el de la lista, o el tecleado en las dos con erratas).
    let candidatas = porBoletin.get(norm(e.buscarBoletin || e.boletin)) || []
    // 2º por NIF + fecha (la tecleada o la buena: tras corregir, la fila lleva
    // la buena). Se mira la palanca vieja, las suscripciones de TV y TAMBIÉN
    // las nuevas: si ya se movió, hay que reconocerla como «ya está», no darla
    // por desaparecida.
    if (candidatas.length === 0) {
      const fechas = new Set([e.fechaTecleada || e.fecha, e.fecha])
      const esNueva = (x: any) => { const d = String(x.detalle || x.sheet || ''); return d === PALANCA_REPOS || d === PALANCA_REPO_FUTBOL }
      candidatas = ventas.filter(v => norm(v.nif) === norm(e.nif) && fechas.has(String(v.fecha))
        && (esPalancaVieja(v) || esTV(v) || esNueva(v)))
    }
    candidatas = candidatas.filter(v => !usadas.has(v.id) && !anulada(v))
    // Si un cliente tiene el repo Y su extra de Fútbol el mismo día (José
    // Antonio), la fila de la lista es el repo: el extra lo lleva otra pantalla.
    const v = candidatas.find(x => (esPalancaVieja(x) || esTV(x)) && !esExtraFutbol(x.producto))
      || candidatas.find(x => !esExtraFutbol(x.producto))
      || candidatas[0]

    if (!v) {
      if (e.altaSiFalta) altas.push({ ...e })
      else dudosas.push({ ...e, motivo: 'No aparece tecleada y no estaba prevista como alta: revisar a mano.' })
      continue
    }
    usadas.add(v.id)
    const det = String(v.detalle || v.sheet || '')
    const base = {
      id: v.id, nif: e.nif, cliente: e.nombre, contrato: e.contrato,
      fecha: String(v.fecha), producto: v.producto, cuota: Number(v.cuota || 0),
      vendedor: v.vendedor, palancaActual: det, boletin: norm(v.numeroPedido),
    }
    if (det === PALANCA_REPOS || det === PALANCA_REPO_FUTBOL) { yaEsta.push(base); continue }
    if ((v as any).sustituida === true) { yaCorregida.push(base); continue }
    if (!esPalancaVieja(v) && !esTV(v)) { dudosas.push({ ...base, motivo: `Está en «${det}», una palanca que no esperaba: revisar a mano.` }); continue }
    if (esExtraFutbol(v.producto)) {
      // El extra de 10 € no se mueve a secas: le falta su repo de 78 €. Eso lo
      // hacen las pantallas hechas para ello (julio corrige colgando hija;
      // agosto convierte en el sitio).
      dudosas.push({ ...base, motivo: String(v.fecha).includes('/07/')
        ? 'Es el extra de Fútbol de julio y sigue sin corregir: pásalo antes por «Corrección de precios de los Repos».'
        : 'Es el extra de Fútbol del mes vivo: lo convierte «Migración de Repos», no esta pantalla.' })
      continue
    }

    mover.push({
      ...base,
      destino: PALANCA_REPOS,
      fechaNueva: e.fechaTecleada && e.fecha !== String(v.fecha) ? e.fecha : null,
      // El boletín solo se pisa cuando el que hay es basura: vacío o el propio
      // NIF en la casilla (la S.L.). Uno tecleado de verdad no se toca aunque
      // no coincida con la lista.
      boletinNuevo: e.corregirBoletin || norm(v.numeroPedido) === norm(e.nif)
        ? (e.boletin || '')
        : (!norm(v.numeroPedido) && e.boletin ? e.boletin : null),
    })
  }

  // ── El barrido: lo de julio/agosto de la palanca vieja que NO está en la
  //    lista se elimina. Vivas y sin corregir; las madres y junio, ni tocarlos.
  const eliminar = ventas.filter(v =>
    esPalancaVieja(v) && esJulAgo(v.fecha) && !anulada(v)
    && (v as any).sustituida !== true && !usadas.has(v.id)
    && !esExtraFutbol(v.producto) // los extras de Fútbol son de las otras pantallas
  ).map(v => ({
    id: v.id, fecha: String(v.fecha), producto: v.producto, cuota: Number(v.cuota || 0),
    vendedor: v.vendedor, cliente: v.nombreCliente || v.nif, nif: v.nif, boletin: norm(v.numeroPedido),
  }))
  const madresRespetadas = ventas.filter(v => esPalancaVieja(v) && esJulAgo(v.fecha) && (v as any).sustituida === true).length
  const extrasFutbolAparte = ventas.filter(v => esPalancaVieja(v) && esJulAgo(v.fecha) && !anulada(v)
    && (v as any).sustituida !== true && esExtraFutbol(v.producto) && !usadas.has(v.id)).length

  // ── La nómina de julio y de agosto, antes y después, con el motor que paga ──
  const nominas: any[] = []
  for (const mes of ['2026_07', '2026_08']) {
    try {
      const { input, ventas: vMes, wp } = await loadPanelInputs(prisma, mes)
      if (!wp) continue
      const movIds = new Map(mover.map(m => [m.id, m]))
      const delIds = new Set(eliminar.map(x => x.id))
      const despuesVentas: any[] = []
      for (const s of vMes as any[]) {
        if (delIds.has(s.id)) continue
        const m = movIds.get(s.id)
        if (m) despuesVentas.push({ ...s, sheet: m.destino, detalle: m.destino, fecha: m.fechaNueva || s.fecha })
        else despuesVentas.push(s)
      }
      const sufMes = mes === '2026_07' ? '/07/2026' : '/08/2026'
      for (const a of altas) {
        if (!a.fecha.endsWith(sufMes)) continue
        despuesVentas.push({ id: `alta-${a.boletin}`, fecha: a.fecha, nif: a.nif, nombreCliente: a.nombre,
          sheet: PALANCA_REPOS, detalle: PALANCA_REPOS, producto: PRODUCTO_ALTA, cuota: 0, importe: '0',
          vendedor: '', codigo: '', pendiente: 'No', anulado: 'No' })
      }
      const antes: any = computePanelComisionesTiendas(input)
      const despues: any = computePanelComisionesTiendas({ ...input, sales: despuesVentas })
      const sumar = (r: any) => {
        const out: Record<string, number> = {}
        for (const st of r.sellerStats || []) out[st.name || st.comercial] = r2(Number(st.totalComision || 0) + Number(st.totalExtras || 0))
        return out
      }
      const pa = sumar(antes), pd = sumar(despues)
      const detalle = Object.keys({ ...pa, ...pd }).sort()
        .map(k => ({ comercial: k, antes: pa[k] || 0, despues: pd[k] || 0, dif: r2((pd[k] || 0) - (pa[k] || 0)) }))
        .filter(x => x.antes !== 0 || x.despues !== 0)

      let jefeAntes = 0, jefeDespues = 0
      try {
        const [pctSettings, terrSetting] = await Promise.all([
          prisma.appSetting.findMany({ where: { key: { in: jefePctKeysTodas(mes) } } }),
          prisma.appSetting.findUnique({ where: { key: `territorial_tiendas_${mes}` } }),
        ])
        const { pcts } = resolverJefePcts(new Map(pctSettings.map(x => [x.key, x.value])), mes)
        let terr: any[] = []
        if (terrSetting?.value) { try { terr = JSON.parse(terrSetting.value) || [] } catch {} }
        const vp = mes.replace(/[_-]/g, '')
        jefeAntes = r2(computeComisionJefeTiendas({ sellerStats: antes.sellerStats, adjustedTiendaRules: antes.adjustedTiendaRules,
          territorialTiendasRules: terr, monthSales: vMes, catalogs: input.catalogs || {}, viewingPeriod: vp, pcts }).total)
        jefeDespues = r2(computeComisionJefeTiendas({ sellerStats: despues.sellerStats, adjustedTiendaRules: despues.adjustedTiendaRules,
          territorialTiendasRules: terr, monthSales: despuesVentas, catalogs: input.catalogs || {}, viewingPeriod: vp, pcts }).total)
      } catch { /* sin jefe configurado, se enseña 0/0 */ }

      nominas.push({
        mes, detalle, jefeAntes, jefeDespues,
        totalAntes: r2(detalle.reduce((a, x) => a + x.antes, 0)),
        totalDespues: r2(detalle.reduce((a, x) => a + x.despues, 0)),
      })
    } catch (e) { console.warn('[Clasificación Repos] nómina', mes, e) }
  }

  return {
    total: LISTA.length,
    mover, yaEsta, yaCorregida, altas, dudosas, eliminar, madresRespetadas, extrasFutbolAparte,
    sumaMovida: r2(mover.reduce((a, x) => a + x.cuota, 0)),
    sumaEliminada: r2(eliminar.reduce((a, x) => a + x.cuota, 0)),
    nominas,
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
  try {
    return NextResponse.json({ success: true, ...(await analizar()) })
  } catch (e: any) {
    console.error('[Clasificación Repos] preview:', e)
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
    if (String(body.confirmar || '').trim().toUpperCase() !== 'CLASIFICAR') {
      return NextResponse.json({ success: false, error: 'Para ejecutar hay que escribir «CLASIFICAR».' }, { status: 400 })
    }
    const r: any = await analizar()

    let movidas = 0, creadas = 0, borradas = 0
    for (const m of r.mover) {
      const original = await prisma.sale.findUnique({ where: { id: m.id } })
      if (!original) continue
      await prisma.sale.update({
        where: { id: m.id },
        data: {
          sheet: m.destino, detalle: m.destino,
          ...(m.fechaNueva ? { fecha: m.fechaNueva } : {}),
          ...(m.boletinNuevo !== null && m.boletinNuevo !== undefined ? { numeroPedido: m.boletinNuevo } : {}),
          anotaciones: [original.anotaciones, `Clasificada a ${m.destino} (lista del dueño, ago-2026)`].filter(Boolean).join(' | '),
        },
      })
      movidas++
    }
    // El alta nueva necesita su WorkPeriod: el panel carga por periodo.
    const wps = await prisma.workPeriod.findMany({ where: { period_key: { in: ['2026_07', '2026_08'] } } })
    const wpPorSufijo = new Map(wps.map(w => [`/${String(w.month).padStart(2, '0')}/${w.year}`, w.id]))
    for (const a of r.altas) {
      // Vendedor y tienda: los de otra línea del mismo cliente, si la hay.
      const hermana: any = await prisma.sale.findFirst({ where: { nif: a.nif }, orderBy: { createdAt: 'desc' } })
      await prisma.sale.create({
        data: {
          id: randomUUID(), fecha: a.fecha, nif: a.nif, nombreCliente: a.nombre,
          sheet: PALANCA_REPOS, detalle: PALANCA_REPOS, producto: PRODUCTO_ALTA,
          cuota: 0, numeroPedido: a.boletin || '',
          periodId: wpPorSufijo.get(a.fecha.slice(2)) || null,
          vendedor: hermana?.vendedor || '', codigo: hermana?.codigo || '',
          pendiente: 'No', anulado: 'No',
          anotaciones: `${a.contrato} — alta desde la lista del dueño (ago-2026); no estaba tecleada`,
        } as any,
      })
      creadas++
    }
    if (r.eliminar.length > 0) {
      const del = await prisma.sale.deleteMany({ where: { id: { in: r.eliminar.map((x: any) => x.id) } } })
      borradas = del.count
    }

    return NextResponse.json({
      success: true, movidas, creadas, borradas,
      message: `${movidas} clasificadas, ${creadas} dadas de alta y ${borradas} eliminadas del histórico de julio/agosto.`,
    })
  } catch (e: any) {
    console.error('[Clasificación Repos] ejecutar:', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  }
}
