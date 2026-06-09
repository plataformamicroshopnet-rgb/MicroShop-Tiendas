import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const id = resolvedParams.id
  try {
    const data = await req.json()
    
    // Check if it belongs to MovilFree
    const isMovilFree = await prisma.movilFreeProduct.findUnique({ where: { id: id } })
    if (isMovilFree) {
      await prisma.movilFreeProduct.update({
        where: { id: id },
        data: {
          nombre: data.nombre,
          categoria: data.categoria,
          precio: Number(data.precio),
          coste: Number(data.coste),
          imei: data.imei || null
        }
      })
      
      if (data.tienda !== undefined && data.stock !== undefined) {
        await prisma.movilFreeStock.upsert({
          where: {
            productId_tienda: {
              productId: id,
              tienda: data.tienda
            }
          },
          update: {
            cantidad: Number(data.stock)
          },
          create: {
            productId: id,
            tienda: data.tienda,
            cantidad: Number(data.stock)
          }
        })
      }
      
      const result = await prisma.movilFreeProduct.findUnique({
        where: { id: id },
        include: { stocks: true }
      })
      return NextResponse.json(result)
    }

    // Default to MicroShop
    await prisma.microShopProduct.update({
      where: { id: id },
      data: {
        nombre: data.nombre,
        categoria: data.categoria,
        precio: Number(data.precio),
        coste: Number(data.coste),
        imei: data.imei || null
      }
    })
    
    if (data.tienda !== undefined && data.stock !== undefined) {
      await prisma.microShopStock.upsert({
        where: {
          productId_tienda: {
            productId: id,
            tienda: data.tienda
          }
        },
        update: {
          cantidad: Number(data.stock)
        },
        create: {
          productId: id,
          tienda: data.tienda,
          cantidad: Number(data.stock)
        }
      })
    }
    
    const result = await prisma.microShopProduct.findUnique({
      where: { id: id },
      include: { stocks: true }
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const id = resolvedParams.id
  try {
    const isMovilFree = await prisma.movilFreeProduct.findUnique({ where: { id: id } })
    if (isMovilFree) {
      await prisma.movilFreeProduct.delete({ where: { id: id } })
      return NextResponse.json({ success: true })
    }

    await prisma.microShopProduct.delete({ where: { id: id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
