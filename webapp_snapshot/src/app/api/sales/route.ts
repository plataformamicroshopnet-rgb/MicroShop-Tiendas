export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { ROLES } from '@/lib/appConfig'
import { can, canEdit, canView } from '@/lib/permissions'
import { isVentaWithinDates } from '@/lib/salesUtils'
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
        const catalogByProduct: Record<string, number> = {};
        for (const c of seguroCatalog) {
          if (c.producto && c.anual) {
            catalogByProduct[c.producto.toLowerCase().trim()] = parseFloat(String(c.anual).replace(',', '.')) || 0;
          }
        }
        sales = sales.map(s => {
          if ((String(s.detalle || '').toLowerCase() === 'seguro' || String(s.sheet || '').toLowerCase() === 'seguro') && (!s.seguroImporte || s.seguroImporte === 0)) {
            const cuotaFromCatalog = catalogByProduct[String(s.producto || '').toLowerCase().trim()];
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
          const matchingCatalogs = await prisma.productCatalog.findMany({
             where: { 
                 periodId: effectivePeriodId,
                 producto: { equals: effectiveProducto } // Exact match for base price
             }
          });

          if (matchingCatalogs.length > 0) {
             let targetCatalog = matchingCatalogs[0]; // fallback
             
             if (matchingCatalogs.length > 1) {
                 const properlyDated = matchingCatalogs.find((c: any) => isVentaWithinDates(effectiveFecha, c.validFrom, c.validTo));
                 if (properlyDated) targetCatalog = properlyDated;
             }

             // Aplicar los nuevos valores derivados encontrados en la fuente de la verdad
             const basePrice = targetCatalog.anual ? parseFloat(String(targetCatalog.anual).replace(',', '.')) : null;
             
             updateData.cuota = basePrice;
             // Si targetCatalog informa de una categoría (grupo), reescribimos el grupo también
             if (targetCatalog.categoria) {
                 updateData.grupo = targetCatalog.categoria;
             }
          }
       }
    }

    await prisma.sale.update({
      where: { id },
      data: updateData
    })

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
