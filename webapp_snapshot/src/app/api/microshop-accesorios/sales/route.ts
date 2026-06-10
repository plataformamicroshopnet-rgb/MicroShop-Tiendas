import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to map store keys to Caja table stores
function mapStoreToCajaTienda(store: string): string {
  if (store.startsWith('Auxiliadora')) return 'Auxiliadora'
  if (store.startsWith('Correhuela')) return 'Correhuela'
  if (store.startsWith('Villamayor')) return 'Villamayor'
  if (store.startsWith('Béjar') || store.startsWith('Bejar')) return 'Béjar'
  if (store === 'O2') return 'MovilFree'
  return store
}

export async function GET() {
  try {
    const items = await prisma.microShopSale.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(items)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const listaProductosStr = JSON.stringify(data.listaProductos)
    const totalAmount = Number(data.importeTotal)
    const tipoDocumento = data.tipoDocumento || 'ticket'
    
    let newInvoiceNumber: number | null = null
    let facturaSerie: string | null = null

    if (tipoDocumento === 'factura') {
      let prefix = 'GEN/'
      const storeName = data.tienda || ''
      if (storeName.startsWith('Auxiliadora')) prefix = 'AUX/'
      else if (storeName.startsWith('Villamayor')) prefix = 'VIL/'
      else if (storeName.startsWith('Correhuela')) prefix = 'COR/'
      else if (storeName.startsWith('Béjar') || storeName.startsWith('Bejar')) prefix = 'BEJ/'

      // Find last sale with this prefix to get next number
      const lastFactura = await prisma.microShopSale.findFirst({
        where: {
          facturaSerie: {
            startsWith: prefix
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      let nextNumber = 1
      if (lastFactura && lastFactura.facturaSerie) {
        const parts = lastFactura.facturaSerie.split('/')
        const lastNum = parseInt(parts[1], 10)
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1
        }
      }
      facturaSerie = `${prefix}${nextNumber}`
    } else {
      // Ticket path
      const lastSale = await prisma.microShopSale.findFirst({
        where: { numeroFactura: { not: null } },
        orderBy: { numeroFactura: 'desc' }
      })
      newInvoiceNumber = lastSale && lastSale.numeroFactura ? lastSale.numeroFactura + 1 : 51000
    }

    // Create the accessory sale record
    const sale = await prisma.microShopSale.create({
      data: {
        vendedor: data.vendedor,
        tienda: data.tienda,
        nifCliente: data.nifCliente,
        nombreCliente: data.nombreCliente,
        listaProductos: listaProductosStr,
        importeTotal: totalAmount,
        estado: 'COMPLETADA',
        metodoPago: data.metodoPago || 'Efectivo',
        numeroFactura: newInvoiceNumber,
        tipoDocumento,
        facturaSerie
      }
    })

    // Decrement stock for each product in the specified store
    for (const prod of data.listaProductos) {
      if (prod.id) {
        const isMovilFree = await prisma.movilFreeProduct.findUnique({ where: { id: prod.id } })
        if (isMovilFree) {
          await prisma.movilFreeStock.update({
            where: {
              productId_tienda: {
                productId: prod.id,
                tienda: data.tienda
              }
            },
            data: {
              cantidad: { decrement: Number(prod.cantidad) }
            }
          }).catch(e => console.error("Error decrementing MovilFree stock in MicroShop sale:", e))
        } else {
          await prisma.microShopStock.update({
            where: {
              productId_tienda: {
                productId: prod.id,
                tienda: data.tienda
              }
            },
            data: {
              cantidad: { decrement: Number(prod.cantidad) }
            }
          }).catch(e => console.error("Error decrementing stock:", e))
        }
      }
    }

    // Update client total spent (MovilFreeClient table is shared)
    if (data.nifCliente && data.nifCliente !== 'CONTADO') {
      await prisma.movilFreeClient.update({
        where: { nif: data.nifCliente },
        data: {
          totalComprado: { increment: totalAmount }
        }
      }).catch(e => console.error("Error updating client total:", e))
    }

    // Integrate with Caja Entry automatically
    const cajaTienda = mapStoreToCajaTienda(data.tienda)
    const todayStr = new Date().toISOString().split('T')[0]
    const productDetails = data.listaProductos.map((p: any) => `${p.cantidad}x ${p.nombre}`).join(', ')
    
    const docIdentifier = tipoDocumento === 'factura' ? facturaSerie : `#${newInvoiceNumber}`
    
    if (data.metodoPago === 'Tarjeta') {
      // Card Sale: concept '(+) Tarjeta MovilFree', amount = 0, detail shows actual charge
      await prisma.cajaEntry.create({
        data: {
          tienda: cajaTienda,
          fecha: todayStr,
          concepto: '(+) Tarjeta MovilFree',
          detalle: `Venta accesorios Tarjeta - ${productDetails} [Importe: ${totalAmount.toFixed(2)}€] (Doc: ${docIdentifier})`,
          importe: 0,
          vendedor: data.vendedor || 'Sistema'
        }
      }).catch(e => console.error("Error creating card Caja entry:", e))
    } else {
      // Cash Sale: concept '(+) Facturación Microshop', amount = totalAmount, detail shows details
      await prisma.cajaEntry.create({
        data: {
          tienda: cajaTienda,
          fecha: todayStr,
          concepto: '(+) Facturación Microshop',
          detalle: `Venta accesorios Efectivo - ${productDetails} (Doc: ${docIdentifier})`,
          importe: totalAmount,
          vendedor: data.vendedor || 'Sistema'
        }
      }).catch(e => console.error("Error creating cash Caja entry:", e))
    }

    return NextResponse.json(sale)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
