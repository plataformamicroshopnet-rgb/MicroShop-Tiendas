import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const id = resolvedParams.id
  try {
    const data = await req.json()
    const movistarStores = ['Auxiliadora 45', 'Correhuela', 'Villamayor', 'Béjar']
    
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
        // Enforce 0 stock if target store is a Movistar store
        const targetStock = movistarStores.includes(data.tienda) ? 0 : Number(data.stock)
        await prisma.movilFreeStock.upsert({
          where: {
            productId_tienda: {
              productId: id,
              tienda: data.tienda
            }
          },
          update: {
            cantidad: targetStock
          },
          create: {
            productId: id,
            tienda: data.tienda,
            cantidad: targetStock
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
      // Enforce 0 stock if target store is O2
      const targetStock = data.tienda === 'O2' ? 0 : Number(data.stock)
      await prisma.microShopStock.upsert({
        where: {
          productId_tienda: {
            productId: id,
            tienda: data.tienda
          }
        },
        update: {
          cantidad: targetStock
        },
        create: {
          productId: id,
          tienda: data.tienda,
          cantidad: targetStock
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
