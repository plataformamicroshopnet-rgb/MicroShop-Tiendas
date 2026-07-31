import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { normalizeRole } from '@/lib/appConfig'
import { norm } from '@/lib/comercialRoster'
import { computePanelComisionesTiendas, matchesRule, getValueForRule } from '@/lib/panelComisionesTiendas'
import { loadPanelInputs } from '@/lib/panelComisionesTiendasServer'
import { getDiasLaborablesRestantes, getDiasLaborablesHasta } from '@/lib/trackingCalculations'
import type { ParteDiarioComercial, ParteDiarioPalanca, ParteDiarioAyerPalanca } from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// PARTE DIARIO por comercial (TIENDAS).
//
// Un único JSON del que beben la pantalla /comisiones/parte-diario y (más
// adelante) el correo diario: si los dos leen de aquí, no pueden contar cosas
// distintas.
//
// Las cifras del MES no se recalculan: salen del MISMO motor que el Panel de
// Comisiones (computePanelComisionesTiendas) con los mismos insumos que la
// liquidación del ERP (loadPanelInputs). Lo único propio de este endpoint es el
// recorte del DÍA: qué se vendió esa fecha y qué parte de la comisión del mes
// corresponde a esas ventas (se lee de lineasDetalle, que ya reparte la comisión
// de cada palanca venta a venta).
//
// GET /api/parte-diario?periodKey=YYYY_MM&fecha=YYYY-MM-DD&seller=Nombre
//   - fecha por defecto: AYER en hora de Madrid (el parte se lee por la mañana).
//   - periodKey por defecto: el mes de esa fecha.
// Auth doble:
//   - cabecera x-prv-secret === PRV_FEED_SECRET (server-to-server, para el ERP), o
//   - sesión del programa. Con sesión de comercial (no ADMIN / JEFE DE VENTAS)
//     solo se devuelve SU parte, compare lo que compare el parámetro seller.
// ─────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient()
const SECRET = process.env.PRV_FEED_SECRET || ''

export const dynamic = 'force-dynamic'

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// Fecha (YYYY-MM-DD) del instante dado en hora de Madrid: el servidor puede
// estar en UTC y a las 00:30 de Madrid «ayer» no es el mismo día para los dos.
const isoEnMadrid = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

const isoMenosUnDia = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() - 1)
  return t.toISOString().slice(0, 10)
}

// Importe de una venta a efectos del parte: su valor económico, con la prima del
// seguro adosado incluida (es lo que suma en la palanca Dispositivos + Seguros).
const valorVenta = (s: any, catalogs: Record<string, any[]>) => {
  const base = getValueForRule(s, '', catalogs)
  const cat = String(s.categoria || s.detalle || s.sheet || '').toLowerCase()
  const adosado = (cat !== 'seguro' && Number(s.seguroImporte) > 0) ? Number(s.seguroImporte) : 0
  return base + adosado
}

const esAnulada = (s: any) => {
  const an = String(s.anulado || '').toLowerCase().trim()
  const pe = String(s.pendiente || '').toLowerCase().trim()
  return an === 'si' || an === 'sí' || pe === 'anulado'
}

// Mismo parser de importes que el motor ('12,50 €' / '3%' -> número).
const parseImporte = (val: any) => {
  let s = String(val || '0').replace(/[^0-9.,\-]/g, '').trim()
  s = s.replace(',', '.')
  return Number(s) || 0
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // ── Auth: secreto del ERP o sesión del programa ──────────────────────────
    const secretOk = !!SECRET && request.headers.get('x-prv-secret') === SECRET
    let soloEsteComercial: string | null = null
    if (!secretOk) {
      const session = await getSession().catch(() => null)
      const user = session?.user
      if (!user || !user.username) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
      }
      const rol = normalizeRole(user.role)
      // Quien no manda sobre el equipo solo ve su propio parte. Por defecto se
      // cierra: un rol desconocido se queda con su nombre (y si no es comercial,
      // no verá ninguno) en vez de ver el de todos.
      const veTodos = rol === 'ADMIN' || rol === 'JEFE DE VENTAS'
      if (!veTodos) soloEsteComercial = String(user.username)
    }

    // ── Parámetros ───────────────────────────────────────────────────────────
    const fecha = String(searchParams.get('fecha') || isoMenosUnDia(isoEnMadrid(new Date()))).trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ success: false, error: 'Parámetro "fecha" con formato YYYY-MM-DD' }, { status: 400 })
    }
    const periodKey = String(searchParams.get('periodKey') || `${fecha.slice(0, 4)}_${fecha.slice(5, 7)}`).trim()
    if (!/^\d{4}_\d{2}$/.test(periodKey)) {
      return NextResponse.json({ success: false, error: 'Parámetro "periodKey" con formato YYYY_MM (ej. 2026_07)' }, { status: 400 })
    }
    const sellerParam = soloEsteComercial || (searchParams.get('seller') || '').trim()

    const [anio, mes, dia] = fecha.split('-').map(Number)
    const fechaDate = new Date(anio, mes - 1, dia)

    // ── Motor (mismos insumos que la liquidación del ERP) ────────────────────
    const { input } = await loadPanelInputs(prisma, periodKey)
    const catalogs = input.catalogs || {}
    const result = computePanelComisionesTiendas(input)

    // La fecha de la venta es TEXTO 'DD/MM/YYYY'; se compara por números para
    // tolerar los históricos escritos sin cero delante ('7/7/2026').
    const esDelDia = (f: string) => {
      const p = String(f || '').split('/')
      return p.length === 3 && Number(p[0]) === dia && Number(p[1]) === mes && Number(p[2]) === anio
    }

    const diasLaborablesRestantes = getDiasLaborablesRestantes(periodKey)
    const diasLaborablesTranscurridos = getDiasLaborablesHasta(periodKey, fechaDate)

    /**
     * Días LABORABLES seguidos vendiendo, contando hacia atrás desde el día del
     * parte. Los sábados y domingos se saltan sin cortar la racha: si vendió el
     * viernes y el lunes, la racha sigue viva — cerrar el fin de semana no es
     * dejar de vender.
     */
    const rachaDe = (ventas: any[]) => {
      const conVenta = new Set(
        ventas.filter((s: any) => !esAnulada(s))
          .map((s: any) => {
            const p = String(s.fecha || '').split('/')
            return p.length === 3
              ? `${p[2]}-${String(Number(p[1])).padStart(2, '0')}-${String(Number(p[0])).padStart(2, '0')}`
              : ''
          }).filter(Boolean))
      let racha = 0
      const cursor = new Date(anio, mes - 1, dia)
      // Tope de 60 días: sin él, un histórico raro podría dejarlo dando vueltas.
      for (let i = 0; i < 60; i++) {
        const wd = cursor.getDay()
        if (wd !== 0 && wd !== 6) {
          const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
          if (!conVenta.has(iso)) break
          racha++
        }
        cursor.setDate(cursor.getDate() - 1)
      }
      return racha
    }

    // ── Cifras del DÍA por comercial (para el equipo y para cada parte) ──────
    const ventasDelDiaPorComercial = new Map<string, any[]>()
    for (const st of result.sellerStats) {
      ventasDelDiaPorComercial.set(st.name, (st.rawSales || []).filter((s: any) => !esAnulada(s) && esDelDia(s.fecha)))
    }

    // Ranking del día con TODA la plantilla (incluidos los que no vendieron):
    // así cada comercial se encuentra siempre en la lista.
    const ranking = result.sellerStats.map(st => {
      const suyas = ventasDelDiaPorComercial.get(st.name) || []
      return {
        nombre: st.name,
        ops: suyas.length,
        importe: r2(suyas.reduce((acc: number, s: any) => acc + valorVenta(s, catalogs), 0)),
      }
    }).sort((a, b) => b.importe - a.importe || b.ops - a.ops)

    const equipoOps = ranking.reduce((acc, r) => acc + r.ops, 0)
    const equipoImporte = r2(ranking.reduce((acc, r) => acc + r.importe, 0))
    // Media entre quienes VENDIERON ese día: repartirla entre toda la plantilla
    // castiga los días en los que la mitad libra y el listón deja de ser real.
    const conVentas = ranking.filter(r => r.ops > 0).length
    const equipoMedia = conVentas > 0 ? r2(equipoImporte / conVentas) : 0

    // ── Parte de cada comercial ─────────────────────────────────────────────
    const objetivo = sellerParam ? norm(sellerParam) : null
    const posicionDe = (nombre: string) =>
      ranking.findIndex(r => norm(r.nombre) === norm(nombre)) + 1
    const comerciales: ParteDiarioComercial[] = result.sellerStats
      .filter(st => !objetivo || norm(st.name) === objetivo)
      .map(st => {
        const esMarta = norm(st.name).includes('marta')
        const reglas: any[] = esMarta ? (input.o2Rules || []) : (result.adjustedTiendaRules || [])

        const ventasDia = ventasDelDiaPorComercial.get(st.name) || []
        const idsDia = new Set(ventasDia.map((s: any) => String(s.id)))
        const ventasMes = (st.rawSales || []).filter((s: any) => !esAnulada(s))

        // Comisión del día: la parte de la comisión del mes que corresponde a las
        // ventas de esa fecha (lineasDetalle ya la reparte venta a venta).
        const lineasDia = (st.lineasDetalle || []).filter((l: any) => idsDia.has(String(l.saleId)))
        const comisionDia = r2(lineasDia.reduce((acc: number, l: any) => acc + (l.comision || 0), 0))
        const comisionDiaPorGrupo = new Map<string, number>()
        for (const l of lineasDia) {
          if (!l.grupo) continue
          comisionDiaPorGrupo.set(l.grupo, (comisionDiaPorGrupo.get(l.grupo) || 0) + (l.comision || 0))
        }

        // ── Palancas del MES (mismas cifras que ve en el Panel de Comisiones) ──
        const palancas: ParteDiarioPalanca[] = reglas.map((rule: any) => {
          const nombre = rule.nombre
          const esImporte = String(rule.importePrimerTramo || '').includes('%')
          const ventas = st.groupCounts[nombre] || 0
          const pendientes = st.groupPending[nombre] || 0
          const llevamos = ventas + pendientes
          const obj1 = st.groupObj1[nombre] || 0
          const obj2 = st.groupObj2[nombre] || 0
          const obj3 = (st.groupObj3 && st.groupObj3[nombre]) || 0
          // Objetivo de referencia = el del TRAMO 1: es el que consolida la
          // comisión (el Panel pinta la barra contra el tramo 2, pero para el
          // comercial el hito que le paga es este). El salto de tramo viaja
          // aparte en tarifa/objetivoSiguienteTramo.
          const objetivoRef = obj1 > 0 ? obj1 : obj2
          const resumen = (st.objetivosResumen || []).find((o: any) => o.grupo === nombre)
          const hito = resumen?.hito || 0
          const imp1 = parseImporte(rule.importePrimerTramo)
          const imp2 = parseImporte(rule.importeSegundoTramo)
          const imp3 = parseImporte(rule.importeTercerTramo)
          const tarifaActual = hito >= 3 ? imp3 : (hito === 2 ? imp2 : imp1)

          // Siguiente tramo: solo si además de estar por encima PAGA MÁS que el
          // actual (hay reglas con tramo 2 a la misma tarifa: ahí no hay premio
          // que contar y prometerlo sería mentir).
          let tarifaSiguienteTramo: number | null = null
          let objetivoSiguienteTramo: number | null = null
          if (obj2 > 0 && llevamos < obj2 && imp2 > tarifaActual) {
            tarifaSiguienteTramo = imp2; objetivoSiguienteTramo = obj2
          } else if (obj3 > 0 && llevamos < obj3 && imp3 > tarifaActual) {
            tarifaSiguienteTramo = imp3; objetivoSiguienteTramo = obj3
          }

          return {
            nombre,
            esImporte,
            ventas: r2(ventas),
            pendientes: r2(pendientes),
            llevamos: r2(llevamos),
            objetivo: r2(objetivoRef),
            falta: r2(Math.max(0, objetivoRef - llevamos)),
            pct: objetivoRef > 0 ? r2((llevamos / objetivoRef) * 100) : (llevamos > 0 ? 100 : 0),
            comision: r2(st.groupComisions[nombre] || 0),
            cumplido: !!st.groupIsConsolidado[nombre],
            hito,
            tarifaActual,
            tarifaSiguienteTramo,
            objetivoSiguienteTramo: objetivoSiguienteTramo === null ? null : r2(objetivoSiguienteTramo),
          }
        })

        // ── Lo de AYER repartido por palanca ────────────────────────────────
        // Se cuenta con los MISMOS helpers del motor (matchesRule /
        // getValueForRule), incluida la línea virtual del seguro adosado, para
        // que las unidades del día encajen con las del mes.
        const porPalanca: ParteDiarioAyerPalanca[] = []
        for (const rule of reglas) {
          const nombre = rule.nombre
          let uds = 0
          let importe = 0
          for (const s of ventasDia) {
            if (matchesRule(s, nombre, rule.productosCuentan)) {
              uds += 1
              importe += getValueForRule(s, nombre, catalogs)
            }
            if (s.seguroImporte && Number(s.seguroImporte) > 0 && String(s.categoria || s.detalle || s.sheet).toLowerCase() !== 'seguro') {
              const seguroVirtual = { ...s, categoria: 'seguro', detalle: 'seguro', cuota: Number(s.seguroImporte) }
              if (matchesRule(seguroVirtual, nombre, rule.productosCuentan)) {
                uds += 1
                importe += getValueForRule(seguroVirtual, nombre, catalogs)
              }
            }
          }
          const comision = comisionDiaPorGrupo.get(nombre) || 0
          comisionDiaPorGrupo.delete(nombre)
          if (uds > 0 || comision > 0) {
            porPalanca.push({ palanca: nombre, uds, importe: r2(importe), comision: r2(comision) })
          }
        }
        // Lo que comisionó ese día fuera de las reglas del panel (p. ej. las
        // "Altas O2/Otras" a 9 €/ud): no tienen regla, pero son dinero suyo.
        for (const [grupo, comision] of comisionDiaPorGrupo) {
          const suyas = lineasDia.filter((l: any) => l.grupo === grupo)
          const importe = suyas.reduce((acc: number, l: any) => {
            const v = ventasDia.find((s: any) => String(s.id) === String(l.saleId))
            return acc + (v ? valorVenta(v, catalogs) : 0)
          }, 0)
          porPalanca.push({ palanca: grupo, uds: suyas.length, importe: r2(importe), comision: r2(comision) })
        }

        // ── Ritmo del mes sobre la palanca principal ────────────────────────
        // Principal = la primera palanca de € con objetivo (Dispositivos +
        // Seguros en la práctica); si no hay ninguna, la de mayor objetivo.
        const principal = palancas.find(p => p.esImporte && p.objetivo > 0)
          || [...palancas].filter(p => p.objetivo > 0).sort((a, b) => b.objetivo - a.objetivo)[0]
          || null
        const ritmoDiarioActual = principal && diasLaborablesTranscurridos > 0
          ? principal.llevamos / diasLaborablesTranscurridos : 0
        const ritmoNecesario = principal && diasLaborablesRestantes > 0
          ? principal.falta / diasLaborablesRestantes : 0
        const proyeccionMes = principal
          ? principal.llevamos + ritmoDiarioActual * diasLaborablesRestantes : 0

        return {
          nombre: st.name,
          ayer: {
            ops: ventasDia.length,
            importe: r2(ventasDia.reduce((acc: number, s: any) => acc + valorVenta(s, catalogs), 0)),
            comision: comisionDia,
            porPalanca,
          },
          mes: {
            ops: ventasMes.length,
            importe: r2(ventasMes.reduce((acc: number, s: any) => acc + valorVenta(s, catalogs), 0)),
            comisionTotal: r2(st.totalComision),
            consolidada: r2(st.totalConsolidada),
            pendiente: r2(st.totalPendiente),
          },
          palancas,
          ritmo: {
            palanca: principal ? principal.nombre : null,
            diasLaborablesRestantes,
            diasLaborablesTranscurridos,
            ritmoDiarioActual: r2(ritmoDiarioActual),
            ritmoNecesario: r2(ritmoNecesario),
            proyeccionMes: r2(proyeccionMes),
            pctProyeccion: principal && principal.objetivo > 0 ? r2((proyeccionMes / principal.objetivo) * 100) : 0,
          },
          posicionDia: posicionDe(st.name),
          rachaDias: rachaDe(st.rawSales || []),
          totalComerciales: ranking.length,
        }
      })

    // Transparencia total entre el equipo (decisión del dueño): todos ven el
    // ranking del día con nombres y cifras, no solo su propio puesto.
    return NextResponse.json({
      success: true,
      periodKey,
      fecha,
      equipo: { ops: equipoOps, importe: equipoImporte, media: equipoMedia, ranking },
      comerciales,
    })
  } catch (e: any) {
    console.error('[GET parte-diario]', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  }
  // Sin $disconnect: la pantalla llama a este endpoint a menudo y el cliente
  // Prisma es de módulo (compartido); cerrarlo por petición cortaría a las que
  // estén en vuelo y obligaría a reconectar en cada carga.
}
