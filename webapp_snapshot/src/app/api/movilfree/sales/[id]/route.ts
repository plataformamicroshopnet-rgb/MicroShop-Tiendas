import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const id = resolvedParams.id;
  try {
    const data = await req.json()
    const currentSale = await prisma.movilFreeSale.findUnique({ where: { id: id } })
    if (!currentSale) throw new Error("Sale not found")

    // FULL RETURN
    if (data.estado === 'DEVUELTA' && currentSale.estado !== 'DEVUELTA') {
      const prods = JSON.parse(currentSale.listaProductos)
      for (const prod of prods) {
        if (prod.id) {
          const qtyToReturn = prod.cantidad - (prod.cantidadDevuelta || 0)
          if (qtyToReturn > 0) {
            await prisma.movilFreeProduct.update({
              where: { id: prod.id },
              data: { stock: { increment: qtyToReturn } }
            }).catch(e => console.error(e))
          }
        }
      }
      if (currentSale.nifCliente) {
        await prisma.movilFreeClient.update({
          where: { nif: currentSale.nifCliente },
          data: { totalComprado: { decrement: currentSale.importeTotal } }
        }).catch(e => console.error(e))
      }
      
      const item = await prisma.movilFreeSale.update({
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
      let totalDevuelto = 0;
      
      for (const ret of data.returnedItems) {
        const prodInSale = prods.find((p: any) => p.id === ret.id)
        if (prodInSale) {
           const prevDevuelto = prodInSale.cantidadDevuelta || 0
           const qtyToReturn = Number(ret.cantidad)
           if (qtyToReturn > 0 && (prevDevuelto + qtyToReturn) <= prodInSale.cantidad) {
             prodInSale.cantidadDevuelta = prevDevuelto + qtyToReturn
             totalDevuelto += qtyToReturn * Number(prodInSale.precio)
             
             await prisma.movilFreeProduct.update({
               where: { id: ret.id },
               data: { stock: { increment: qtyToReturn } }
             }).catch(e => console.error(e))
           }
        }
      }
      
      if (currentSale.nifCliente && totalDevuelto > 0) {
         await prisma.movilFreeClient.update({
           where: { nif: currentSale.nifCliente },
           data: { totalComprado: { decrement: totalDevuelto } }
         }).catch(e => console.error(e))
      }
      
      const isFullNow = prods.every((p: any) => (p.cantidadDevuelta || 0) === p.cantidad)
      const newState = isFullNow ? 'DEVUELTA' : 'DEVOLUCION_PARCIAL'
      
      const item = await prisma.movilFreeSale.update({
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
    const item = await prisma.movilFreeSale.update({
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
    const resolvedParams = await params;
    const id = resolvedParams.id;
  try {
    const currentSale = await prisma.movilFreeSale.findUnique({ where: { id: id } })
    if (currentSale && currentSale.estado !== 'DEVUELTA') {
      // Restore stock if it wasn't returned
      const prods = JSON.parse(currentSale.listaProductos)
      for (const prod of prods) {
        if (prod.id) {
          await prisma.movilFreeProduct.update({
            where: { id: prod.id },
            data: { stock: { increment: Number(prod.cantidad) } }
          }).catch(e => console.error(e))
        }
      }
      if (currentSale.nifCliente) {
        await prisma.movilFreeClient.update({
          where: { nif: currentSale.nifCliente },
          data: { totalComprado: { decrement: currentSale.importeTotal } }
        }).catch(e => console.error(e))
      }
    }

    await prisma.movilFreeSale.delete({ where: { id: id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
