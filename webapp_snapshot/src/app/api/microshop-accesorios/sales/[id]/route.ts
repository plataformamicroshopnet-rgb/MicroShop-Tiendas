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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const id = resolvedParams.id
  try {
    const data = await req.json()
    const currentSale = await prisma.microShopSale.findUnique({ where: { id: id } })
    if (!currentSale) throw new Error("Venta no encontrada")
    
    const tienda = currentSale.tienda
    const cajaTienda = mapStoreToCajaTienda(tienda)
    const todayStr = new Date().toISOString().split('T')[0]

    // FULL RETURN
    if (data.estado === 'DEVUELTA' && currentSale.estado !== 'DEVUELTA') {
      const prods = JSON.parse(currentSale.listaProductos)
      for (const prod of prods) {
        if (prod.id) {
          const qtyToReturn = prod.cantidad - (prod.cantidadDevuelta || 0)
          if (qtyToReturn > 0) {
            const isMovilFree = await prisma.movilFreeProduct.findUnique({ where: { id: prod.id } })
            if (isMovilFree) {
              await prisma.movilFreeStock.upsert({
                where: {
                  productId_tienda: {
                    productId: prod.id,
                    tienda: tienda
                  }
                },
                update: {
                  cantidad: { increment: qtyToReturn }
                },
                create: {
                  productId: prod.id,
                  tienda: tienda,
                  cantidad: qtyToReturn
                }
              }).catch(e => console.error(e))
            } else {
              await prisma.microShopStock.upsert({
                where: {
                  productId_tienda: {
                    productId: prod.id,
                    tienda: tienda
                  }
                },
                update: {
                  cantidad: { increment: qtyToReturn }
                },
                create: {
                  productId: prod.id,
                  tienda: tienda,
                  cantidad: qtyToReturn
                }
              }).catch(e => console.error(e))
            }
          }
        }
      }
      
      // Update client spent
      if (currentSale.nifCliente && currentSale.nifCliente !== 'CONTADO') {
        await prisma.movilFreeClient.update({
          where: { nif: currentSale.nifCliente },
          data: {
            totalComprado: { decrement: currentSale.importeTotal }
          }
        }).catch(e => console.error(e))
      }

      // Add Caja counter-movement
      const productDetails = prods.map((p: any) => `${p.cantidad}x ${p.nombre}`).join(', ')
      if (currentSale.metodoPago === 'Tarjeta') {
        await prisma.cajaEntry.create({
          data: {
            tienda: cajaTienda,
            fecha: todayStr,
            concepto: '(+) Tarjeta MovilFree',
            detalle: `Devolución accesorios Tarjeta - ${productDetails} [Importe: -${currentSale.importeTotal.toFixed(2)}€] (Factura #${currentSale.numeroFactura})`,
            importe: 0,
            vendedor: currentSale.vendedor || 'Sistema'
          }
        }).catch(e => console.error(e))
      } else {
        await prisma.cajaEntry.create({
          data: {
            tienda: cajaTienda,
            fecha: todayStr,
            concepto: '(-) Otras salidas',
            detalle: `Devolución accesorios Efectivo - ${productDetails} (Factura #${currentSale.numeroFactura})`,
            importe: -currentSale.importeTotal,
            vendedor: currentSale.vendedor || 'Sistema'
          }
        }).catch(e => console.error(e))
      }
      
      const item = await prisma.microShopSale.update({
        where: { id: id },
        data: {
          estado: 'DEVUELTA',
          importeTotal: 0,
          motivoDevolucion: data.motivoDevolucion || currentSale.motivoDevolucion
        }
      })
      return NextResponse.json(item)
    }
    
    // PARTIAL RETURN
    if (data.estado === 'DEVOLUCION_PARCIAL') {
      const prods = JSON.parse(currentSale.listaProductos)
      let totalDevuelto = 0
      
      for (const ret of data.returnedItems) {
        const prodInSale = prods.find((p: any) => p.id === ret.id)
        if (prodInSale) {
          const prevDevuelto = prodInSale.cantidadDevuelta || 0
          const qtyToReturn = Number(ret.cantidad)
          if (qtyToReturn > 0 && (prevDevuelto + qtyToReturn) <= prodInSale.cantidad) {
            prodInSale.cantidadDevuelta = prevDevuelto + qtyToReturn
            totalDevuelto += qtyToReturn * Number(prodInSale.precio)
            
            const isMovilFree = await prisma.movilFreeProduct.findUnique({ where: { id: ret.id } })
            if (isMovilFree) {
              await prisma.movilFreeStock.upsert({
                where: {
                  productId_tienda: {
                    productId: ret.id,
                    tienda: tienda
                  }
                },
                update: {
                  cantidad: { increment: qtyToReturn }
                },
                create: {
                  productId: ret.id,
                  tienda: tienda,
                  cantidad: qtyToReturn
                }
              }).catch(e => console.error(e))
            } else {
              await prisma.microShopStock.upsert({
                where: {
                  productId_tienda: {
                    productId: ret.id,
                    tienda: tienda
                  }
                },
                update: {
                  cantidad: { increment: qtyToReturn }
                },
                create: {
                  productId: ret.id,
                  tienda: tienda,
                  cantidad: qtyToReturn
                }
              }).catch(e => console.error(e))
            }
          }
        }
      }
      
      if (totalDevuelto > 0) {
        // Update client spent
        if (currentSale.nifCliente && currentSale.nifCliente !== 'CONTADO') {
          await prisma.movilFreeClient.update({
            where: { nif: currentSale.nifCliente },
            data: {
              totalComprado: { decrement: totalDevuelto }
            }
          }).catch(e => console.error(e))
        }

        // Add Caja counter-movement
        const returnedProductDetails = data.returnedItems
          .map((ret: any) => {
            const p = prods.find((x: any) => x.id === ret.id)
            return p ? `${ret.cantidad}x ${p.nombre}` : ''
          })
          .filter(Boolean)
          .join(', ')
        if (currentSale.metodoPago === 'Tarjeta') {
          await prisma.cajaEntry.create({
            data: {
              tienda: cajaTienda,
              fecha: todayStr,
              concepto: '(+) Tarjeta MovilFree',
              detalle: `Devolución parcial Tarjeta - ${returnedProductDetails} [Importe: -${totalDevuelto.toFixed(2)}€] (Factura #${currentSale.numeroFactura})`,
              importe: 0,
              vendedor: currentSale.vendedor || 'Sistema'
            }
          }).catch(e => console.error(e))
        } else {
          await prisma.cajaEntry.create({
            data: {
              tienda: cajaTienda,
              fecha: todayStr,
              concepto: '(-) Otras salidas',
              detalle: `Devolución parcial Efectivo - ${returnedProductDetails} [Importe: -${totalDevuelto.toFixed(2)}€] (Factura #${currentSale.numeroFactura})`,
              importe: -totalDevuelto,
              vendedor: currentSale.vendedor || 'Sistema'
            }
          }).catch(e => console.error(e))
        }
      }
      
      const isFullNow = prods.every((p: any) => (p.cantidadDevuelta || 0) === p.cantidad)
      const newState = isFullNow ? 'DEVUELTA' : 'DEVOLUCION_PARCIAL'
      
      const item = await prisma.microShopSale.update({
        where: { id },
        data: {
          estado: newState,
          listaProductos: JSON.stringify(prods),
          importeTotal: currentSale.importeTotal - totalDevuelto,
          motivoDevolucion: data.motivoDevolucion || currentSale.motivoDevolucion
        }
      })
      return NextResponse.json(item)
    }

    // Default UPDATE
    const item = await prisma.microShopSale.update({
      where: { id: id },
      data: {
        estado: data.estado || currentSale.estado,
        motivoDevolucion: data.motivoDevolucion || currentSale.motivoDevolucion
      }
    })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const id = resolvedParams.id
  try {
    const currentSale = await prisma.microShopSale.findUnique({ where: { id: id } })
    if (currentSale && currentSale.estado !== 'DEVUELTA') {
      const tienda = currentSale.tienda
      const cajaTienda = mapStoreToCajaTienda(tienda)
      const todayStr = new Date().toISOString().split('T')[0]
      const prods = JSON.parse(currentSale.listaProductos)
      for (const prod of prods) {
        if (prod.id) {
          const isMovilFree = await prisma.movilFreeProduct.findUnique({ where: { id: prod.id } })
          if (isMovilFree) {
            await prisma.movilFreeStock.upsert({
              where: {
                productId_tienda: {
                  productId: prod.id,
                  tienda: tienda
                }
              },
              update: {
                cantidad: { increment: Number(prod.cantidad) }
              },
              create: {
                productId: prod.id,
                tienda: tienda,
                cantidad: Number(prod.cantidad)
              }
            }).catch(e => console.error(e))
          } else {
            await prisma.microShopStock.upsert({
              where: {
                productId_tienda: {
                  productId: prod.id,
                  tienda: tienda
                }
              },
              update: {
                cantidad: { increment: Number(prod.cantidad) }
              },
              create: {
                productId: prod.id,
                tienda: tienda,
                cantidad: Number(prod.cantidad)
              }
            }).catch(e => console.error(e))
          }
        }
      }
      
      // Update client spent
      if (currentSale.nifCliente && currentSale.nifCliente !== 'CONTADO') {
        await prisma.movilFreeClient.update({
          where: { nif: currentSale.nifCliente },
          data: {
            totalComprado: { decrement: currentSale.importeTotal }
          }
        }).catch(e => console.error(e))
      }

      // Add Caja counter-movement
      const productDetails = prods.map((p: any) => `${p.cantidad}x ${p.nombre}`).join(', ')
      if (currentSale.metodoPago === 'Tarjeta') {
        await prisma.cajaEntry.create({
          data: {
            tienda: cajaTienda,
            fecha: todayStr,
            concepto: '(+) Tarjeta MovilFree',
            detalle: `Anulación venta Tarjeta - ${productDetails} [Importe: -${currentSale.importeTotal.toFixed(2)}€] (Factura #${currentSale.numeroFactura})`,
            importe: 0,
            vendedor: currentSale.vendedor || 'Sistema'
          }
        }).catch(e => console.error(e))
      } else {
        await prisma.cajaEntry.create({
          data: {
            tienda: cajaTienda,
            fecha: todayStr,
            concepto: '(-) Otras salidas',
            detalle: `Anulación venta Efectivo - ${productDetails} (Factura #${currentSale.numeroFactura})`,
            importe: -currentSale.importeTotal,
            vendedor: currentSale.vendedor || 'Sistema'
          }
        }).catch(e => console.error(e))
      }
    }

    await prisma.microShopSale.delete({ where: { id: id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
