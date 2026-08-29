import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { loadPanelInputs } from '@/lib/panelComisionesTiendasServer'
import { computePanelComisionesTiendas } from '@/lib/panelComisionesTiendas'
import { computeComisionJefeTiendas, jefePctKeysTodas, resolverJefePcts, JEFE_PCT_KEYS_BASE } from '@/lib/comisionJefeTiendas'
import { PasoSaludMes, SaludMesTiendasResponse, EstadoPaso, mesSiguiente, mesAnterior } from '@/lib/saludMesTiendas'
import { claveSelloRevision, huellaDelPaso, leerSello, cuandoEnCristiano } from '@/lib/revisadoPorMiTiendas'
import { computeVersusTiendas, catalogosDelMesTiendas } from '@/lib/versusTiendas'

const prisma = new PrismaClient()
export const dynamic = 'force-dynamic'

/**
 * EL CAMBIO DE MES DE TIENDAS, EN UN VISTAZO.
 *
 * Hermano del hub de FFVV: repasa el mes ACTIVO paso a paso y dice, en cristiano,
 * qué está en orden (verde), qué conviene mirar (ámbar) y qué falta (rojo) — y
 * SIEMPRE qué lo pone en verde. Todo se calcula con piezas que ya existen (el
 * mismo motor que paga); la pantalla solo pinta.
 *
 * Solo lectura. Lo puede pedir la sesión de dirección/admin o el feed del ERP
 * (x-prv-secret) para el correo del ritual (Fase 2).
 */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const eur = (n: number) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const TIENDAS_FISICAS = ['Auxiliadora 45', 'Correhuela', 'Villamayor', 'Béjar']

const nombreMes = (pk: string) => {
  const M = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const [y, m] = pk.split('_').map(Number)
  return `${M[m] || pk} de ${y}`
}

export async function GET(request: Request) {
  const secreto = process.env.PRV_FEED_SECRET
  const conSecreto = !!secreto && request.headers.get('x-prv-secret') === secreto
  if (!conSecreto) {
    const session = await getSession()
    const role = String(session?.user?.role || '').toUpperCase()
    if (!session?.user || (role !== 'ADMIN' && role !== 'JEFE_TIENDAS' && role !== 'DIRECCION')) {
      return NextResponse.json({ success: false, error: 'Solo dirección o administración.' }, { status: 403 })
    }
  }

  try {
    const { searchParams } = new URL(request.url)
    // tablas=1: además de los semáforos, mandar las tablas en miniatura de cada
    // paso (la pantalla las pinta ampliables; el correo del ritual no las pide).
    const conTablas = searchParams.get('tablas') === '1'
    let periodKey = searchParams.get('periodKey') || ''
    if (!periodKey) {
      const activo = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } })
      periodKey = activo?.period_key || ''
    }
    if (!periodKey) return NextResponse.json({ success: false, error: 'No hay mes activo.' }, { status: 400 })

    const pasos: PasoSaludMes[] = []
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })

    // ── Paso 1: mes preparado (clonado) ────────────────────────────────────
    {
      const [reglas, horas, cats, objs] = await Promise.all([
        prisma.tiendaCommissionRule.count({ where: { periodKey } }),
        prisma.tiendaComercialHour.count({ where: { periodKey } }),
        wp ? prisma.productCatalog.count({ where: { periodId: wp.id } }) : Promise.resolve(0),
        prisma.tiendaStoreObjective.count({ where: { periodKey } }),
      ])
      const subChecks = [
        { etiqueta: 'El mes existe y está activo', ok: !!wp && wp.status === 'ACTIVE' },
        { etiqueta: `Palancas de comisiones (${reglas})`, ok: reglas > 0 },
        { etiqueta: `Plantilla de comerciales (${horas})`, ok: horas > 0 },
        { etiqueta: `Catálogos del mes (${cats} productos)`, ok: cats > 0 },
      ]
      const faltan = subChecks.filter(s => !s.ok)
      pasos.push({
        id: 'mes_preparado',
        titulo: 'Mes preparado (clonado completo)',
        resumen: 'Que el mes existe, está activo y el clonado dejó todas las piezas.',
        estado: !wp ? 'rojo' : (faltan.length ? 'ambar' : 'verde'),
        detalles: !wp
          ? [`El mes ${nombreMes(periodKey)} todavía no existe.`]
          : (faltan.length ? faltan.map(f => `Falta: ${f.etiqueta}`) : [`${nombreMes(periodKey)} listo: ${reglas} palancas, ${horas} comerciales, ${cats} productos.`]),
        ayuda: !wp ? 'Créalo desde Gestión de Periodos con «Clonar mes».' : undefined,
        subChecks,
        accion: { tipo: 'enlace', etiqueta: 'Gestión de Periodos', href: '/admin/periodos' },
      })
    }

    // ── Paso 2: palancas y candados ─────────────────────────────────────────
    {
      const reglas = await prisma.tiendaCommissionRule.findMany({ where: { periodKey } })
      const conCond = reglas.filter(r => { const c = String(r.condicionantes || ''); return c.startsWith('[') && c !== '[]' }).length
      const arpu = reglas.find(r => /arpu|repo/i.test(String(r.nombre)) && !/futbol|fútbol/i.test(String(r.nombre)))
      const futbol = reglas.find(r => /futbol|fútbol/i.test(String(r.nombre)))
      const avisos: string[] = []
      if (!arpu) avisos.push('No encuentro la palanca de Repos (Arpu).')
      if (!futbol) avisos.push('No encuentro la palanca de Repo Fútbol.')
      let estadoPal: EstadoPaso = reglas.length === 0 ? 'rojo' : (avisos.length ? 'ambar' : 'verde')
      const detallesPal = reglas.length === 0
        ? ['El mes no tiene ninguna palanca de comisiones.']
        : [`${reglas.length} palancas · ${conCond} con condicionantes.`, ...avisos,
           ...(arpu && futbol ? ['Los dos candados sagrados presentes: Repos (Arpu) y Repo Fútbol.'] : [])]
      let ayudaPal: string | undefined = avisos.length ? 'Revisa las palancas en Entrada de Datos → Comisiones.' : undefined
      let accionSecPal: any = undefined
      if (estadoPal === 'ambar') {
        // ¿El dueño ya revisó estos nombres y siguen igual? → verde con constancia.
        const selloRowP = await prisma.appSetting.findUnique({ where: { key: claveSelloRevision('palancas', periodKey) } })
        const huellaP = await huellaDelPaso(prisma, 'palancas', periodKey)
        const { sello: selloP, vigente: vigenteP } = leerSello(selloRowP?.value, huellaP)
        if (vigenteP && selloP) {
          estadoPal = 'verde'
          detallesPal.push(`Lo diste por revisado el ${cuandoEnCristiano(selloP.cuando)} (${selloP.quien}) y las palancas no han cambiado desde entonces.`)
          ayudaPal = undefined
        } else {
          if (selloP && !vigenteP) detallesPal.push(`Lo diste por revisado el ${cuandoEnCristiano(selloP.cuando)}, pero las palancas han cambiado desde entonces.`)
          ayudaPal = 'Si el nombre es un cambio a propósito, pulsa «Ya lo he revisado» y el aviso se apaga (vuelve solo si las palancas cambian).'
          accionSecPal = { tipo: 'revisado', etiqueta: 'Ya lo he revisado' }
        }
      }
      pasos.push({
        id: 'palancas',
        titulo: 'Palancas de comisiones y sus candados',
        resumen: 'Que las palancas del mes están y conservan sus condicionantes.',
        estado: estadoPal,
        detalles: detallesPal,
        ayuda: ayudaPal,
        accion: { tipo: 'enlace', etiqueta: 'Ir a Comisiones', href: '/catalogos?tab=Comisiones%20para%20Tiendas' },
        ...(accionSecPal ? { accionSecundaria: accionSecPal } : {}),
        ...(conTablas && reglas.length ? { tablas: [{
          titulo: 'Palancas del mes',
          subtitulo: 'Objetivo → importe de cada tramo, y si conserva condicionantes.',
          columnas: ['Palanca', 'Tramo 1', 'Tramo 2', 'Tramo 3', 'Cond.'],
          numericas: [1, 2, 3],
          filas: [...reglas].sort((a, b) => (a.order || 0) - (b.order || 0)).map(r => {
            const tramo = (o: any, imp: any) => (o || imp) ? `${o ?? '—'} → ${String(imp ?? '—')}` : '—'
            const c = String(r.condicionantes || '')
            return [String(r.nombre || ''),
                    tramo(r.objPrimerTramo, r.importePrimerTramo),
                    tramo(r.objSegundoTramo, r.importeSegundoTramo),
                    tramo(r.objTercerTramo, r.importeTercerTramo),
                    (c.startsWith('[') && c !== '[]') ? '✔' : '—']
          }),
        }] } : {}),
      })
    }

    // ── Paso 3: plantilla de comerciales ────────────────────────────────────
    {
      const horas = await prisma.tiendaComercialHour.findMany({ where: { periodKey } })
      const sinHora = horas.filter(h => !(Number(h.horario) > 0))
      const sinTienda = horas.filter(h => !String((h as any).tienda || '').trim())
      const mal = sinHora.length + sinTienda.length
      pasos.push({
        id: 'plantilla',
        titulo: 'Plantilla de comerciales y horas',
        resumen: 'Que cada comercial tiene horas y su tienda asignada.',
        estado: horas.length === 0 ? 'rojo' : (mal ? 'ambar' : 'verde'),
        detalles: horas.length === 0
          ? ['El mes no tiene plantilla de comerciales.']
          : (mal
              ? [...(sinHora.length ? [`${sinHora.length} sin horas: ${sinHora.map(h => h.comercial).join(', ')}`] : []),
                 ...(sinTienda.length ? [`${sinTienda.length} sin tienda: ${sinTienda.map(h => h.comercial).join(', ')}`] : [])]
              : [`${horas.length} comerciales, todos con horas y tienda.`]),
        ayuda: mal ? 'Complétalos en «Horarios de Comerciales».' : undefined,
        accion: { tipo: 'enlace', etiqueta: 'Horarios de Comerciales', href: '/catalogos?tab=Comisiones%20para%20Tiendas' },
        ...(conTablas && horas.length ? { tablas: [{
          titulo: 'Plantilla del mes',
          subtitulo: 'La hoja oficial que rige todas las pantallas.',
          columnas: ['Comercial', 'Tienda', 'Horas'],
          numericas: [2],
          filas: [...horas].sort((a, b) => String(a.comercial).localeCompare(String(b.comercial)))
            .map(h => [String(h.comercial || ''), String((h as any).tienda || '—'), String(h.horario ?? '—')]),
        }] } : {}),
      })
    }

    // ── Paso 4: objetivos por tienda (Excel de Telefónica → feed ERP) ────────
    {
      const objs = await prisma.tiendaStoreObjective.findMany({ where: { periodKey } })
      const conAlgo = objs.filter(o => TIENDAS_FISICAS.includes(o.storeName))
      const faltan = TIENDAS_FISICAS.filter(t => !conAlgo.some(o => o.storeName === t))

      // ¿Son los del mes ANTERIOR, clonados? Al pre-crear el mes, el clonado
      // copia los objetivos del mes de origen: las 4 tiendas aparecen llenas y
      // el paso se ponía VERDE, como si el Excel de Telefónica ya hubiera
      // llegado. Se comparan cifra a cifra y, si son calcados, se avisa.
      // (Los CATÁLOGOS no llevan este aviso a propósito: los precios sí siguen
      //  valiendo de un mes al siguiente hasta que Telefónica mande otros.)
      const CAMPOS_OBJ = ['bafConvMS', 'restoBaf', 'tvFutbol', 'dispSegEuros', 'dispUnidades',
                          'seguros', 'movil', 'repos', 'fttr', 'alarmas', 'bafNoTrasl'] as const
      const huellaObjs = (filas: any[]) => filas
        .filter(o => TIENDAS_FISICAS.includes(o.storeName))
        .sort((a, b) => String(a.storeName).localeCompare(String(b.storeName)))
        .map(o => `${o.storeName}:${CAMPOS_OBJ.map(c => String((o as any)[c] ?? '')).join('|')}`)
        .join('//')
      const prevKey = mesAnterior(periodKey)
      const objsPrev = await prisma.tiendaStoreObjective.findMany({ where: { periodKey: prevKey } })
      const sonDelMesAnterior = conAlgo.length > 0 && objsPrev.length > 0
        && huellaObjs(objs) === huellaObjs(objsPrev)
      pasos.push({
        id: 'objetivos_tienda',
        titulo: 'Objetivos por tienda (Excel de Telefónica)',
        resumen: 'Que la tabla oficial del mes está, para que el Seguimiento de Tramitación tenga objetivos.',
        estado: faltan.length === TIENDAS_FISICAS.length ? 'rojo'
              : (faltan.length || sonDelMesAnterior) ? 'ambar' : 'verde',
        detalles: faltan.length
          ? [`Faltan objetivos de: ${faltan.join(', ')}.`]
          : sonDelMesAnterior
            ? [`⚠ Son los objetivos de ${nombreMes(prevKey)}, calcados: los trajo el clonado del mes, no el Excel de Telefónica.`,
               `Hasta que subas los de ${nombreMes(periodKey)}, todo lo que mida cumplimiento (Seguimiento de Tramitación, termómetro, Territorial) compara contra las cifras del mes pasado.`]
            : [`Las ${TIENDAS_FISICAS.length} tiendas tienen sus objetivos oficiales.`],
        ayuda: faltan.length
          ? 'Los publica solo el ERP al subir el Excel «Objetivos pdv» a Comunicados Mensuales (o el envío diario de las 05:00). Si sigue vacío, re-guarda el Excel en el ERP.'
          : sonDelMesAnterior
            ? `Sube el Excel «Objetivos pdv» de ${nombreMes(periodKey)} a Comunicados Mensuales Tiendas en el ERP: al guardarlo, los objetivos buenos llegan solos y este paso se pone en verde.`
            : undefined,
        accion: { tipo: 'enlace', etiqueta: 'Seguimiento de Tramitación', href: '/seguimiento-ventas/tramitacion' },
        ...(conTablas && conAlgo.length ? { tablas: [{
          titulo: 'Objetivos oficiales por tienda',
          subtitulo: 'Las casillas del Excel de Telefónica que rigen el Seguimiento de Tramitación.',
          columnas: ['Tienda', 'BAF MS', 'Resto BAF', 'TV/Fútbol', 'Disp. €', 'Disp. uds', 'Seguros', 'Móvil', 'Repos', 'FTTR'],
          numericas: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          filas: conAlgo.map(o => [
            String(o.storeName || ''),
            String(o.bafConvMS ?? '—'), String(o.restoBaf ?? '—'), String(o.tvFutbol ?? '—'),
            String(o.dispSegEuros ?? '—'), String(o.dispUnidades ?? '—'), String(o.seguros ?? '—'),
            String(o.movil ?? '—'), String(o.repos ?? '—'), String(o.fttr ?? '—'),
          ]),
        }] } : {}),
      })
    }

    // ── Paso 5: catálogos del mes ───────────────────────────────────────────
    {
      const catRows = wp ? await prisma.productCatalog.findMany({ where: { periodId: wp.id }, select: { categoria: true } }) : []
      const cats = new Set(catRows.map(c => String(c.categoria)))
      const clave = ['Rent', 'Seguro', 'Repos UP', 'Varios']
      const faltan = clave.filter(c => !cats.has(c))
      pasos.push({
        id: 'catalogos',
        titulo: 'Catálogos del mes (precios de las palancas)',
        resumen: 'Que los precios del periodo están cargados en las categorías clave.',
        estado: catRows.length === 0 ? 'rojo' : (faltan.length ? 'ambar' : 'verde'),
        detalles: catRows.length === 0
          ? ['El mes no tiene catálogo de precios.']
          : [`${catRows.length} productos en ${cats.size} categorías.`, ...(faltan.length ? [`Sin filas en: ${faltan.join(', ')}.`] : [])],
        ayuda: faltan.length ? 'Sube o clona los catálogos de esas categorías en Catálogos.' : undefined,
        accion: { tipo: 'enlace', etiqueta: 'Ir a Catálogos', href: '/catalogos' },
        ...(conTablas && catRows.length ? { tablas: [{
          titulo: 'Catálogos del mes',
          subtitulo: 'Cuántos precios tiene cada categoría en este periodo.',
          columnas: ['Categoría', 'Productos'],
          numericas: [1],
          filas: [...cats].sort().map(cNom => [cNom,
            String(catRows.filter(x => String(x.categoria) === cNom).length)]),
        }] } : {}),
      })
    }

    // ── Paso 5b: la tabla de dispositivos en el catálogo Rent ───────────────
    // El dueño la pasa cada mes desde el ERP (casilla TABLA DISPOSITIVOS →
    // «tabla lista para pegar») a Catálogos → Rent. Este paso vigila que el
    // Rent del mes existe y que NO huele a clon: si cada producto repite
    // exactamente la cuota del mes pasado, seguramente aún no se pegó la
    // tabla nueva de Telefónica (los precios cambian todos los meses).
    {
      const rentRows = wp ? await prisma.productCatalog.findMany({
        where: { periodId: wp.id, categoria: 'Rent' },
        select: { producto: true, anual: true, validFrom: true },
      }) : []
      const [aa, mm] = periodKey.split('_').map(Number)
      const prevKey = mm === 1 ? `${aa - 1}_12` : `${aa}_${String(mm - 1).padStart(2, '0')}`
      const wpPrev = await prisma.workPeriod.findUnique({ where: { period_key: prevKey } })
      const prevRows = wpPrev ? await prisma.productCatalog.findMany({
        where: { periodId: wpPrev.id, categoria: 'Rent' }, select: { producto: true, anual: true },
      }) : []
      const prevMap = new Map(prevRows.map(r => [String(r.producto).trim().toLowerCase(), String(r.anual)]))
      const igualQuePrev = rentRows.length > 0 && prevRows.length === rentRows.length &&
        rentRows.every(r => prevMap.get(String(r.producto).trim().toLowerCase()) === String(r.anual))
      const vigencias = new Map<string, number>()
      for (const r of rentRows) {
        const k = String(r.validFrom || 'sin fecha')
        vigencias.set(k, (vigencias.get(k) || 0) + 1)
      }
      pasos.push({
        id: 'rent_dispositivos',
        titulo: 'Tabla de dispositivos → catálogo Rent',
        resumen: 'Que los precios Rent del mes son los de la TABLA_DISPOSITIVOS de Telefónica, no un arrastre.',
        estado: rentRows.length === 0 ? 'rojo' : (igualQuePrev ? 'ambar' : 'verde'),
        detalles: rentRows.length === 0
          ? ['El mes no tiene catálogo Rent.']
          : [
              `${rentRows.length} dispositivos · ${vigencias.size} vigencia${vigencias.size === 1 ? '' : 's'}.`,
              ...(igualQuePrev ? ['Cada producto repite la cuota del mes pasado: parece el catálogo clonado, sin la tabla nueva.'] : []),
            ],
        ayuda: rentRows.length === 0 || igualQuePrev
          ? 'En el ERP («Archivos y documentos» → casilla TABLA DISPOSITIVOS) baja la «tabla lista para pegar» y pégala en Catálogos → Rent → «Importar Lista»; allí eliges el «Vigente desde» si llegó tarde.'
          : undefined,
        accion: { tipo: 'enlace', etiqueta: 'Ir al catálogo Rent', href: '/catalogos?tab=Rent' },
        ...(conTablas && rentRows.length ? { tablas: [{
          titulo: 'Vigencias del Rent',
          subtitulo: 'Cuántos dispositivos entran en cada «Vigente desde» — dos tarifas el mismo mes = dos filas.',
          columnas: ['Vigente desde', 'Dispositivos'],
          numericas: [1],
          filas: [...vigencias.entries()].sort().map(([f, n]) => [f, String(n)]),
        }] } : {}),
      })
    }

    // ── Pasos 6-9: los que necesitan el motor (comisiones/jefe/candados) ─────
    let panelOk = false
    let sellerStats: any[] = []
    let despues: any = null
    let jefeTotal = 0
    let inputPanel: any = null   // catálogos y demás insumos, para el paso del versus
    let panelError = ''          // la causa, para que el rojo del paso 6 no sea mudo
    try {
      const { input, ventas } = await loadPanelInputs(prisma, periodKey)
      inputPanel = input
      despues = computePanelComisionesTiendas(input)
      sellerStats = despues.sellerStats || []
      panelOk = true
      // Jefe
      try {
        const [pctSettings, terrSetting] = await Promise.all([
          prisma.appSetting.findMany({ where: { key: { in: jefePctKeysTodas(periodKey) } } }),
          prisma.appSetting.findUnique({ where: { key: `territorial_tiendas_${periodKey}` } }),
        ])
        const { pcts } = resolverJefePcts(new Map(pctSettings.map(x => [x.key, x.value])), periodKey)
        let terr: any[] = []
        if (terrSetting?.value) { try { terr = JSON.parse(terrSetting.value) || [] } catch {} }
        jefeTotal = r2(computeComisionJefeTiendas({
          sellerStats, adjustedTiendaRules: despues.adjustedTiendaRules, territorialTiendasRules: terr,
          monthSales: ventas, catalogs: input.catalogs || {}, viewingPeriod: periodKey.replace(/[_-]/g, ''), pcts,
        }).total)
      } catch (e) { console.warn('[salud-mes tiendas] jefe:', e) }
    } catch (e: any) {
      panelError = String(e?.message || e)
      console.warn('[salud-mes tiendas] panel:', e)
    }

    // ── Paso 6: comisiones del equipo (foto) ────────────────────────────────
    {
      // O2 MovilFree se detecta por la TIENDA de la plantilla del mes (columna
      // 'O2' de Horarios de Comerciales), no solo por llamarse Marta: aguanta
      // renombres, homónimos y un relevo en el puesto. El nombre queda de red.
      const nombresO2 = new Set(
        (inputPanel?.tiendaHours || [])
          .filter((h: any) => String(h.tienda || '').trim().toUpperCase() === 'O2')
          .map((h: any) => String(h.comercial || '').trim().toLowerCase())
      )
      const esMarta = (s: any) => {
        const n = String(s.name || s.comercial || '').trim().toLowerCase()
        return nombresO2.has(n) || n.includes('marta')
      }
      const comisionDe = (s: any) => r2(Number(s.totalComision || 0) + Number(s.totalExtras || 0))
      // El equipo de TIENDA (sin Marta) y el jefe van juntos: es lo que cobra la
      // gente de las 4 tiendas físicas y Salva (que no cobra sobre Marta).
      const porComercial = sellerStats.filter((s: any) => !esMarta(s)).map((s: any) => ({ nombre: s.name || s.comercial, total: comisionDe(s) }))
      const equipo = r2(porComercial.reduce((a: number, x: any) => a + x.total, 0))
      // Marta (O2 MovilFree) va en SU PROPIA línea: cobra aparte, por sus reglas
      // O2 + territorial O2. Antes se caía del hub entero y su O2 no salía en
      // ningún sitio; ahora se ve, sin mezclarla con el equipo de tienda.
      const marta = sellerStats.find(esMarta)
      const martaO2 = marta ? comisionDe(marta) : 0
      pasos.push({
        id: 'comisiones',
        titulo: 'Comisiones del equipo (foto de hoy)',
        resumen: 'Lo que llevan pagado el equipo, el jefe y O2 MovilFree, con el mismo motor que la liquidación del ERP.',
        estado: panelOk ? 'verde' : 'rojo',
        detalles: panelOk
          ? [`Equipo de tienda: ${eur(equipo)} · Jefe (Salva): ${eur(jefeTotal)}.`,
             `O2 MovilFree (Marta): ${eur(martaO2)}.`,
             `Comerciales de tienda con comisión: ${porComercial.filter((x: any) => x.total > 0).length}.`]
          : ['No se pudo calcular la foto de comisiones.',
             panelError ? `Causa: ${panelError}` : 'Causa desconocida (¿faltan palancas o plantilla?).'],
        accion: { tipo: 'enlace', etiqueta: 'Panel de Comisiones', href: '/tiendas/comisiones' },
        ...(conTablas && panelOk ? { tablas: [{
          titulo: 'Comisiones por comercial (foto de hoy)',
          subtitulo: 'El mismo motor que el Panel y la liquidación N+3 del ERP.',
          columnas: ['Comercial', 'Comisión', 'Extras', 'Total'],
          numericas: [1, 2, 3],
          filas: [
            ...[...sellerStats].map((s: any) => ({
              n: String(s.name || s.comercial || ''), c: r2(Number(s.totalComision || 0)),
              e: r2(Number(s.totalExtras || 0)), t: comisionDe(s), marta: esMarta(s),
            })).sort((a, b) => b.t - a.t)
              .map(x => [x.marta ? `${x.n} (O2)` : x.n, eur(x.c), eur(x.e), eur(x.t)]),
            ['Jefe (Salva)', '—', '—', eur(jefeTotal)],
          ],
        }] } : {}),
      })
    }

    // ── Paso 6b: lo que cobramos vs lo que pagamos ──────────────────────────
    {
      let estado: EstadoPaso = 'ambar'
      let detalles: string[] = ['No se pudo calcular (falta la foto de comisiones del paso anterior).']
      let ayuda: string | undefined
      let tablasVersus: any[] = []
      if (panelOk && inputPanel) {
        try {
          // El COBRO usa el universo del feed del ERP (TODAS las ventas con fecha
          // del mes), no el del panel: las líneas-extra de los Repos (los 10 € que
          // la empresa cobra pero no pagan comisión) viven fuera del universo del
          // panel y sin ellas el cobro salía corto (~-979 € en julio-2026).
          const [y, m] = periodKey.split('_')
          const todas = await prisma.sale.findMany({
            select: {
              id: true, fecha: true, detalle: true, codigo: true, producto: true,
              cuota: true, anulado: true, pendiente: true, rentConCoste: true,
              isSwap: true, sustituida: true, sustituyeA: true, seguro: true, seguroImporte: true,
            },
          })
          const delMes = todas.filter(v => {
            const f = String(v.fecha || '')
            return f.length >= 10 && f[2] === '/' && f[5] === '/' && f.slice(6, 10) === y && f.slice(3, 5) === m
          })
          // catálogos montados como los del feed (la referencia cuadrada con la
          // Hoja de Cobro), no los del motor del Panel (estructura distinta)
          const catsMes = await catalogosDelMesTiendas(prisma, periodKey)
          const vs = computeVersusTiendas({
            ventas: delMes, catalogs: catsMes,
            periodKey, sellerStats, jefeTotal,
          })
          const hoy = new Date()
          const hoyKey = `${hoy.getFullYear()}_${String(hoy.getMonth() + 1).padStart(2, '0')}`
          const mesCerrado = periodKey < hoyKey
          // Los avisos solo ACUSAN (rojo) con el mes cerrado; a mitad de mes las
          // palancas por tramos aún no han «abierto» y una pérdida puede ser ruido.
          estado = vs.avisos.length ? (mesCerrado ? 'rojo' : 'ambar') : 'verde'
          detalles = [
            `Cobramos ${eur(vs.cobro)} (${vs.ops} operaciones) · pagamos ${eur(vs.pago)} → margen ${eur(vs.margen)}${vs.margenPct !== null ? ` (${vs.margenPct.toLocaleString('es-ES')} %)` : ''}.`,
            `El pago: equipo ${eur(vs.pagoEquipo)} + jefe ${eur(vs.pagoJefe)} + O2 MovilFree ${eur(vs.pagoO2)}.`,
          ]
          if (vs.multi.ventas > 0) {
            detalles.push(`${vs.multi.ventas} venta(s) cobran por 2+ reglas a la vez: ${eur(vs.multi.importeAdicional)} en segundas/terceras reglas.`)
            detalles.push(...vs.multi.ejemplos.map(e => `· ${e}`))
          }
          detalles.push(...vs.avisos.map(a => `⚠ ${a}`))
          if (conTablas && vs.porPalanca.length) {
            tablasVersus = [{
              titulo: 'Cobro vs pago por palanca',
              subtitulo: 'El pago aquí son las líneas por venta; los extras/bonos y el jefe (por objetivos) van aparte. Los avisos se juzgan por familia (Repos/TV/Fútbol juntos).',
              columnas: ['Palanca', 'Cobramos', 'Pagamos', 'Margen'],
              numericas: [1, 2, 3],
              filas: vs.porPalanca.map(p2 => [p2.palanca, eur(p2.cobro), eur(p2.pago), eur(p2.margen)]),
            }]
          }
          if (vs.avisos.length) {
            ayuda = mesCerrado
              ? 'Con el mes cerrado, una palanca en pérdida es real: revisa su regla en el Panel de Comisiones. No se toca ninguna regla sola: la decisión es tuya.'
              : 'A mitad de mes es orientativo (los tramos aún se están abriendo); si sigue así al cierre, revisa la regla.'
          }
        } catch (e) {
          console.warn('[salud-mes tiendas] versus:', e)
          detalles = ['No se pudo calcular el cobro vs pago de este mes.']
        }
      }
      pasos.push({
        id: 'versus',
        titulo: 'Lo que cobramos vs lo que pagamos',
        resumen: 'Cuánto cobra la empresa por las ventas del mes y cuánto paga en comisiones, con las ventas que cobran por varias reglas a la vez.',
        estado,
        detalles,
        ayuda,
        accion: { tipo: 'enlace', etiqueta: 'Comisiones VS (detalle)', href: '/direccion-tiendas/comisiones-vs' },
        ...(tablasVersus.length ? { tablas: tablasVersus } : {}),
      })
    }

    // ── Paso 7: los 9 % del jefe del mes ────────────────────────────────────
    {
      const claves = JEFE_PCT_KEYS_BASE.map(k => `${k}_${periodKey}`)
      const hay = await prisma.appSetting.findMany({ where: { key: { in: claves } }, select: { key: true, value: true } })
      const n = hay.length
      const valorDe = new Map(hay.map(x => [x.key, x.value]))
      pasos.push({
        id: 'jefe_pct',
        titulo: 'Los % del Jefe de Ventas del mes',
        resumen: 'Que los porcentajes de Salva son los de ESTE mes (no un respaldo de hace meses).',
        estado: n > 0 ? 'verde' : 'ambar',
        detalles: n > 0
          ? [`${n} de ${claves.length} porcentajes guardados con la clave de este mes.`]
          : ['Ningún % propio de este mes: el jefe cobraría con el respaldo general (puede ser de hace meses).'],
        ayuda: n > 0 ? undefined : 'Revísalos y guárdalos en el Panel del Jefe para que queden anclados a este mes.',
        accion: { tipo: 'enlace', etiqueta: 'Comisiones del Jefe', href: '/seguimiento-ventas/comisiones-jefe' },
        ...(conTablas && n > 0 ? { tablas: [{
          titulo: 'Los % del jefe, de este mes',
          subtitulo: 'Guardados con la clave del mes (sin respaldos viejos).',
          columnas: ['Concepto', '%'],
          numericas: [1],
          filas: JEFE_PCT_KEYS_BASE.map(k => [
            k.replace(/^jefe_pct_/, '').replace(/_/g, ' '),
            valorDe.has(`${k}_${periodKey}`) ? String(valorDe.get(`${k}_${periodKey}`)) : '(respaldo)',
          ]),
        }] } : {}),
      })
    }

    // ── Paso 8: territorial y O2 del mes ────────────────────────────────────
    {
      const claves = [`territorial_tiendas_${periodKey}`, `territorial_o2_${periodKey}`, `o2_rules_v2_${periodKey}`]
      const hay = await prisma.appSetting.findMany({ where: { key: { in: claves } }, select: { key: true, value: true } })
      const presentes = new Set(hay.filter(h => h.value && h.value !== '[]' && h.value !== '{}').map(h => h.key))
      const faltan = claves.filter(c => !presentes.has(c))

      // La misma trampa que en los objetivos por tienda: al pre-crear el mes, el
      // territorial se clona con los OBJETIVOS del mes anterior (los de agosto,
      // p. ej. el 161 del fútbol) y el paso salía VERDE. Si el del mes es calcado
      // al anterior, se avisa: el % de cumplimiento y el tramo que pinta
      // Territorial PDV son contra el objetivo del mes pasado.
      const valorTerr = hay.find(h => h.key === `territorial_tiendas_${periodKey}`)?.value || ''
      const terrPrev = valorTerr
        ? (await prisma.appSetting.findUnique({
            where: { key: `territorial_tiendas_${mesAnterior(periodKey)}` },
            select: { value: true },
          }))?.value || ''
        : ''
      const territorialEsDelMesAnterior = !!valorTerr && valorTerr === terrPrev
      pasos.push({
        id: 'territorial_o2',
        titulo: 'Territorial y O2 MovilFree del mes',
        resumen: 'Que las tres configuraciones del mes están cargadas.',
        estado: faltan.length === claves.length ? 'rojo'
              : (faltan.length || territorialEsDelMesAnterior) ? 'ambar' : 'verde',
        detalles: faltan.length
          ? [`Faltan: ${faltan.map(c => c.replace(`_${periodKey}`, '')).join(', ')}.`]
          : territorialEsDelMesAnterior
            ? [`Las tres configuraciones están, pero el territorial de tiendas es CALCADO al de ${nombreMes(mesAnterior(periodKey))}: lo trajo el clonado.`,
               'Mientras no pongas los objetivos de este mes, el % y el tramo de Territorial PDV se miden contra los del mes pasado.']
            : ['Territorial de tiendas, territorial O2 y reglas O2: las tres presentes.'],
        ayuda: faltan.length
          ? 'Se arrastran al clonar el mes; si falta, revísalo en Territorial.'
          : territorialEsDelMesAnterior
            ? 'Cuando llegue el TER de Telefónica, pon los objetivos de cada palanca en Entrada de Datos → TERRITORIAL TIENDAS.'
            : undefined,
        accion: { tipo: 'enlace', etiqueta: 'Ganancias / Territorial', href: '/direccion-tiendas/ganancias' },
      })
    }

    // ── Paso 9: extras y bonos (con sello «Ya lo he revisado») ──────────────
    {
      const reglasEx = wp ? await prisma.extraRule.count({ where: { isActive: true } }) : 0
      const asig = wp ? await prisma.extraAssignment.count({ where: { periodId: wp.id } }) : 0
      const sospecha = reglasEx === 0 && asig > 0  // bonos vivos sin regla que los respalde

      let estado: EstadoPaso = sospecha ? 'ambar' : 'verde'
      const detalles = [`${reglasEx} reglas de extras activas · ${asig} bonos asignados este mes.`]
      let ayuda: string | undefined
      let accionSecundaria: any = undefined

      if (sospecha) {
        // ¿Lo ha dado el dueño por revisado y sigue igual? → verde con constancia.
        const selloRow = await prisma.appSetting.findUnique({ where: { key: claveSelloRevision('extras', periodKey) } })
        const huella = await huellaDelPaso(prisma, 'extras', periodKey)
        const { sello, vigente } = leerSello(selloRow?.value, huella)
        if (vigente && sello) {
          estado = 'verde'
          detalles.push(`Lo diste por revisado el ${cuandoEnCristiano(sello.cuando)} (${sello.quien}) y no ha cambiado desde entonces.`)
        } else {
          detalles.push('⚠ Hay bonos pero ninguna regla activa: revisa si deben seguir.')
          if (sello && !vigente) detalles.push(`Lo diste por revisado el ${cuandoEnCristiano(sello.cuando)}, pero los bonos han cambiado desde entonces.`)
          ayuda = 'Mira los bonos vivos en el panel de Extras; si deben seguir, pulsa «Ya lo he revisado» y el aviso se apaga (vuelve solo si cambian).'
          accionSecundaria = { tipo: 'revisado', etiqueta: 'Ya lo he revisado' }
        }
      }

      let tablasExtras: any[] = []
      if (conTablas && reglasEx > 0) {
        const reglasVivas = await prisma.extraRule.findMany({ where: { isActive: true } })
        tablasExtras = [{
          titulo: 'Reglas de extras activas',
          subtitulo: 'Lo que paga cada regla al comercial y a la empresa.',
          columnas: ['Regla', 'Canal', 'Paga comercial', 'Cobra empresa', 'Tope'],
          numericas: [2, 3, 4],
          filas: reglasVivas.map(rx => [
            String(rx.name || ''), String(rx.channelType || ''),
            eur(Number(rx.sellerRewardAmount || 0)), eur(Number(rx.telecomRewardAmount || 0)),
            rx.maxPayoutUnits != null ? String(rx.maxPayoutUnits) : '—',
          ]),
        }]
      }
      pasos.push({
        id: 'extras',
        titulo: 'Extras y bonos KPI',
        resumen: 'Que los bonos del mes cuadran con las reglas activas.',
        estado,
        detalles,
        ayuda,
        accion: { tipo: 'enlace', etiqueta: 'Panel de Comisiones', href: '/tiendas/comisiones' },
        ...(accionSecundaria ? { accionSecundaria } : {}),
        ...(tablasExtras.length ? { tablas: tablasExtras } : {}),
      } as any)
    }

    // ── Paso 10: mes siguiente preparado ────────────────────────────────────
    {
      const nextKey = mesSiguiente(periodKey)
      const next = await prisma.workPeriod.findUnique({ where: { period_key: nextKey } })
      pasos.push({
        id: 'mes_siguiente',
        titulo: `Mes siguiente (${nombreMes(nextKey)}) preparado`,
        resumen: 'Que el mes que viene ya existe como borrador, listo para el día 1.',
        estado: next ? 'verde' : 'ambar',
        detalles: next
          ? [`${nombreMes(nextKey)} ya está creado (${next.status}).`]
          : [`${nombreMes(nextKey)} todavía no existe: conviene pre-crearlo antes de fin de mes.`],
        ayuda: next ? undefined : 'Pulsa «Clonar mes» en Gestión de Periodos para pre-crearlo desde el mes actual.',
        accion: wp
          ? { tipo: 'clonar', etiqueta: `Pre-crear ${nombreMes(nextKey)}`, sourcePeriodId: wp.id }
          : { tipo: 'enlace', etiqueta: 'Gestión de Periodos', href: '/admin/periodos' },
      })
    }

    const resumen = {
      verde: pasos.filter(p => p.estado === 'verde').length,
      ambar: pasos.filter(p => p.estado === 'ambar').length,
      rojo: pasos.filter(p => p.estado === 'rojo').length,
    }

    const out: SaludMesTiendasResponse = {
      success: true, periodKey, generadoEn: new Date().toISOString(), resumen, pasos,
    }
    return NextResponse.json(out)
  } catch (e: any) {
    console.error('[GET /api/salud-mes tiendas]', e)
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
  }
}
