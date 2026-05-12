import os

sales_route = """import { NextResponse } from 'next/server'
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
    
    // Create the sale
    const item = await prisma.movilFreeSale.create({
      data: {
        vendedor: data.vendedor,
        nifCliente: data.nifCliente,
        nombreCliente: data.nombreCliente,
        listaProductos: listaProductosStr,
        importeTotal: Number(data.importeTotal),
        estado: 'COMPLETADA'
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
"""
with open('src/app/api/movilfree/sales/route.ts', 'w', encoding='utf-8') as f:
    f.write(sales_route)


sales_id_route = """import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json()
    const currentSale = await prisma.movilFreeSale.findUnique({ where: { id: params.id } })
    if (!currentSale) throw new Error("Sale not found")

    // If changing state to DEVUELTA
    if (data.estado === 'DEVUELTA' && currentSale.estado !== 'DEVUELTA') {
      const prods = JSON.parse(currentSale.listaProductos)
      // Return stock
      for (const prod of prods) {
        if (prod.id) {
          await prisma.movilFreeProduct.update({
            where: { id: prod.id },
            data: { stock: { increment: Number(prod.cantidad) } }
          }).catch(e => console.error(e))
        }
      }
      // Deduct from client total
      if (currentSale.nifCliente) {
        await prisma.movilFreeClient.update({
          where: { nif: currentSale.nifCliente },
          data: { totalComprado: { decrement: currentSale.importeTotal } }
        }).catch(e => console.error(e))
      }
    }

    const item = await prisma.movilFreeSale.update({
      where: { id: params.id },
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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const currentSale = await prisma.movilFreeSale.findUnique({ where: { id: params.id } })
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

    await prisma.movilFreeSale.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
"""
with open('src/app/api/movilfree/sales/[id]/route.ts', 'w', encoding='utf-8') as f:
    f.write(sales_id_route)

print("Created Sales APIs")
