import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import { PrismaClient } from '@prisma/client'
import { runExtrasEngine } from '@/lib/extrasEngine'

const prisma = new PrismaClient()

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

    const numValidProducts = data.productos.filter((p: any) => p.producto !== '').length
    if (numValidProducts === 0) return NextResponse.json({ success: false, error: 'Configura al menos un producto' }, { status: 400 })

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

    let activePeriod = null
    if (data.periodKey) {
      activePeriod = await prisma.workPeriod.findUnique({
        where: { period_key: data.periodKey }
      })
    }

    const salesToInsert = []
    const stockDecrements = []

    for (let x = 0; x < data.productos.length; x++) {
      const prod = data.productos[x]
      if (prod.producto === '') continue

      // Pad date for dd/mm/yyyy format based on today
      const now = new Date()
      const d = String(now.getDate()).padStart(2, '0')
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const y = now.getFullYear()
      const fechaStr = `${d}/${m}/${y}`

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
        rentConCoste: prod.rentConCoste || null,
        seguro: prod.seguro || null,
        seguroImporte: prod.seguroImporte ? parseFloat(prod.seguroImporte.toString().replace(',','.')) : null,
        isLibre: prod.isLibre === true,
        isSwap: prod.isSwap === true,
        periodId: activePeriod?.id || null
      })

      // Queue stock decrement if it is Rent
      if (prod.categoria === 'Rent' && data.codigo) {
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
      if (activePeriod?.id) {
        await runExtrasEngine(activePeriod.id).catch(console.error)
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

