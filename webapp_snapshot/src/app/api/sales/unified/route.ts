import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { PrismaClient } from '@prisma/client'
import { runExtrasEngine } from '@/lib/extrasEngine'

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
    if (!session || !canEdit(session.user, 'MODULE_TIENDAS')) {
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

    // En Rent es obligatorio indicar el origen del terminal: TIENDA descuenta
    // stock, LOGISTICO no (a veces se vende por envío aunque haya unidades).
    if (data.productos.some((p: any) => p.producto !== '' && p.categoria === 'Rent' && !['TIENDA', 'LOGISTICO'].includes(String(p.origenStock || '')))) {
      return NextResponse.json({ success: false, error: 'En los Rent debes seleccionar el Origen del terminal (stock de tienda o envío logístico).' }, { status: 400 })
    }

    // --- REGLA ANTI-FRAUDE TRASLADOS MISTAR + SUSCRIPCIONES TV ---
    const hasSuscripcionTV = data.productos.some((p: any) => p.categoria === 'Suscripciones TV' && p.producto !== '');
    
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
            if (p.categoria !== 'Suscripciones TV' || p.producto === '') return false;
            const imp = parseFloat(String(p.importe || '0').replace(',','.'));
            return !isNaN(imp) && imp > 0;
         });
         
         if (hasInvalidSuscripcion) {
            return NextResponse.json({ 
              success: false, 
              error: 'Antifraude: No se puede comisionar una Suscripción TV a este NIF porque ha realizado un Traslado miMovistar (hoy o en los próximos 20 días).' 
            }, { status: 400 });
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

    // ── AVISO DE POSIBLE DUPLICADO (mismo NIF + producto, ±7 días) ──────
    if (!data.confirmarDuplicado) {
      for (const prod of data.productos) {
        if (!prod.producto) continue
        const previas = await prisma.sale.findMany({
          where: { nif: data.nif.toUpperCase(), producto: prod.producto },
          select: { fecha: true, anulado: true, pendiente: true }
        })
        const hayDup = previas.some(p => {
          if (String(p.anulado || '').toLowerCase().startsWith('s') || String(p.pendiente || '') === 'Anulado') return false
          const partes = String(p.fecha || '').split('/')
          if (partes.length !== 3) return false
          const f = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]))
          return !isNaN(f.getTime()) && Math.abs(f.getTime() - fechaVentaDate.getTime()) <= 7 * 86400000
        })
        if (hayDup) {
          return NextResponse.json({
            success: false,
            duplicado: true,
            error: `Ya existe una venta de este NIF con el mismo producto (${prod.producto}) en los últimos 7 días — ¿seguro que no está repetida?`
          }, { status: 409 })
        }
      }
    }

    const salesToInsert = []
    const stockDecrements = []

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

      let finalAnotaciones = data.anotaciones || ''
      if (prod.motivoSinStock) {
        finalAnotaciones = finalAnotaciones 
          ? `${finalAnotaciones} | Motivo Sin Stock: ${prod.motivoSinStock}`
          : `Motivo Sin Stock: ${prod.motivoSinStock}`
      }

      salesToInsert.push({
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
        anotaciones: finalAnotaciones,
        telefonoFijo: data.telefonoFijo || '',
        telefonoMovil: data.telefonoMovil || '',
        boletin: data.boletin || '',
        grupo: calculatedGroup,
        // Para Seguros: cuota en BD = Cuota Total (seguroImporte), no la Comisión (importe)
        // Esto asegura que el Registro de Operaciones y todos los paneles lean el valor correcto.
        cuota: (prod.categoria === 'Seguro' && prod.seguroImporte && parseFloat(prod.seguroImporte.toString().replace(',','.')) > 0)
          ? parseFloat(prod.seguroImporte.toString().replace(',','.'))
          : (prod.importe ? parseFloat(prod.importe.toString().replace(',','.')) : null),
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

