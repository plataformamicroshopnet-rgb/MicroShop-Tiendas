import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { computePanelComisionesTiendas } from '@/lib/panelComisionesTiendas'
import { loadPanelInputs } from '@/lib/panelComisionesTiendasServer'
import { tiendaDeComercial, norm } from '@/lib/comercialRoster'
import { computeComisionJefeTiendas, jefePctKeysTodas, resolverJefePcts } from '@/lib/comisionJefeTiendas'

// ─────────────────────────────────────────────────────────────────────────────
// COMISIÓN POR OPERACIÓN de cada comercial para un mes (liquidación) — TIENDAS.
// Server-to-server para el ERP (mi-nuevo-erp): mismo patrón de auth que
// /api/ventas-export (cabecera x-prv-secret === PRV_FEED_SECRET; sin variable
// en producción -> cerrado) y mismo shape de respuesta que el
// /api/comisiones-liquidacion del programa FFVV (el ERP los consume con el
// mismo código; aquí 'perfil' = tienda del comercial).
//
// Usa EL MISMO motor que el Panel Comisiones (src/lib/panelComisionesTiendas.ts,
// consumido también por useComisionesData): al excluir ventas (bajas de
// cliente) los objetivos — incluidos los tramos de EQUIPO
// (REQUIRE_TEAM_OBJ2/OBJ3/OBJ23) y el descuento FTTR de Dispositivos + Seguros —
// se recalculan solos, porque el motor recibe el universo de ventas ya filtrado.
//
// POST body: { "mes": "2026_06", "excluirIds": ["<Sale.id>", ...] }  (excluirIds opcional)
// Respuesta: { mes, porComercial: [{ comercial, perfil, lineas, extras,
//              objetivos, totalLineas, totalExtras, total }], excluidas }
//
// Nota exclusiones: los saleId de las líneas son Sale.id reales (los mismos que
// manda /api/ventas-export). El espejo `${id}-swap` del Swap ANTIGUO solo existe
// en ventas-export (comisión de EMPRESA): aquí no hay línea espejo que excluir,
// y un id desconocido simplemente no excluye nada.
// ─────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient()
const SECRET = process.env.PRV_FEED_SECRET || ''

export const dynamic = 'force-dynamic'

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// El `detalle` de la venta ya es el nombre de palanca que entiende el ERP
// (resolver_tab), salvo 'Ti' que allí se llama 'Contratos Móvil' — misma
// traducción que /api/ventas-export.
const GRUPO_ERP: Record<string, string> = { 'Ti': 'Contratos Móvil' }

export async function POST(request: Request) {
  if (!SECRET || request.headers.get('x-prv-secret') !== SECRET) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const mes = String(body?.mes || '').trim()
    if (!/^\d{4}_\d{2}$/.test(mes)) {
      return NextResponse.json({ success: false, error: 'Falta "mes" con formato YYYY_MM (ej. 2026_06)' }, { status: 400 })
    }
    const excluirIds: string[] = Array.isArray(body?.excluirIds) ? body.excluirIds.map((x: any) => String(x)) : []

    // (1) Insumos del Panel (ventas del mes con el filtro híbrido, reglas,
    // horarios, extras, catálogos, fttr…) — cargador compartido con el resto de
    // endpoints de servidor (src/lib/panelComisionesTiendasServer).
    const { input, ventas: logs, tiendaHours } = await loadPanelInputs(prisma, mes)
    const catalogs = input.catalogs || {}

    // (2) Excluir ventas (bajas de cliente) ANTES de computar: así los tramos —
    // incluidos los de EQUIPO y el descuento FTTR — se recalculan solos.
    const excl = new Set(excluirIds)
    const ventas = logs.filter(l => !excl.has(String(l.id)))
    const excluidas = logs.length - ventas.length

    // Una liquidación no debe calcular con reglas vacías -> 422 explícito.
    if (!input.tiendaRules.length) {
      return NextResponse.json({
        success: false,
        error: `No existen reglas de comisiones del mes (TiendaCommissionRule para ${mes}). Una liquidación no debe calcularse con reglas vacías: configura/clona el Panel de Comisiones de ${mes} y reintenta.`,
      }, { status: 422 })
    }

    // (3) EL MISMO motor que el Panel Comisiones (aplica él mismo los filtros
    // Solar360 / reglas 'solar' / KPI [KPI] que hacía el hook).
    const result = computePanelComisionesTiendas({ ...input, sales: ventas })

    // Tienda de cada comercial (para 'perfil'): panel de horarios del mes, con
    // fallback al mapa fijo heredado; Marta/O2 -> 'O2'.
    const tiendaByComercial = new Map<string, string>()
    for (const h of tiendaHours) {
      const key = norm(h.comercial)
      if (key && !tiendaByComercial.has(key)) tiendaByComercial.set(key, String(h.tienda || '').trim())
    }
    const tiendaDe = (name: string) => {
      if (norm(name).includes('marta')) return 'O2'
      return tiendaByComercial.get(norm(name)) || tiendaDeComercial(name) || ''
    }

    // Respuesta: líneas con los campos de la venta original (mismos nombres que
    // el comisiones-liquidacion de FFVV: fecha/nif/telf/codPedido/producto/cuota)
    // para que el ERP cruce con el mismo código. codPedido = Sale.numeroPedido.
    const bySaleId = new Map(ventas.map(v => [String(v.id), v]))
    const porComercial = result.sellerStats.map(st => {
      const lineas = st.lineasDetalle.map(l => {
        const v: any = bySaleId.get(String(l.saleId)) || {}
        return {
          saleId: l.saleId,
          fecha: v.fecha || '',
          // `grupo` = palanca de la VENTA como la entiende el ERP: su `detalle`
          // con la misma traducción que usa /api/ventas-export ('Ti' → Contratos
          // Móvil); la línea de seguro adosado va a Seguros. El nombre de la
          // regla de comisión viaja aparte en `regla`.
          grupo: l.esSeguroVirtual ? 'Seguros'
            : (GRUPO_ERP[String(v.detalle || '')] || v.detalle || v.grupo || l.grupo),
          regla: l.grupo,
          producto: l.producto || v.producto || '',
          nif: v.nif || '',
          telf: v.telf || v.telefonoMovil || '',
          codPedido: v.numeroPedido || '',
          cuota: v.cuota ?? 0,
          comision: l.comision,
          ...(l.esSeguroVirtual ? { esSeguroVirtual: true } : {}),
        }
      })
      const totalLineas = r2(lineas.reduce((acc, l) => acc + l.comision, 0))
      const totalExtras = r2(st.extrasConceptos.reduce((acc, e) => acc + e.importe, 0))
      return {
        comercial: st.name,
        perfil: tiendaDe(st.name),
        lineas,
        extras: st.extrasConceptos.map(e => ({ ...e, importe: r2(e.importe) })),
        objetivos: st.objetivosResumen,
        totalLineas,
        totalExtras,
        total: r2(totalLineas + totalExtras),
      }
    })

    // (7) Comisión del JEFE DE TIENDAS (Salva): 4 palancas (Disp+Seg, ARPU,
    // Altas Total BAF, BAF Convergente), cada una = base € × % del tramo MÁS
    // ALTO alcanzado — el MISMO helper que la pantalla «Comisiones Jefe Tiendas»
    // (src/lib/comisionJefeTiendas). Se calcula sobre el universo YA filtrado
    // por excluirIds: las bajas del ERP recalculan bases y tramos solas en cada
    // re-verificación. Mismo patrón que el jefe del programa FFVV: entrada extra
    // en porComercial (su total en UN extra, el ERP no coteja extras) + campo
    // top-level `jefe` con el desglose.
    let jefe: any = null
    if (porComercial.length > 0) {
      const [pctSettings, territorialTiendasSetting, jefeUser] = await Promise.all([
        prisma.appSetting.findMany({ where: { key: { in: jefePctKeysTodas(mes) } } }),
        prisma.appSetting.findUnique({ where: { key: `territorial_tiendas_${mes}` } }),
        prisma.user.findFirst({ where: { role: 'JEFE DE VENTAS' } }),
      ])
      // Los 9 % del Jefe, DE ESTE MES: clave del mes → clave global de respaldo →
      // defecto del código. La misma cascada que pinta la pantalla.
      const settingByKey = new Map(pctSettings.map(s => [s.key, s.value]))
      const { pcts } = resolverJefePcts(settingByKey, mes)
      let territorialTiendasRules: any[] = []
      if (territorialTiendasSetting?.value) {
        try { territorialTiendasRules = JSON.parse(territorialTiendasSetting.value) || [] } catch {}
      }

      const cj = computeComisionJefeTiendas({
        sellerStats: result.sellerStats,
        adjustedTiendaRules: result.adjustedTiendaRules,
        territorialTiendasRules,
        monthSales: ventas,
        catalogs,
        viewingPeriod: mes.replace(/[_-]/g, ''),
        pcts,
      })

      const nombreJefe = jefeUser?.username || 'Salva'
      jefe = {
        comercial: nombreJefe,
        porcentajes: pcts,
        palancas: cj.palancas.map(p => ({
          ...p,
          base: r2(p.base),
          importe: r2(p.importe),
          tramos: p.tramos.map(t => ({ ...t, amount: r2(t.amount) })),
        })),
        totalCondicionado: r2(cj.totalCondicionado),
        total: r2(cj.total),
      }

      // El jefe viaja como un comercial más con su importe en UN extra: el ERP
      // ya trata los extras sin cotejo contra Telefónica (no son ventas).
      const resumenPalancas = cj.palancas
        .filter(p => p.tramoAlcanzado > 0)
        .map(p => `${p.palanca} T${p.tramoAlcanzado} (${p.pctAplicado}%)`)
        .join(', ') || 'sin objetivos alcanzados'
      porComercial.push({
        comercial: nombreJefe,
        perfil: 'Jefe de Tiendas',
        lineas: [],
        extras: [{
          concepto: `Comisión Jefe de Tiendas — ${resumenPalancas}`,
          importe: r2(cj.total),
        }],
        objetivos: [],
        totalLineas: 0,
        totalExtras: r2(cj.total),
        total: r2(cj.total),
      } as any)
    }

    return NextResponse.json({ success: true, mes, porComercial, jefe, excluidas })
  } catch (e: any) {
    console.error('[POST comisiones-liquidacion]', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
