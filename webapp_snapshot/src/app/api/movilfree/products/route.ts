import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function GET() {
  try {
    const items = await prisma.movilFreeProduct.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(items)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    if (Array.isArray(data)) {
      const map = new Map();
      for (const item of data) {
        const key = item.nombre ? item.nombre.trim() : 'Desconocido';
        if (map.has(key)) {
          map.get(key).stock += (item.stock || 1);
        } else {
          map.set(key, { ...item, nombre: key, stock: item.stock || 1 });
        }
      }

      let count = 0;
      for (const prod of Array.from(map.values())) {
        const existing = await prisma.movilFreeProduct.findFirst({ where: { nombre: prod.nombre } });
        if (existing) {
          await prisma.movilFreeProduct.update({
            where: { id: existing.id },
            data: {
              stock: existing.stock + prod.stock,
              precio: prod.precio, // Actualizar precio
              coste: prod.coste,   // Actualizar coste
              categoria: prod.categoria
            }
          });
        } else {
          await prisma.movilFreeProduct.create({
            data: {
              nombre: prod.nombre,
              categoria: prod.categoria || 'Varios',
              precio: prod.precio || 0,
              coste: prod.coste || 0,
              stock: prod.stock,
              imei: prod.imei || null
            }
          });
        }
        count++;
      }
      return NextResponse.json({ success: true, count });
    }
    const item = await prisma.movilFreeProduct.create({
      data: {
        nombre: data.nombre,
        categoria: data.categoria,
        precio: data.precio,
        coste: data.coste,
        stock: data.stock,
        imei: data.imei || null
      }
    })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
