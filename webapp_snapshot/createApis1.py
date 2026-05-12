import os

products_route = """import { NextResponse } from 'next/server'
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
"""

with open('src/app/api/movilfree/products/route.ts', 'w', encoding='utf-8') as f:
    f.write(products_route)

product_id_route = """import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json()
    const item = await prisma.movilFreeProduct.update({
      where: { id: params.id },
      data: {
        nombre: data.nombre,
        categoria: data.categoria,
        precio: Number(data.precio),
        coste: Number(data.coste),
        stock: Number(data.stock)
      }
    })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await prisma.movilFreeProduct.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
"""
with open('src/app/api/movilfree/products/[id]/route.ts', 'w', encoding='utf-8') as f:
    f.write(product_id_route)


clients_route = """import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function GET() {
  try {
    const items = await prisma.movilFreeClient.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(items)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const item = await prisma.movilFreeClient.create({
      data: {
        nif: data.nif,
        nombre: data.nombre,
        telefono: data.telefono,
        email: data.email
      }
    })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
"""
with open('src/app/api/movilfree/clients/route.ts', 'w', encoding='utf-8') as f:
    f.write(clients_route)

print("Created Products and Clients APIs")
