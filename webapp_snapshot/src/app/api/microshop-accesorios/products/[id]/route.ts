import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { identificadorEnUso } from '@/lib/identificador'

const prisma = new PrismaClient()

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const id = resolvedParams.id
  try {
    const data = await req.json()
    const movistarStores = ['Auxiliadora 45', 'Correhuela', 'Villamayor', 'Béjar']

    // Identificador (columna nueva): editable a mano. Se guarda en mayusculas y
    // sin espacios; vacio => se limpia (null). Si otro producto ya lo usa, se rechaza.
    let identPatch: Record<string, any> = {}
    if (data.identificador !== undefined) {
      const code = String(data.identificador || '').trim().toUpperCase()
      if (code) {
        const enUso = await identificadorEnUso(prisma, code, id)
        if (enUso) {
          return NextResponse.json({ error: `El identificador ${code} ya lo usa "${enUso}". Cada accesorio debe tener uno distinto.` }, { status: 400 })
        }
      }
      identPatch = { identificador: code || null }
    }

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
          imei: data.imei || null,
          ...identPatch
        }
      })
      
      if (data.stocks !== undefined) {
        for (const [storeName, qty] of Object.entries(data.stocks)) {
          const targetStock = Number(qty)
          await prisma.movilFreeStock.upsert({
            where: {
              productId_tienda: {
                productId: id,
                tienda: storeName
              }
            },
            update: {
              cantidad: targetStock
            },
            create: {
              productId: id,
              tienda: storeName,
              cantidad: targetStock
            }
          })
        }
      } else if (data.tienda !== undefined && data.stock !== undefined) {
        const targetStock = Number(data.stock)
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
        imei: data.imei || null,
        ...identPatch
      }
    })
    
    if (data.stocks !== undefined) {
      for (const [storeName, qty] of Object.entries(data.stocks)) {
        await prisma.microShopStock.upsert({
          where: {
            productId_tienda: {
              productId: id,
              tienda: storeName
            }
          },
          update: {
            cantidad: Number(qty)
          },
          create: {
            productId: id,
            tienda: storeName,
            cantidad: Number(qty)
          }
        })
      }
    } else if (data.tienda !== undefined && data.stock !== undefined) {
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
