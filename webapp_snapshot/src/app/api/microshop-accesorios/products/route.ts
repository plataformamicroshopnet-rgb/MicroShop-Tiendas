import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const items = await prisma.microShopProduct.findMany({
      include: {
        stocks: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    const mfItems = await prisma.movilFreeProduct.findMany({
      include: {
        stocks: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    const combined = [
      ...items.map(item => ({ ...item, isMovilFree: false })),
      ...mfItems.map(item => ({ ...item, isMovilFree: true }))
    ]
    return NextResponse.json(combined)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    
    // Bulk Import
    if (Array.isArray(data.products)) {
      const tienda = data.tienda
      if (!tienda) {
        return NextResponse.json({ error: 'La tienda es obligatoria para la importación masiva' }, { status: 400 })
      }
      
      let count = 0
      for (const p of data.products) {
        const pName = p.nombre ? p.nombre.trim() : 'Desconocido'
        
        let product = await prisma.microShopProduct.findFirst({
          where: { nombre: pName }
        })
        
        if (!product) {
          product = await prisma.microShopProduct.create({
            data: {
              nombre: pName,
              categoria: p.categoria || 'Accesorio',
              precio: Number(p.precio) || 0,
              coste: Number(p.coste) || 0,
              imei: p.imei || null,
              ...(p.createdAt ? { createdAt: new Date(p.createdAt) } : {})
            }
          })
        } else {
          product = await prisma.microShopProduct.update({
            where: { id: product.id },
            data: {
              categoria: p.categoria || product.categoria,
              precio: p.precio !== undefined ? Number(p.precio) : product.precio,
              coste: p.coste !== undefined ? Number(p.coste) : product.coste,
              imei: p.imei || product.imei,
              ...(p.createdAt ? { createdAt: new Date(p.createdAt) } : {})
            }
          })
        }
        
        // Upsert stock for this specific store (enforce 0 if store is O2)
        const targetStock = tienda === 'O2' ? 0 : (Number(p.stock) || 0)
        await prisma.microShopStock.upsert({
          where: {
            productId_tienda: {
              productId: product.id,
              tienda: tienda
            }
          },
          update: {
            cantidad: { increment: targetStock }
          },
          create: {
            productId: product.id,
            tienda: tienda,
            cantidad: targetStock
          }
        })
        count++
      }
      return NextResponse.json({ success: true, count })
    }
    
    // Single Product Creation
    const tienda = data.tienda
    if (!tienda) {
      return NextResponse.json({ error: 'La tienda es obligatoria' }, { status: 400 })
    }
    
    const pName = data.nombre ? data.nombre.trim() : 'Sin Nombre'
    let product = await prisma.microShopProduct.findFirst({
      where: { nombre: pName }
    })
    
    if (!product) {
      product = await prisma.microShopProduct.create({
        data: {
          nombre: pName,
          categoria: data.categoria || 'Accesorio',
          precio: Number(data.precio) || 0,
          coste: Number(data.coste) || 0,
          imei: data.imei || null
        }
      })
    } else {
      product = await prisma.microShopProduct.update({
        where: { id: product.id },
        data: {
          categoria: data.categoria || product.categoria,
          precio: Number(data.precio) || product.precio,
          coste: Number(data.coste) || product.coste,
          imei: data.imei || product.imei
        }
      })
    }
    
    // Update stock in store (enforce 0 if store is O2)
    const targetStock = tienda === 'O2' ? 0 : (Number(data.stock) || 0)
    await prisma.microShopStock.upsert({
      where: {
        productId_tienda: {
          productId: product.id,
          tienda: tienda
        }
      },
      update: {
        cantidad: { increment: targetStock }
      },
      create: {
        productId: product.id,
        tienda: tienda,
        cantidad: targetStock
      }
    })
    
    const result = await prisma.microShopProduct.findUnique({
      where: { id: product.id },
      include: { stocks: true }
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
