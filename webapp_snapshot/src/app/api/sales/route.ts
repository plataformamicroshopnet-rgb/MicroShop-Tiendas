export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { mesYaPagadoN3, fechaPagoN3 } from '@/lib/nominaN3'
import { ROLES } from '@/lib/appConfig'
import { can, canEdit, canView } from '@/lib/permissions'
import { findCatalogVigente, esRepoArpuManual } from '@/lib/salesUtils'
import { runExtrasEngine } from '@/lib/extrasEngine'
const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }
    const { user } = session

    
    const dbUser = await prisma.user.findUnique({
      where: { username: session.user.username },
      select: { role: true, permissions: true }
    });
    const safeUser = { ...session.user, role: dbUser?.role || session.user.role, permissions: dbUser?.permissions || session.user.permissions };
      if (dbUser) {
      session.user.role = dbUser.role;
      session.user.permissions = dbUser.permissions;
    }

    const { searchParams } = new URL(request.url)
    const periodKey = searchParams.get('periodKey')
    const dashboardParam = searchParams.get('dashboard') === 'true'

    const hasJefeTiendas = canView(safeUser, 'MODULE_JEFE_TIENDAS');
    const hasLiquidaciones = canView(safeUser, 'MODULE_LIQUIDACION');
    const hasCristina = canView(safeUser, 'MODULE_CRISTINA');
    
    const canSeeAllSales = safeUser.role === ROLES.ADMIN || 
                           safeUser.role === ROLES.JEFE_VENTAS || 
                           hasJefeTiendas || 
                           hasLiquidaciones || 
                           hasCristina ||
                           dashboardParam;

    const baseWhereClause: any = canSeeAllSales
      ? {} 
      : { vendedor: { equals: safeUser.username || 'BLOCK_EMPTY_USER' } }

    let temporalWhere = {}

    if (periodKey) {
      const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } })
      if (wp) {
        // Híbrido: Si tiene el periodId relacional, o si no lo tiene (historico), hacemos match de string
        const targetMonthStr = String(wp.month).padStart(2, '0')
        const targetYearStr = String(wp.year)
        temporalWhere = {
          OR: [
            { periodId: wp.id },
            { fecha: { contains: `/${targetMonthStr}/${targetYearStr}` } }
          ]
        }
      } else {
        // Fallback: Si no existe el WorkPeriod, buscamos por formato de fecha parseando periodKey (ej. 2026_06)
        const parts = periodKey.split('_')
        if (parts.length === 2) {
          const targetYearStr = parts[0]
          const targetMonthStr = parts[1]
          temporalWhere = {
            fecha: { contains: `/${targetMonthStr}/${targetYearStr}` }
          }
        } else {
          return NextResponse.json({ success: true, stats: [], logs: [] })
        }
      }
    }

    const finalWhere = { ...baseWhereClause, ...temporalWhere }

    let sales = await prisma.sale.findMany({
      where: finalWhere,
      orderBy: { createdAt: 'desc' },
    })
    
    // Enrich Seguro sales that have no seguroImporte by looking up ProductCatalog
    const seguroSales = sales.filter(s => 
      (String(s.detalle || '').toLowerCase() === 'seguro' || String(s.sheet || '').toLowerCase() === 'seguro') && 
      (!s.seguroImporte || s.seguroImporte === 0)
    );
    if (seguroSales.length > 0 && periodKey) {
      const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } });
      if (wp) {
        const seguroCatalog = await prisma.productCatalog.findMany({
          where: { periodId: wp.id, categoria: 'Seguro' }
        });
        sales = sales.map(s => {
          if ((String(s.detalle || '').toLowerCase() === 'seguro' || String(s.sheet || '').toLowerCase() === 'seguro') && (!s.seguroImporte || s.seguroImporte === 0)) {
            // Vigencias: la prima que se rellena es la de la fila que cubre la fecha de la venta
            // (antes se indexaba solo por producto y con dos vigencias ganaba la última fila).
            const found = findCatalogVigente(seguroCatalog, String(s.producto || ''), s.fecha);
            const cuotaFromCatalog = found && found.anual ? (parseFloat(String(found.anual).replace(',', '.')) || 0) : 0;
            if (cuotaFromCatalog && cuotaFromCatalog > 0) {
              return { ...s, seguroImporte: cuotaFromCatalog };
            }
          }
          return s;
        });
      }
    }
    
    // Fallback: Filtrado en memoria estricto sobre el nombre (por si acaso el query no filtró bien)
    if (!canSeeAllSales) {
      const normName = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (user.username) {
        sales = sales.filter(s => normName(s.vendedor || '') === normName(user.username));
      }
    }

    const logs = sales.map(sale => {
      // Create a timestamp to maintain exact UI backwards compatibility
      let timestamp = sale.createdAt.getTime()
      if (sale.fecha) {
        const parts = sale.fecha.split('/')
        if (parts.length === 3) {
          timestamp = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime()
        }
      }

      return {
        id: sale.id, // Now a UUID
        periodId: sale.periodId,
        sheet: sale.sheet,
        timestamp,
        email: user.username + '@microshop.com',
        vendedor: sale.vendedor,
        fecha: sale.fecha,
        codigo: sale.codigo || '',
        producto: sale.producto || '',
        nombreCliente: sale.nombreCliente || '',
        nif: sale.nif || '',
        potencial: sale.potencial || '',
        telf: sale.telf || '',
        activado: '',
        pendiente: sale.pendiente || '',
        anulado: sale.anulado || '',
        anotaciones: sale.anotaciones || '',
        grupo: sale.grupo || '',
        arpu: '',
        importe: sale.cuota !== null ? sale.cuota.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
        cuota: sale.cuota ?? 0,
        detalle: sale.detalle || '',
        rentConCoste: sale.rentConCoste || 'No',
        seguro: sale.seguro || '',
        seguroImporte: (sale as any).seguroImporte ?? null,
        boletin: sale.boletin || '',
        telefonoFijo: sale.telefonoFijo || '',
        telefonoMovil: sale.telefonoMovil || '',
        imei: sale.imei || '',
        numeroPedido: (sale as any).numeroPedido || '',
        origenStock: (sale as any).origenStock || '',
        // Marcas de la correccion de los Repos. Sin ellas el navegador no puede
        // saber que una venta ya esta sustituida por otra y la operacion se
        // cuenta DOS VECES en todo lo que suma dinero.
        sustituida: (sale as any).sustituida === true,
        sustituyeA: (sale as any).sustituyeA || '',
        isSwap: (sale as any).isSwap === true,
        isLibre: (sale as any).isLibre === true,
        motivoModificacion: ''
      }
    })

    // Sort by timestamp desc to mirror old behavior explicitly
    logs.sort((a, b) => b.timestamp - a.timestamp)

    const response = NextResponse.json({ success: true, stats: [], logs })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response

  } catch (error) {
    console.error('Error fetching sales API via Prisma:', error)
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession()
    if (!session || !(canEdit(session.user, 'MODULE_TIENDAS') || can(session.user, 'EDIT_SALES') || can(session.user, 'MODULE_CRISTINA') || can(session.user, 'MODULE_BACK_OFFICE'))) {
       return NextResponse.json({ success: false, error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }
    const { id, updates } = await request.json()
    if (!id || !updates) return NextResponse.json({ success: false, error: 'Faltan datos' })

    const existingSale = await prisma.sale.findUnique({ where: { id } })
    if (!existingSale) return NextResponse.json({ success: false, error: 'Operación no existe' })

    // ── MARCHA ATRÁS PARA MODIFICAR: los CUATRO meses sin pagar (30-ago-2026) ──
    // La ventana de negocio es la regla N+3: el mes M se paga el 1 de M+4, así
    // que en todo momento hay exactamente CUATRO meses vivos (hoy: mayo-agosto).
    // Antes aquí había un tope plano de 120 días que (a) recortaba los primeros
    // días del cuarto mes y (b) NO cerraba un mes ya pagado si aún caía dentro
    // de los 120 días — se podía editar una venta cuya nómina ya estaba abonada
    // y descuadrar Tiendas contra el abonaré. Ahora:
    //  · Mes con nómina PAGADA: inmutable PARA TODOS, admin incluido (el mismo
    //    candado que ya tenía el alta de ventas en /api/sales/unified).
    //  · Mes sin pagar: editable por quien tenga permiso de edición. Si un
    //    usuario tiene un retroDiasModificar EXPLÍCITO en Gestión de Usuarios,
    //    se respeta como límite MÁS corto (para acotar a alguien a propósito).
    {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
      const parseFecha = (f: any) => {
        const p = String(f || '').split('/')
        if (p.length !== 3) return null
        const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]))
        return isNaN(d.getTime()) ? null : d
      }
      const bloqueaPagado = (d: Date | null, que: string) => {
        if (d && mesYaPagadoN3(d, hoy)) {
          const pago = fechaPagoN3(d)
          return NextResponse.json({ success: false, error: `${que}: la nómina de ese mes ya se pagó (regla N+3, el 1 de ${pago.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}) y es inmutable. Si de verdad hay que tocarla, coméntalo con el administrador.` }, { status: 403 })
        }
        return null
      }
      const fechaActual = parseFecha(existingSale.fecha)
      const noPagada = bloqueaPagado(fechaActual, 'No se puede modificar esta operación')
      if (noPagada) return noPagada
      if (updates.fecha !== undefined && updates.fecha) {
        const fechaNueva = parseFecha(updates.fecha)
        if (fechaNueva && fechaNueva > hoy) {
          return NextResponse.json({ success: false, error: 'La fecha no puede ser futura.' }, { status: 400 })
        }
        const noPagadaDestino = bloqueaPagado(fechaNueva, 'No se puede mover la operación a ese mes')
        if (noPagadaDestino) return noPagadaDestino
      }
      // Límite explícito por usuario (opcional, siempre más corto que los 4 meses)
      const dbUserEdit = await prisma.user.findUnique({ where: { username: session.user.username || '' } })
      const margenExplicito = (dbUserEdit as any)?.retroDiasModificar
      if ((dbUserEdit?.role || session.user.role) !== 'ADMIN' && margenExplicito !== null && margenExplicito !== undefined) {
        const limite = new Date(hoy); limite.setDate(limite.getDate() - Number(margenExplicito))
        if (fechaActual && fechaActual < limite) {
          return NextResponse.json({ success: false, error: `No puedes modificar operaciones de hace más de ${margenExplicito} días. Pide a un administrador que amplíe tu marcha atrás en Gestión de Usuarios.` }, { status: 403 })
        }
        if (updates.fecha !== undefined && updates.fecha) {
          const fechaNueva = parseFecha(updates.fecha)
          if (fechaNueva && fechaNueva < limite) {
            return NextResponse.json({ success: false, error: `No puedes mover una operación a hace más de ${margenExplicito} días.` }, { status: 403 })
          }
        }
      }
    }

    const updateData: any = {}
    if (updates.vendedor !== undefined) updateData.vendedor = updates.vendedor
    
    if (updates.fecha !== undefined) {
      updateData.fecha = updates.fecha
      
      // AUTO-ASIGNACIÓN DE PERIODO
      // Si cambia la fecha, extraemos mes y año para re-vincular el periodId
      // Esto evita que la venta siga apareciendo inamovible anclada al mes antiguo.
      if (updates.fecha) {
        const parts = updates.fecha.split('/');
        if (parts.length === 3) {
          const nMonth = parseInt(parts[1], 10);
          const nYear = parseInt(parts[2], 10);
          
          const matchingWp = await prisma.workPeriod.findFirst({
            where: { month: nMonth, year: nYear }
          });
          
          if (matchingWp) {
            updateData.periodId = matchingWp.id;
          } else {
            // Si movemos a un mes que aún no tiene WorkPeriod en BD, soltamos el ancla
            // para que no contamine el mes viejo. Se encontrará vía substring '/MM/YYYY'
            updateData.periodId = null;
          }
        }
      }
    }
    
    if (updates.codigo !== undefined) updateData.codigo = updates.codigo
    if (updates.producto !== undefined) updateData.producto = updates.producto
    if (updates.nombreCliente !== undefined) updateData.nombreCliente = updates.nombreCliente
    if (updates.nif !== undefined) updateData.nif = String(updates.nif).toUpperCase()
    if (updates.potencial !== undefined) updateData.potencial = updates.potencial
    if (updates.telf !== undefined) updateData.telf = updates.telf
    if (updates.pendiente !== undefined) updateData.pendiente = updates.pendiente
    if (updates.anulado !== undefined) updateData.anulado = updates.anulado
    if (updates.anotaciones !== undefined) updateData.anotaciones = updates.anotaciones
    if (updates.detalle !== undefined) updateData.detalle = updates.detalle
    if (updates.numeroPedido !== undefined) updateData.numeroPedido = updates.numeroPedido || null
    if (updates.boletin !== undefined) updateData.boletin = updates.boletin || ''
    if (updates.origenStock !== undefined) updateData.origenStock = updates.origenStock || null
    if (updates.imei !== undefined) updateData.imei = updates.imei || null
    if (updates.importe !== undefined) {
       updateData.cuota = updates.importe ? parseFloat(String(updates.importe).replace(',', '.')) : null
    }
    if (updates.seguro !== undefined) updateData.seguro = updates.seguro
    if (updates.seguroImporte !== undefined) {
       updateData.seguroImporte = updates.seguroImporte ? parseFloat(String(updates.seguroImporte).replace(',', '.')) : null
    }
    if (updates.isLibre !== undefined) updateData.isLibre = updates.isLibre === true
    if (updates.isSwap !== undefined) updateData.isSwap = updates.isSwap === true

    // -------------------------------------------------------------------------------------------------
    // RECALCULO DE PARÁMETROS DERIVADOS (CUOTA Y GRUPO) FRENTE A CAMBIOS ESTRUCTURALES
    // -------------------------------------------------------------------------------------------------
    const dateChanged = updates.fecha !== undefined && updates.fecha !== existingSale.fecha;
    const prodChanged = updates.producto !== undefined && String(updates.producto).trim() !== String(existingSale.producto).trim();
    
    // Solo forzamos recalcular si el usuario ha tocado fecha o producto explícitamente.
    // (Omitimos recalcular si el usuario modificó manualmente SOLO la 'cuota' sin tocar nada más).
    if (dateChanged || prodChanged) {
       const effectiveFecha = updates.fecha !== undefined ? updates.fecha : existingSale.fecha;
       const effectiveProducto = updates.producto !== undefined ? String(updates.producto).trim() : String(existingSale.producto).trim();
       const effectivePeriodId = updateData.periodId !== undefined ? updateData.periodId : existingSale.periodId;

       if (effectivePeriodId && effectiveProducto) {
          // La palanca de la venta ACOTA la búsqueda. Sin esto, un producto que
          // existe en dos palancas a la vez —«Movistar+», «Champions» y «Disney +
          // sin anuncios» están en «Suscripciones TV» y en «Repos (Arpu)»— podía
          // engancharse a la fila equivocada y traer el precio de la otra.
          const palancaVenta = String(existingSale.detalle || existingSale.sheet || '').trim();
          // PISTAS DEL DESPLEGABLE (26-ago-2026): en miMovistar el MISMO nombre de
          // producto vive en varias gamas y promociones («Movistar Plus + Fútbol +
          // Netflix Estándar» está en PROMO DIGI Max a 51 € y en PROMO VODAFONE MAX
          // a 71 €). La venta no guarda gama ni subcategoría, así que la pantalla
          // manda cuál eligió el usuario para que aquí se coja la fila BUENA. No se
          // guardan en la venta: solo mandan sobre el precio.
          const pistaSub = updates.catalogoSubcategoria !== undefined
            ? String(updates.catalogoSubcategoria || '').trim() : ''
          const pistaGama = updates.catalogoGama !== undefined
            ? String(updates.catalogoGama || '').trim() : ''
          const matchingCatalogs = await prisma.productCatalog.findMany({
             where: {
                 periodId: effectivePeriodId,
                 producto: { equals: effectiveProducto }, // Exact match for base price
                 ...(palancaVenta ? { categoria: palancaVenta } : {}),
                 ...(pistaSub ? { subcategoria: pistaSub } : {}),
                 ...(pistaGama ? { gama: pistaGama } : {}),
             }
          });

          if (matchingCatalogs.length > 0) {
             // Vigencias unificadas: la fila que cubre la fecha efectiva de la venta, o la primera.
             const targetCatalog = findCatalogVigente(matchingCatalogs, effectiveProducto, effectiveFecha) || matchingCatalogs[0];

             // ── DE DÓNDE SALE EL IMPORTE, SEGÚN LA PALANCA ────────────────────
             // Solo Rent y Seguros guardan la cuota en `anual`. Las demás la
             // guardan en `comision` (algunas con multiplicador). Aquí se leía
             // SIEMPRE `anual` y, si venía vacío, se escribía NULL: tocar la fecha
             // de una LaLiga de 36 € la dejaba a 0 € — y encima machacaba el
             // importe que la persona acabara de teclear a mano.
             const num = (v: any) => {
               const n = parseFloat(String(v ?? '').replace(',', '.'))
               return isNaN(n) ? null : n
             }
             const pal = palancaVenta.toLowerCase()
             // Los repos de «incremento de ARPU» no tienen precio de tarifa: su
             // importe sale de Fact. Nueva − Fact. Anterior por el % del catálogo,
             // que se teclea en Nueva Venta. Aquí NO se toca, o al corregir una
             // errata de fecha se les pondría el precio de una suscripción.
             // El repo de ARPU con importe a mano tampoco tiene precio de tarifa
             // (su fila del catálogo va a 0 €): sin esta guarda, tocar la fecha
             // de la venta la dejaría a 0 € — que es justo el fallo que ya nos
             // pasó una vez con las demás palancas.
             const esIncrementoArpu = String(effectiveProducto).toLowerCase()
               .normalize('NFD').replace(/[̀-ͯ]/g, '').includes('incremento de arpu')
               || esRepoArpuManual(effectiveProducto)
             // miMovistar / Resto BAF / Traslado: MISMA cuenta que el alta
             // (nueva-venta/page.tsx) — comisión × multiplicador, con el
             // multiplicador a 0 valiendo 1. Sin esta rama, cambiar el producto de
             // una miMovistar dejaba la cuota VIEJA: el nombre cambiaba y el dinero
             // no, que es justo lo que pasó con las PROMO VODAFONE/DIGI.
             // OJO: solo al cambiar el PRODUCTO. Si solo se corrige la fecha, la
             // cuota de una miMovistar se queda como está (es lo que hacía hasta
             // hoy): tocar una fecha no puede mover el dinero de una venta.
             const esBaf = prodChanged && (pal === 'mimovistar' || pal === 'resto baf' || pal === 'traslado mimovistar')
             const multiplica = !esIncrementoArpu && (pal === 'suscripciones tv' || pal === 'repos up')
             const planas = ['o2', 'seguro', 'prepago', 'varios', 'accesorios']
             let nuevoPrecio: number | null = null
             if (esBaf) {
               const base = num(targetCatalog.comision)
               const mult = num((targetCatalog as any).comisionConCoste)
               if (base !== null) nuevoPrecio = base * (mult && mult > 0 ? mult : 1)
             } else if (targetCatalog.anual) {
               nuevoPrecio = num(targetCatalog.anual)
             } else if (multiplica) {
               const base = num(targetCatalog.comision)
               const mult = num((targetCatalog as any).comisionConCoste)
               if (base !== null) nuevoPrecio = base * (mult && mult > 0 ? mult : 1)
             } else if (planas.includes(pal)) {
               nuevoPrecio = num(targetCatalog.comision)
             }
             // Si no se sabe de dónde sacar el precio, se deja el que ya tenía.
             // Nunca se escribe null: una venta sin importe no se ve venir.
             if (nuevoPrecio !== null) updateData.cuota = nuevoPrecio;
             // EL GRUPO, COMO EN EL ALTA. Aquí se escribía el nombre de la palanca
             // ('miMovistar'), cuando el alta escribe su GRUPO ('BAF'): cambiar el
             // producto de una venta la dejaba con un grupo que no existe en ninguna
             // otra. Mismo mapeo que resolveGrupo de api/sales/unified.
             if (targetCatalog.categoria) {
                 const c = String(targetCatalog.categoria)
                 const GRUPO: Record<string, string> = {
                   'Ti': 'TI', 'Contratos Móvil': 'TI', 'TMA': 'TMA', 'Micro': 'MIC', 'MIC': 'MIC',
                   'miMovistar': 'BAF', 'Resto BAF': 'BAF', 'Traslado miMovistar': 'BAF',
                   'Rent': 'REN', 'Seguro': 'REN', 'O2': 'ALTA', 'Accesorios': 'ACC',
                 }
                 updateData.grupo = GRUPO[c] || existingSale.grupo || c;
             }
          }
       }
    }

    await prisma.sale.update({
      where: { id },
      data: updateData
    })

    // ── ANULADO EN CADENA (ago-2026) ─────────────────────────────────────
    // Las correcciones contables de los Repos van pegadas a su venta original:
    // la hija lleva el importe bueno y la madre queda marcada como sustituida.
    // Quien tramita ve UNA operación y anula UNA; el programa se lleva a la
    // familia entera, en las dos direcciones. Sin esto, anular la que se ve
    // dejaría viva a la otra y el mes quedaría cobrando de más.
    if (updates.anulado !== undefined || updates.pendiente !== undefined) {
      try {
        const familia = new Set<string>()
        // Si se ha tocado la HIJA, la madre también cae.
        if (existingSale.sustituyeA) familia.add(existingSale.sustituyeA)
        // Y todas las hijas de esta venta (y de su madre, si es una hija).
        const raices = [id, ...(existingSale.sustituyeA ? [existingSale.sustituyeA] : [])]
        const hijas = await prisma.sale.findMany({
          where: { sustituyeA: { in: raices } }, select: { id: true }
        })
        hijas.forEach(h => familia.add(h.id))
        familia.delete(id)
        if (familia.size > 0) {
          const eco: any = {}
          if (updates.anulado !== undefined) eco.anulado = updates.anulado
          if (updates.pendiente !== undefined) eco.pendiente = updates.pendiente
          await prisma.sale.updateMany({ where: { id: { in: [...familia] } }, data: eco })
          console.log(`[Sustitución] ${familia.size} operación(es) hermanas actualizadas con ${id}`)
        }
      } catch (e) {
        console.error('[Sustitución] no se pudo propagar el estado:', e)
      }
    }

    // ── Swap como venta real: al ANULAR una venta con ¿Swap? (≥ julio 2026),
    // anular también su línea hermana "Swap" (Varios, mismo NIF/fecha/origen) ──
    const _seAnula = (updates.anulado !== undefined && String(updates.anulado).toLowerCase().startsWith('s'))
      || (updates.pendiente !== undefined && String(updates.pendiente) === 'Anulado')
    if (_seAnula && (existingSale as any).isSwap === true) {
      try {
        const _p = String(existingSale.fecha || '').split('/')
        const _esNuevo = _p.length === 3 && `${_p[2]}${_p[1].padStart(2, '0')}` >= '202607'
        if (_esNuevo) {
          await prisma.sale.updateMany({
            where: {
              nif: existingSale.nif,
              fecha: existingSale.fecha,
              producto: 'Swap',
              detalle: 'Varios',
              anotaciones: { contains: `Swap de ${existingSale.producto}` },
              anulado: { not: 'Si' }
            },
            data: { anulado: 'Si' }
          })
        }
      } catch (e) { console.error('No se pudo anular la línea Swap hermana:', e) }
    }

    // Disparador Reactivo: Reevaluar Reglas Extra si hubo cambios
    const runPeriodId = updateData.periodId !== undefined ? updateData.periodId : existingSale.periodId
    if (runPeriodId) {
      await runExtrasEngine(runPeriodId).catch(console.error)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in PATCH /api/sales:', error)
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession()
    if (!session || !(canEdit(session.user, 'MODULE_TIENDAS') || can(session.user, 'CANCEL_SALES') || can(session.user, 'MODULE_CRISTINA') || can(session.user, 'MODULE_BACK_OFFICE'))) {
       return NextResponse.json({ success: false, error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'Falta id' })

    const existingSale = await prisma.sale.findUnique({ where: { id }, select: { periodId: true } })

    await prisma.sale.delete({
      where: { id }
    })

    if (existingSale?.periodId) {
      await runExtrasEngine(existingSale.periodId).catch(console.error)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    if (error.code === 'P2025') {
       console.warn('DELETE /api/sales: Intento de borrar registro fantasma (P2025).')
       // Podríamos devolver success: true ya que el objetivo (que no esté) está cumplido, pero 
       // es mejor informar al front para que recargue.
       return NextResponse.json({ success: false, error: 'La operación no existe. Posiblemente ya fue eliminada o la vista está cacheada.' }, { status: 404 })
    }
    
    console.error('Error in DELETE /api/sales:', error)
    return NextResponse.json({ success: false, error: error.message || 'Error desconocido' }, { status: 500 })
  }
}
