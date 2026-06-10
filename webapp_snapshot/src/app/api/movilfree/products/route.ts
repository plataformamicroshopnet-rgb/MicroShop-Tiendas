import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const items = await prisma.movilFreeProduct.findMany({
      include: { stocks: true },
      orderBy: { createdAt: 'desc' }
    })
    
    // Auto-migrate legacy stocks to MovilFreeStock (O2) if empty
    let migrated = false
    for (const item of items) {
      if (item.stocks.length === 0 && item.stock > 0) {
        await prisma.movilFreeStock.create({
          data: {
            productId: item.id,
            tienda: 'O2',
            cantidad: item.stock
          }
        }).catch(e => console.error("Error migrating stock:", e))
        migrated = true
      }
    }
    
    let finalItems = items
    if (migrated) {
      finalItems = await prisma.movilFreeProduct.findMany({
        include: { stocks: true },
        orderBy: { createdAt: 'desc' }
      })
    }
    
    const msItems = await prisma.microShopProduct.findMany({
      include: { stocks: true },
      orderBy: { createdAt: 'desc' }
    })
    
    const combined = [
      ...finalItems.map(item => ({ ...item, isMovilFree: true })),
      ...msItems.map(item => ({ ...item, isMovilFree: false }))
    ]
    return NextResponse.json(combined)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const movistarStores = ['Auxiliadora 45', 'Correhuela', 'Villamayor', 'Béjar']
    
    // Bulk Import
    if (Array.isArray(data) || Array.isArray(data.products)) {
      const productsList = Array.isArray(data) ? data : data.products
      const tienda = Array.isArray(data) ? 'O2' : (data.tienda || 'O2')
      
      const map = new Map();
      for (const item of productsList) {
        const key = item.nombre ? item.nombre.trim() : 'Desconocido';
        if (map.has(key)) {
          map.get(key).stock += (item.stock || 1);
        } else {
          map.set(key, { ...item, nombre: key, stock: item.stock || 1 });
        }
      }

      let count = 0;
      for (const prod of Array.from(map.values())) {
        let product = await prisma.movilFreeProduct.findFirst({ where: { nombre: prod.nombre } });
        if (product) {
          product = await prisma.movilFreeProduct.update({
            where: { id: product.id },
            data: {
              precio: prod.precio, // Update price
              coste: prod.coste,   // Update cost
              categoria: prod.categoria,
              ...(prod.createdAt ? { createdAt: new Date(prod.createdAt) } : {})
            }
          });
        } else {
          product = await prisma.movilFreeProduct.create({
            data: {
              nombre: prod.nombre,
              categoria: prod.categoria || 'Varios',
              precio: prod.precio || 0,
              coste: prod.coste || 0,
              stock: 0, // Stock field in product is legacy/unused now, actual stock is in MovilFreeStock
              imei: prod.imei || null,
              ...(prod.createdAt ? { createdAt: new Date(prod.createdAt) } : {})
            }
          });
        }
        
        // Upsert stock in target store
        const targetStock = Number(prod.stock) || 0
        await prisma.movilFreeStock.upsert({
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
        count++;
      }
      return NextResponse.json({ success: true, count });
    }
    
    // Single Product Creation
    const tienda = data.tienda || 'O2'
    const pName = data.nombre ? data.nombre.trim() : 'Sin Nombre'
    let product = await prisma.movilFreeProduct.findFirst({ where: { nombre: pName } })
    
    if (product) {
      product = await prisma.movilFreeProduct.update({
        where: { id: product.id },
        data: {
          categoria: data.categoria || product.categoria,
          precio: Number(data.precio) || product.precio,
          coste: Number(data.coste) || product.coste,
          imei: data.imei || product.imei
        }
      })
    } else {
      product = await prisma.movilFreeProduct.create({
        data: {
          nombre: pName,
          categoria: data.categoria || 'Varios',
          precio: Number(data.precio) || 0,
          coste: Number(data.coste) || 0,
          stock: 0,
          imei: data.imei || null
        }
      })
    }
    
    // Upsert store specific stock
    const targetStock = Number(data.stock) || 0
    await prisma.movilFreeStock.upsert({
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
    
    const result = await prisma.movilFreeProduct.findUnique({
      where: { id: product.id },
      include: { stocks: true }
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
