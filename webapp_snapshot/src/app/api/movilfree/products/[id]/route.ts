import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const id = resolvedParams.id;
  try {
    const data = await req.json()
    const item = await prisma.movilFreeProduct.update({
      where: { id: id },
      data: {
        nombre: data.nombre,
        categoria: data.categoria,
        precio: Number(data.precio),
        coste: Number(data.coste),
        stock: Number(data.stock),
        imei: data.imei || null
      }
    })
    return NextResponse.json(item)
  } catch (e: any) {
    console.error('PUT Error:', e); return NextResponse.json({ error: e.message, fullError: e }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const id = resolvedParams.id;
  try {
    await prisma.movilFreeProduct.delete({ where: { id: id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('PUT Error:', e); return NextResponse.json({ error: e.message, fullError: e }, { status: 500 })
  }
}
