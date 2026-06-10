import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

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
    const items = await prisma.movilFreeSale.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(items)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const listaProductosStr = JSON.stringify(data.listaProductos)
    const tienda = data.tienda || 'O2'
    const totalAmount = Number(data.importeTotal)
    const tipoDocumento = data.tipoDocumento || 'ticket'
    
    let newInvoiceNumber: number | null = null
    let facturaSerie: string | null = null

    if (tipoDocumento === 'factura') {
      const prefix = 'MOV'
      // Find last sale with this prefix to get next number
      const lastFactura = await prisma.movilFreeSale.findFirst({
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
        const lastNumStr = lastFactura.facturaSerie.substring(prefix.length)
        const lastNum = parseInt(lastNumStr, 10)
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1
        }
      }
      facturaSerie = `${prefix}${nextNumber}`
    } else {
      // Ticket path
      const lastSale = await prisma.movilFreeSale.findFirst({
        where: { numeroFactura: { not: null } },
        orderBy: { numeroFactura: 'desc' }
      })
      newInvoiceNumber = lastSale && lastSale.numeroFactura ? lastSale.numeroFactura + 1 : 31000
    }

    // Create the sale
    const item = await prisma.movilFreeSale.create({
      data: {
        vendedor: data.vendedor || 'Sistema',
        tienda: tienda,
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

    // Deduct stock for each product in the specified store
    for (const prod of data.listaProductos) {
      if (prod.id) {
        const isMicroShop = await prisma.microShopProduct.findUnique({ where: { id: prod.id } })
        if (isMicroShop) {
          await prisma.microShopStock.upsert({
            where: {
              productId_tienda: {
                productId: prod.id,
                tienda: tienda
              }
            },
            update: { cantidad: { decrement: Number(prod.cantidad) } },
            create: { productId: prod.id, tienda: tienda, cantidad: -Number(prod.cantidad) }
          }).catch(e => console.error("Error deducting MicroShop stock in MovilFree sale:", e))
        } else {
          await prisma.movilFreeStock.upsert({
            where: {
              productId_tienda: {
                productId: prod.id,
                tienda: tienda
              }
            },
            update: { cantidad: { decrement: Number(prod.cantidad) } },
            create: { productId: prod.id, tienda: tienda, cantidad: -Number(prod.cantidad) }
          }).catch(e => console.error("Error deducting MovilFree stock in MovilFree sale:", e))
        }
      }
    }

    // Update client total
    if (data.nifCliente && data.nifCliente !== 'CONTADO') {
      await prisma.movilFreeClient.update({
        where: { nif: data.nifCliente },
        data: { totalComprado: { increment: totalAmount } }
      }).catch(e => console.error("Error updating client total:", e))
    }

    // Integrate with Caja Entry automatically
    const cajaTienda = mapStoreToCajaTienda(tienda)
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
          detalle: `Venta accesorios MovilFree Tarjeta - ${productDetails} [Importe: ${totalAmount.toFixed(2)}€] (Doc: ${docIdentifier})`,
          importe: 0,
          vendedor: data.vendedor || 'Sistema'
        }
      }).catch(e => console.error("Error creating card Caja entry:", e))
    } else {
      // Cash Sale: concept '(+) Facturación MovilFree', amount = totalAmount
      await prisma.cajaEntry.create({
        data: {
          tienda: cajaTienda,
          fecha: todayStr,
          concepto: '(+) Facturación MovilFree',
          detalle: `Venta accesorios MovilFree Efectivo - ${productDetails} (Doc: ${docIdentifier})`,
          importe: totalAmount,
          vendedor: data.vendedor || 'Sistema'
        }
      }).catch(e => console.error("Error creating cash Caja entry:", e))
    }

    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
