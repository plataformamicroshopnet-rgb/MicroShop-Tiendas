import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canEdit, can } from '@/lib/permissions'
import { mesYaPagadoN3, fechaPagoN3, nombreMes } from '@/lib/nominaN3'
import { PrismaClient } from '@prisma/client'
import { runExtrasEngine } from '@/lib/extrasEngine'
import { randomUUID } from 'crypto'
import { reglaYaVaDentro, reglaMismoServicio, reglaPedidoDeOtroCliente,
         reglaLineaRepetida, reglaTvDelMismoDia, reglaCruceO2, reglaPedidoPartido,
         AvisoAntifraude } from '@/lib/antifraudeVentas'
import { esRepoArpuManual, importeRepoArpu, rastroRepoArpu } from '@/lib/salesUtils'

const prisma = new PrismaClient()

// Validación real del documento: DNI (letra mod-23), NIE y CIF (control).
// Espejo del validador del formulario de Nueva Venta: doble candado.
function documentoValido(v: string): boolean {
  const s = String(v || '').trim().toUpperCase().replace(/[\s-]/g, '')
  const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE'
  let m = s.match(/^(\d{8})([A-Z])$/)
  if (m) return LETRAS[parseInt(m[1], 10) % 23] === m[2]
  m = s.match(/^([XYZ])(\d{7})([A-Z])$/)
  if (m) return LETRAS[parseInt(String('XYZ'.indexOf(m[1])) + m[2], 10) % 23] === m[3]
  m = s.match(/^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/)
  if (m) {
    let suma = 0
    for (let i = 0; i < 7; i++) {
      let n = parseInt(m[2][i], 10)
      if (i % 2 === 0) { n *= 2; n = Math.floor(n / 10) + (n % 10) }
      suma += n
    }
    const digito = (10 - (suma % 10)) % 10
    const letra = 'JABCDEFGHI'[digito]
    if ('KPQS'.includes(m[1])) return m[3] === letra
    if ('ABEH'.includes(m[1])) return m[3] === String(digito)
    return m[3] === String(digito) || m[3] === letra
  }
  return false
}

function resolveGrupo(prod: any): string {
  const cat = prod.categoria || ''
  const prodName = prod.producto || ''

  if (cat === 'Ti' || cat === 'Contratos Móvil') return 'TI'
  if (cat === 'TMA') return 'TMA'
  if (cat === 'Micro' || cat === 'MIC') return 'MIC'
  if (cat === 'miMovistar' || cat === 'Resto BAF' || cat === 'Traslado miMovistar') return 'BAF'
  if (cat === 'Rent' || cat === 'Seguro') return 'REN'
  if (cat === 'O2') return 'ALTA'
  if (cat === 'Accesorios') return 'ACC'

  const productMap: Record<string, string[]> = {
    'FD': [
      'Alta FD Total', 'Alta FD Total NC', 'Migra FD Total', 
      'Alta FD Flex', 'Alta FD Flex NC', 'Migra FD Flex'
    ],
    'BAF': [
      'Alta BAF Total', 'Alta BAF Total NC', 
      'Respaldo 5G', 'Migra BAF Total'
    ],
    'REN': [
      'Renovación', 'Renovación Base', 'Renovación Extra = 1', 
      'Renovación Extra > 1', 'Renovación + Dispositivo', 
      'Renovación + Dispositivo [Solo Comisiones]'
    ],
    'ALTA': [
      'Alta Móvil AV', 'Alta Móvil MV', 'Alta Móvil BV'
    ],
    'PORTA': [
      'Porta Móvil AV', 'Porta Móvil AV NC', 'Porta Móvil MV', 
      'Porta Móvil MV NC', 'Porta Móvil BV', 'Porta Móvil BV NC'
    ],
    'MPA': [
      'Alarma Directa', 'Alarma Asistida o Esencial', 'Venta MPA'
    ]
  }

  for (const [gName, names] of Object.entries(productMap)) {
    if (names.includes(prodName)) return gName
  }

  return '-'
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    // El formulario de Nueva Venta se abre con CARD_NUEVA_VENTA; aquí se
    // aceptaba SOLO la edición de Tiendas y un Back Office/Gestora podía abrir
    // el formulario y estrellarse con un 403 al guardar. Misma llave que la puerta.
    if (!session || !(canEdit(session.user, 'MODULE_TIENDAS') || can(session.user, 'CARD_NUEVA_VENTA'))) {
      return NextResponse.json({ success: false, error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }

    const { user } = session
    const data = await request.json()

    if (!data.vendedor) return NextResponse.json({ success: false, error: 'Selecciona el vendedor' }, { status: 400 })
    if (!data.nombreCliente) return NextResponse.json({ success: false, error: 'Indica el nombre del cliente' }, { status: 400 })
    if (!data.nif) return NextResponse.json({ success: false, error: 'Comprueba el NIF del Titular' }, { status: 400 })
    if (!documentoValido(data.nif)) return NextResponse.json({ success: false, error: 'El NIF/CIF del titular no es válido (DNI, NIE o CIF). Comprueba el documento del cliente.' }, { status: 400 })

    const numValidProducts = data.productos.filter((p: any) => p.producto !== '').length
    if (numValidProducts === 0) return NextResponse.json({ success: false, error: 'Configura al menos un producto' }, { status: 400 })

    // Repo de ARPU: sin incremento no hay venta. El importe de estas ventas SIEMPRE
    // sale de incremento × multiplicador; si se dejara pasar sin él, entraría el
    // número en crudo (sin multiplicar) y nadie lo notaría hasta la liquidación.
    if (data.productos.some((p: any) => p.producto !== '' && esRepoArpuManual(p.producto)
        && !(importeRepoArpu(p.arpuIncremento) > 0))) {
      return NextResponse.json({ success: false, error: 'Falta el Incremento de ARPU del repo «Reposicionamientos destino BAF miMovistar/Fusión»: el importe se calcula con él (×2 desde 10 €, ×1,5 por debajo).' }, { status: 400 })
    }

    // En Rent es obligatorio indicar el origen del terminal: TIENDA descuenta
    // stock, LOGISTICO no (a veces se vende por envío aunque haya unidades).
    if (data.productos.some((p: any) => p.producto !== '' && p.categoria === 'Rent' && !['TIENDA', 'LOGISTICO'].includes(String(p.origenStock || '')))) {
      return NextResponse.json({ success: false, error: 'En los Rent debes seleccionar el Origen del terminal (stock de tienda o envío logístico).' }, { status: 400 })
    }

    // --- REGLA ANTI-FRAUDE TRASLADOS MISTAR + SUSCRIPCIONES TV ---
    // Antifraude de traslados: desde ago-2026 las suscripciones de TV se teclean
    // en la palanca nueva «Repos (Arpu)», así que mirar solo 'Suscripciones TV'
    // dejaba pasar la suscripción de un NIF con traslado reciente.
    // Y desde ago-2026 tambien se pueden plegar DENTRO de un alta miMovistar: la
    // linea es entonces de categoria 'miMovistar', asi que sin mirar reposDentro
    // el traslado reciente pasaba de largo.
    const esPalancaTV = (c: any) => c === 'Suscripciones TV' || c === 'Repos UP'
    const hasSuscripcionTV = data.productos.some((p: any) =>
      (esPalancaTV(p.categoria) && p.producto !== '')
      || (Array.isArray(p.reposDentro) && p.reposDentro.length > 0));
    
    if (hasSuscripcionTV && data.nif) {
       const hasTrasladoInPayload = data.productos.some((p: any) => 
           p.producto !== '' && (p.categoria === 'Traslado miMovistar' || String(p.producto || '').toLowerCase().includes('traslado'))
       );
       
       const twentyDaysAgo = new Date();
       twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

       const recentTraslado = await prisma.sale.findFirst({
         where: {
           nif: data.nif.toUpperCase(),
           createdAt: { gte: twentyDaysAgo },
           detalle: 'Traslado miMovistar'
         }
       });

       if (hasTrasladoInPayload || recentTraslado) {
         const hasInvalidSuscripcion = data.productos.some((p: any) => {
            if (!esPalancaTV(p.categoria) || p.producto === '') return false;
            const imp = parseFloat(String(p.importe || '0').replace(',','.'));
            return !isNaN(imp) && imp > 0;
         });
         
         // Puerta para el caso legítimo (dueño, 27-ago-2026, cliente real con
         // traslado ajeno a la suscripción): mismo circuito que el aviso de
         // duplicados — 409 con la bandera, el formulario pregunta con todas
         // las letras y solo entra si se confirma. La red de seguridad de hoy
         // (cotejo de la Revisión + re-verificación N+3) destapa sola las que
         // Telefónica al final no pague.
         if (hasInvalidSuscripcion && !data.confirmarAntifraude) {
            return NextResponse.json({ 
              success: false, 
              antifraude: true,
              error: 'Antifraude: este NIF tiene un Traslado miMovistar de los últimos 20 días y Telefónica suele NO pagar la Suscripción TV/Repo que lo acompaña.' 
            }, { status: 409 });
         }
       }
    }
    // -------------------------------------------------------------

    // ── FECHA DE VENTA: validación, marcha atrás y ANCLA DE PERIODO ────
    // La venta vive en el MES de su fecha de tramitación, no en el periodo
    // activo de la interfaz: una venta de junio apuntada en julio cuenta
    // solo en junio y no se duplica entre meses.
    const ahora = new Date()
    const hoyDate = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
    let fechaVentaDate = hoyDate
    let fechaStr = `${String(ahora.getDate()).padStart(2, '0')}/${String(ahora.getMonth() + 1).padStart(2, '0')}/${ahora.getFullYear()}`
    if (data.fechaVenta && /^\d{4}-\d{2}-\d{2}$/.test(data.fechaVenta)) {
      const [fy, fm, fd] = data.fechaVenta.split('-')
      fechaStr = `${fd}/${fm}/${fy}`
      fechaVentaDate = new Date(Number(fy), Number(fm) - 1, Number(fd))
    }

    if (fechaVentaDate.getTime() > hoyDate.getTime()) {
      return NextResponse.json({ success: false, error: 'La Fecha de Venta no puede ser futura: pon la fecha real de tramitación en Movistar.' }, { status: 400 })
    }

    // ── CANDADO DE NÓMINA PAGADA (25-ago-2026, para TODOS, admin incluido) ──
    // Se puede añadir una operación en un mes cerrado MIENTRAS su nómina siga
    // en borrador en el ERP (regla N+3: el mes M se paga el 1 de M+4) — la
    // re-verificación nocturna la incorpora sola y cuenta para todo como si el
    // mes estuviera en vigor. En un mes ya PAGADO no: la nómina es inmutable y
    // la venta descuadraría Tiendas contra el abonaré sin que nadie lo viera.
    if (mesYaPagadoN3(fechaVentaDate, hoyDate)) {
      const _pago = fechaPagoN3(fechaVentaDate)
      return NextResponse.json({
        success: false,
        error: `La nómina de ${nombreMes(fechaVentaDate)} ya se pagó (el 1 de ${nombreMes(_pago)}, regla N+3) y es inmutable: no se pueden añadir operaciones a ese mes. Si de verdad falta una operación ahí, coméntalo con el administrador.`,
      }, { status: 400 })
    }

    // Marcha atrás permitida para AÑADIR olvidadas (días laborables, por usuario)
    const dbUserVenta = await prisma.user.findUnique({ where: { username: user.username || '' } })
    const esAdminVenta = (dbUserVenta?.role || user.role) === 'ADMIN'
    const margenCrear = esAdminVenta ? 99999 : (((dbUserVenta as any)?.retroDiasCrear ?? 5) as number)
    let diasLaborablesAtras = 0
    {
      const d = new Date(fechaVentaDate)
      while (d.getTime() < hoyDate.getTime()) {
        d.setDate(d.getDate() + 1)
        const dow = d.getDay()
        if (dow !== 0 && dow !== 6) diasLaborablesAtras++
      }
    }
    if (diasLaborablesAtras > margenCrear) {
      return NextResponse.json({ success: false, error: `Solo puedes registrar ventas de hasta ${margenCrear} día(s) laborables atrás. Para una venta más antigua, avisa a un responsable con permiso de marcha atrás.` }, { status: 400 })
    }

    // Ancla de periodo: el WorkPeriod del mes/año de la fecha de tramitación
    const anchorWp = await prisma.workPeriod.findFirst({
      where: { month: fechaVentaDate.getMonth() + 1, year: fechaVentaDate.getFullYear() }
    })

    // ── POLÍTICA ANTIFRAUDE (27-ago-2026) ───────────────────────────────
    // Sustituye al aviso de duplicado de siempre, que exigía que el producto se
    // llamara EXACTAMENTE igual y solo miraba la base de datos: de las 12
    // operaciones que la auditoría confirmó cobrando dos veces, no vio 11.
    // Cada regla se midió ANTES contra junio-agosto, y ninguna molesta a una
    // operación buena. Dos de ellas PROHÍBEN (no hay «Aceptar» que valga):
    // «eso ya va dentro del alta» y «la tele del mismo día». Las demás avisan.
    {
      const lineas = data.productos
        .filter((p: any) => String(p.producto || '').trim())
        .map((p: any) => ({ categoria: p.categoria, producto: p.producto, numeroPedido: p.numeroPedido,
                            sinPaquetePlus: !!p.descuentoSinPlus }))
      const lineasConPedido = lineas

      if (lineas.length > 0) {
        const previasCliente = await prisma.sale.findMany({
          where: { nif: data.nif.toUpperCase() },
          select: { producto: true, detalle: true, sheet: true, fecha: true, codigo: true, vendedor: true,
                    numeroPedido: true, anulado: true, pendiente: true, sustituida: true,
                    sustituyeA: true, anotaciones: true },
        })
        const pedidos = lineas.map((l: any) => String(l.numeroPedido || '').trim()).filter(Boolean)
        const previasPedido = pedidos.length
          ? await prisma.sale.findMany({
              where: { numeroPedido: { in: pedidos }, NOT: { nif: data.nif.toUpperCase() } },
              select: { numeroPedido: true, nif: true, nombreCliente: true, fecha: true,
                        anulado: true, pendiente: true, sustituida: true },
            })
          : []

        const avisos: (AvisoAntifraude | null)[] = [
          reglaYaVaDentro(lineas, previasCliente as any, fechaVentaDate, 30),
          // Va DESPUÉS de «ya va dentro»: cuando las dos saltan, la primera
          // explica mejor el caso (el alta nombra ese mismo servicio).
          reglaTvDelMismoDia(lineas, previasCliente as any, fechaVentaDate),
          reglaMismoServicio(lineas, previasCliente as any, fechaVentaDate, 30),
          reglaLineaRepetida(lineas, previasCliente as any),
          reglaPedidoDeOtroCliente(lineas, data.nif, previasPedido as any),
          // Las dos de la letra pequeña del TER (30-ago-2026). Ambas AVISAN.
          reglaCruceO2(lineasConPedido, previasCliente as any, fechaVentaDate, 90),
          reglaPedidoPartido(lineasConPedido, previasCliente as any, fechaVentaDate),
        ]
        for (const aviso of avisos) {
          if (!aviso) continue
          // Lo que PROHÍBE no se puede confirmar: se devuelve sin `clave`, así que
          // la pantalla no ofrece ningún «Aceptar» y la venta no se guarda. El
          // dueño lo pidió el 27-ago tras ver que se podía dar dos veces Movistar+
          // al mismo NIF pulsando Aceptar en el aviso.
          if (aviso.bloquea) {
            return NextResponse.json({
              success: false, bloqueoAntifraude: true,
              titulo: aviso.titulo, error: aviso.texto,
            }, { status: 409 })
          }
          if ((data as any)[aviso.clave]) continue     // ya lo confirmó
          return NextResponse.json({
            success: false, avisoAntifraude: true, clave: aviso.clave,
            titulo: aviso.titulo, error: aviso.texto,
          }, { status: 409 })
        }

        // RASTRO: si venía alguna confirmación, queda escrito quién la aceptó.
        const confirmadas = ['confirmarYaVaDentro', 'confirmarMismoServicioVenta',
                             'confirmarMismoServicioHistorico', 'confirmarLineaRepetida',
                             'confirmarPedido', 'confirmarAntifraude',
                             'confirmarCruceO2', 'confirmarPedidoPartido']
          .filter(k => (data as any)[k])
        if (confirmadas.length > 0) {
          try {
            await prisma.userActivity.create({
              data: {
                userId: session.user.id, username: session.user.username, role: session.user.role,
                path: '/nueva-venta', action: 'ANTIFRAUDE_CONFIRMADO', device: 'DESKTOP',
                errorDetails: `${confirmadas.join(', ')} · NIF ${String(data.nif).toUpperCase()}`
                  + ` · ${data.productos.filter((p: any) => p.producto).map((p: any) => String(p.producto).split('\n')[0]).join(' | ')}`,
              },
            })
          } catch { /* el rastro nunca puede impedir una venta */ }
        }
      }
    }

    const salesToInsert = []
    const stockDecrements = []

    // ── SWAP COMO VENTA REAL (desde julio 2026) ─────────────────────────
    // La casilla ¿Swap? genera una línea de venta propia: Varios · "Swap" · 15 €.
    // El precio sale del catálogo (Varios → producto "Swap", campo Comisión) si
    // existe; si no, 15 € por defecto. Los meses anteriores a julio 2026 siguen
    // con el +15 € antiguo (isLegacySwap en lib/saleCommission) — histórico intacto.
    const SWAP_LINE_FROM = new Date(2026, 6, 1)
    let swapPrice = 15

    // ── EXTRA DEL REPO DE FÚTBOL ───────────────────────────────────────
    // El precio NO va en la hoja del catálogo a propósito: si estuviera en la
    // lista, un tramitador podría elegirlo suelto y quedarían líneas de 10 €
    // huérfanas, sin su repo de 78 €. Vive aquí, como los 15 € del Swap, y si
    // algún día hay que cambiarlo basta con crear la fila en el catálogo.
    const REPOS_PALANCA = 'Repos UP'
    const EXTRA_FUTBOL_PALANCA = 'Repo Fútbol'
    const EXTRA_FUTBOL_PRODUCTO = 'Repo Up Destino Fútbol'
    // El extra de 10 € (NC142Y) es para repos con destino «Fútbol Total,
    // LaLiga o Champions» — no solo Fútbol Total. Un repo a LaLiga o Champions
    // se quedaba sin sus 10 € y el comercial sin su línea.
    const esRepoChampLiga = (nombre: any) => {
      const t = String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (t.includes('futbol total')) return false
      return t.includes('champion') || t.includes('laliga') || t.includes('la liga')
    }
    const esRepoFutbol = (nombre: any) => {
      const t = String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      return t.includes('repo up destino futbol') && t.includes('futbol total')
    }
    let precioExtraFutbol = 10
    try {
      const exCat = await prisma.productCatalog.findFirst({
        where: { categoria: EXTRA_FUTBOL_PALANCA, producto: EXTRA_FUTBOL_PRODUCTO },
        orderBy: { createdAt: 'desc' }
      })
      if (exCat?.comision) {
        const v = parseFloat(String(exCat.comision).replace(',', '.'))
        if (!isNaN(v) && v > 0) precioExtraFutbol = v
      }
    } catch (e) { /* sin fila en catálogo: 10 € */ }
    try {
      const swCat = await prisma.productCatalog.findFirst({
        where: { categoria: 'Varios', producto: 'Swap' },
        orderBy: { createdAt: 'desc' }
      })
      if (swCat?.comision) {
        const v = parseFloat(String(swCat.comision).replace(',', '.'))
        if (!isNaN(v) && v > 0) swapPrice = v
      }
    } catch (e) { /* catálogo sin Swap: 15 € por defecto */ }

    for (let x = 0; x < data.productos.length; x++) {
      const prod = data.productos[x]
      if (prod.producto === '') continue

      let sheetCategory = 'OP'
      if (['Fija y Móvil', 'Ti', 'Rent', 'Micro'].includes(prod.categoria)) {
        sheetCategory = 'Venta Fija'
      }

      const calculatedGroup = resolveGrupo(prod)

      console.log('--- NUEVA VENTA DETECTADA ---')
      console.log('prod.categoria:', prod.categoria)
      console.log('prod.producto:', prod.producto)
      console.log('Valor final asignado a grupo:', calculatedGroup)

      // ── REPO DE ARPU CON IMPORTE A MANO ──────────────────────────────────
      // El precio no está en ninguna tarifa: es el incremento de ARPU tecleado
      // por su multiplicador (×2 desde 10 €, ×1,5 por debajo). Se recalcula AQUÍ
      // y no se da por bueno lo que llegue del navegador — la cuenta del dinero
      // la hace el servidor. Y el incremento se guarda en las anotaciones porque
      // la venta solo guarda el resultado: sin el rastro, 24 € podrían venir de
      // 12 × 2 o de 16 × 1,5 y nadie podría saberlo después.
      const esRepoArpu = esRepoArpuManual(prod.producto)
      const incArpu = esRepoArpu ? prod.arpuIncremento : null
      const hayIncArpu = esRepoArpu && incArpu !== null && incArpu !== undefined
        && String(incArpu).trim() !== '' && importeRepoArpu(incArpu) > 0

      let finalAnotaciones = data.anotaciones || ''
      if (hayIncArpu) {
        finalAnotaciones = [finalAnotaciones, rastroRepoArpu(incArpu)].filter(Boolean).join(' · ')
      }
      if (prod.motivoSinStock) {
        finalAnotaciones = finalAnotaciones 
          ? `${finalAnotaciones} | Motivo Sin Stock: ${prod.motivoSinStock}`
          : `Motivo Sin Stock: ${prod.motivoSinStock}`
      }

      // Id propio (en vez de dejar que lo ponga la base de datos) para que la
      // linea hermana del repo de futbol pueda apuntar a esta venta: se insertan
      // las dos de golpe con createMany y ahi no hay ids de vuelta.
      const idMadre = randomUUID()

      salesToInsert.push({
        id: idMadre,
        sheet: sheetCategory,
        vendedor: data.vendedor,
        fecha: fechaStr,
        codigo: data.codigo || '',
        producto: prod.producto,
        nombreCliente: data.nombreCliente,
        nif: data.nif.toUpperCase(),
        potencial: prod.noCliente || '',
        telf: prod.telf || '',
        pendiente: prod.pendiente || '',
        anulado: 'No',
        // La promo «sin Paquete Movistar Plus» deja rastro: el importe guardado
        // ya viene con los −14 € aplicados desde Nueva Venta, y aquí queda
        // escrito el porqué (para auditorías y para el cruce con Telefónica).
        anotaciones: prod.descuentoSinPlus
          ? [finalAnotaciones, 'Promo −14 € sin Paquete Movistar Plus'].filter(Boolean).join(' · ')
          : finalAnotaciones,
        telefonoFijo: data.telefonoFijo || '',
        telefonoMovil: data.telefonoMovil || '',
        boletin: data.boletin || '',
        grupo: calculatedGroup,
        // Para Seguros: cuota en BD = Cuota Total (seguroImporte), no la Comisión (importe)
        // Esto asegura que el Registro de Operaciones y todos los paneles lean el valor correcto.
        cuota: hayIncArpu
          ? importeRepoArpu(incArpu)
          : ((prod.categoria === 'Seguro' && prod.seguroImporte && parseFloat(prod.seguroImporte.toString().replace(',','.')) > 0)
            ? parseFloat(prod.seguroImporte.toString().replace(',','.'))
            : (prod.importe ? parseFloat(prod.importe.toString().replace(',','.')) : null)),
        detalle: prod.categoria || '',
        imei: prod.imei || null,
        numeroPedido: prod.numeroPedido || null,
        origenStock: prod.categoria === 'Rent' ? (prod.origenStock || null) : null,
        rentConCoste: prod.rentConCoste || null,
        seguro: prod.seguro || null,
        seguroImporte: prod.seguroImporte ? parseFloat(prod.seguroImporte.toString().replace(',','.')) : null,
        isLibre: prod.isLibre === true,
        isSwap: prod.isSwap === true,
        // Ancla al mes de la fecha de tramitación (no al periodo de la UI)
        periodId: anchorWp?.id || null
      })

      // Línea hermana del Swap: venta REAL de Varios con su descripción.
      // El padre conserva isSwap=true (columna "Swap: Sí" y reglas de bonos),
      // pero desde julio 2026 el dinero y la operación viven en esta línea.
      if (prod.isSwap === true && fechaVentaDate >= SWAP_LINE_FROM) {
        salesToInsert.push({
          sheet: 'OP',
          vendedor: data.vendedor,
          fecha: fechaStr,
          codigo: data.codigo || '',
          producto: 'Swap',
          nombreCliente: data.nombreCliente,
          nif: data.nif.toUpperCase(),
          potencial: prod.noCliente || '',
          telf: prod.telf || '',
          pendiente: prod.pendiente || 'No',
          anulado: 'No',
          anotaciones: `Swap de ${prod.producto}`,
          telefonoFijo: data.telefonoFijo || '',
          telefonoMovil: data.telefonoMovil || '',
          boletin: '',
          grupo: '-',
          cuota: swapPrice,
          detalle: 'Varios',
          imei: prod.imei || null,
          numeroPedido: null,
          origenStock: null,
          rentConCoste: null,
          seguro: null,
          seguroImporte: null,
          isLibre: false,
          isSwap: false,
          periodId: anchorWp?.id || null
        })
      }

      // ── EL EXTRA DEL TRASLADO (29-ago-2026) ────────────────────────────
      // Telefónica paga cada traslado ATF con BAF a ×2,0 sobre PVP MÁS un
      // extra de 10 € («Extra de Traslados ATF con BAF», OFE NC143M). Nadie
      // lo registraba. Igual que el extra del Swap, va en «Varios» y enlazado
      // a su traslado: anular uno se lleva al otro.
      if (String(prod.categoria || '') === 'Traslado miMovistar') {
        salesToInsert.push({
          sheet: 'Varios',
          vendedor: data.vendedor,
          fecha: fechaStr,
          codigo: data.codigo || '',
          producto: 'Extra Traslado ATF con BAF',
          nombreCliente: data.nombreCliente,
          nif: data.nif.toUpperCase(),
          potencial: prod.noCliente || '',
          telf: prod.telf || '',
          pendiente: prod.pendiente || 'No',
          anulado: 'No',
          anotaciones: 'Extra del traslado ATF con BAF (lo crea el programa)',
          sustituyeA: idMadre,
          telefonoFijo: data.telefonoFijo || '',
          telefonoMovil: data.telefonoMovil || '',
          boletin: '',
          grupo: '-',
          cuota: 10,
          detalle: 'Varios',
          imei: null,
          numeroPedido: prod.numeroPedido || null,
          origenStock: null,
          rentConCoste: null,
          seguro: null,
          seguroImporte: null,
          isLibre: false,
          isSwap: false,
          periodId: anchorWp?.id || null
        })
      }

      // ── EL EXTRA DEL REPO DE FÚTBOL (ago-2026) ─────────────────────────
      // Telefónica paga DOS conceptos por el mismo cliente: el repo
      // («Futbol Total PROMO Repo Up Destino Fútbol», 78 €) y un extra de 10 €.
      // El comercial teclea SOLO el repo; el extra lo crea el programa, igual
      // que la línea hermana del Swap. Va en la palanca «Repo Fútbol» y no en
      // «Repos (Arpu)» a propósito: así los 10 € no engordan la base del % de
      // Repos y esta línea es la que cuenta como UNA unidad de esa regla.
      if (String(prod.categoria || '') === REPOS_PALANCA
          && (esRepoFutbol(prod.producto) || esRepoChampLiga(prod.producto))) {
        // El PRODUCTO de la hija dice el destino: para LaLiga/Champions se llama
        // distinto A PROPÓSITO — así el contador del Territorial cuenta la MADRE
        // (una unidad por cliente) y la palanca «Repo Fútbol» de las comisiones
        // de los comerciales sigue contando solo los de Fútbol Total, hasta que
        // el dueño decida si estos también puntúan ahí.
        const productoExtra = esRepoFutbol(prod.producto) ? EXTRA_FUTBOL_PRODUCTO
          : (String(prod.producto || '').toLowerCase().includes('champion')
              ? 'Repo Up Destino Champions' : 'Repo Up Destino LaLiga')
        salesToInsert.push({
          sheet: EXTRA_FUTBOL_PALANCA,
          vendedor: data.vendedor,
          fecha: fechaStr,
          codigo: data.codigo || '',
          producto: productoExtra,
          nombreCliente: data.nombreCliente,
          nif: data.nif.toUpperCase(),
          potencial: prod.noCliente || '',
          telf: prod.telf || '',
          pendiente: prod.pendiente || 'No',
          anulado: 'No',
          anotaciones: 'Extra del repo de fútbol/LaLiga/Champions (lo crea el programa)',
          // Enlazada a su repo de 78 €: un cliente es UNA operacion, asi que
          // anular cualquiera de las dos se lleva la otra (cascada del PATCH de
          // /api/sales). Sin esto, al caerse el repo el extra seguia cobrandose.
          sustituyeA: idMadre,
          telefonoFijo: data.telefonoFijo || '',
          telefonoMovil: data.telefonoMovil || '',
          boletin: '',
          grupo: '-',
          cuota: precioExtraFutbol,
          detalle: EXTRA_FUTBOL_PALANCA,
          imei: prod.imei || null,
          numeroPedido: prod.numeroPedido || null,
          origenStock: null,
          rentConCoste: null,
          seguro: null,
          seguroImporte: null,
          isLibre: false,
          isSwap: false,
          periodId: anchorWp?.id || null
        })
      }

      // Queue stock decrement if it is Rent
      // CANDADO: el envío logístico NO descuenta stock de tienda.
      if (prod.categoria === 'Rent' && data.codigo && prod.origenStock !== 'LOGISTICO') {
        const storeField = getStoreField(data.codigo)
        if (storeField) {
          stockDecrements.push({
            producto: prod.producto,
            storeField
          })
        }
      }
    }

    if (salesToInsert.length > 0) {
      await prisma.sale.createMany({
        data: salesToInsert
      })

      // Execute stock decrements
      if (stockDecrements.length > 0) {
        const stockItems = await prisma.stockItem.findMany({
          where: { tabCategory: 'Rent' }
        })
        for (const dec of stockDecrements) {
          const matchedItem = findMatchingStockItem(dec.producto, stockItems, dec.storeField)
          if (matchedItem) {
            await prisma.stockItem.update({
              where: { id: matchedItem.id },
              data: {
                [dec.storeField]: {
                  decrement: 1
                }
              }
            })
            console.log(`Decremented stock for Rent product: "${matchedItem.producto}" in store field "${dec.storeField}"`)
          } else {
            console.log(`No match in StockItem found to decrement stock for: "${dec.producto}"`)
          }
        }
      }

      // Disparador Reactivo: Calcular Reglas Extra para el Mes de las ventas importadas
      if (anchorWp?.id) {
        // Recalcular extras del mes al que pertenece la venta (puede ser el anterior)
        await runExtrasEngine(anchorWp.id).catch(console.error)
      }
    }
    
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in Unified Sales API:', error)
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

// --- HELPER FUNCTIONS FOR STOCK MATCHING ---
const NOISE_WORDS = new Set(['rent', 'rnt', 'reac', 'reac.a', 'reac.b', 'reac.c', 'certif', 'apple', 'con', 'de', 'el', 'la', 'a', 'b', 'c', 'gb', 'tb']);
const MODEL_MODIFIERS = ['pro', 'max', 'mini', 'plus', 'se'];

function getKeywords(name: string): string[] {
  return name.toLowerCase()
    .replace(/(\d+)(gb|tb)/gi, '$1 $2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w: string) => w.length > 0)
    .filter((w: string) => !NOISE_WORDS.has(w));
}

function findMatchingStockItem(prodName: string, stockItems: any[], storeField: string): any {
  const name = prodName.trim().toLowerCase();
  
  // 1. Exact match first
  let best = stockItems.find((s: any) => s.producto.trim().toLowerCase() === name);
  if (best) return best;

  // 2. Keyword match
  const keywords = getKeywords(name);
  if (keywords.length === 0) return null;

  const matches = stockItems.filter((s: any) => {
    const sTokens = s.producto.toLowerCase()
      .replace(/(\d+)(gb|tb)/gi, '$1 $2')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 0);
    
    // All input keywords must be in stock item tokens
    const allKeywordsMatch = keywords.every((kw: string) => sTokens.includes(kw));
    if (!allKeywordsMatch) return false;

    // Check modifiers: if stock item has a modifier, it must be in keywords
    const sModifiers = MODEL_MODIFIERS.filter((mod: string) => sTokens.includes(mod));
    const modifierMismatch = sModifiers.some((mod: string) => !keywords.includes(mod));
    if (modifierMismatch) return false;

    return true;
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    if (storeField) {
      const preferred = matches.find((m: any) => m[storeField] > 0);
      return preferred || matches[0];
    }
    return matches[0];
  }

  return null;
}

function getStoreField(storeName: string): string {
  if (storeName === 'Auxiliadora 45') return 'udsAuxiliadora';
  if (storeName === 'Correhuela') return 'udsCorrehuela';
  if (storeName === 'Villamayor') return 'udsVillamayor';
  if (storeName === 'Béjar') return 'udsBejar';
  if (storeName === 'O2') return 'udsMovilfree';
  return '';
}

