import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await req.json()
    const updated = await prisma.movilFreeClient.update({
      where: { id },
      data: {
        nif: data.nif,
        nombre: data.nombre,
        direccion: data.direccion,
        poblacion: data.poblacion,
        provincia: data.provincia,
        cp: data.cp,
        movil: data.movil,
        fijo: data.fijo,
        email: data.email
      }
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.movilFreeClient.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
