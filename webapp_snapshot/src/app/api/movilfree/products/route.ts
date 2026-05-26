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
      await prisma.movilFreeProduct.createMany({ data })
      return NextResponse.json({ success: true, count: data.length })
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
