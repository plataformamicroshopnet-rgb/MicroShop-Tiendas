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
    const item = await prisma.movilFreeProduct.create({
      data: {
        nombre: data.nombre,
        categoria: data.categoria || 'Varios',
        precio: Number(data.precio || 0),
        coste: Number(data.coste || 0),
        stock: Number(data.stock || 0)
      }
    })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
