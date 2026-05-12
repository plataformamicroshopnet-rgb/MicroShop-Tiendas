import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

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
    // data.listaProductos is an array
    const listaProductosStr = JSON.stringify(data.listaProductos)
    

    const lastSale = await prisma.movilFreeSale.findFirst({
      where: { numeroFactura: { not: null } },
      orderBy: { numeroFactura: 'desc' }
    })
    const newInvoiceNumber = lastSale && lastSale.numeroFactura ? lastSale.numeroFactura + 1 : 31000;

    // Create the sale
    const item = await prisma.movilFreeSale.create({
      data: {
        vendedor: data.vendedor,
        nifCliente: data.nifCliente,
        nombreCliente: data.nombreCliente,
        listaProductos: listaProductosStr,
        importeTotal: Number(data.importeTotal),
        estado: 'COMPLETADA',
        numeroFactura: newInvoiceNumber
      }
    })


    // Deduct stock
    for (const prod of data.listaProductos) {
      if (prod.id) {
        await prisma.movilFreeProduct.update({
          where: { id: prod.id },
          data: { stock: { decrement: Number(prod.cantidad) } }
        }).catch(e => console.error("Error deducting stock", e))
      }
    }

    // Update client total
    if (data.nifCliente) {
      await prisma.movilFreeClient.update({
        where: { nif: data.nifCliente },
        data: { totalComprado: { increment: Number(data.importeTotal) } }
      }).catch(e => console.error("Error updating client total", e))
    }

    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
