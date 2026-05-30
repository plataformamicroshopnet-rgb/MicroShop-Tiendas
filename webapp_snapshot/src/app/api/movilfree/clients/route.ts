import { NextResponse } from 'next/server'
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
    if (Array.isArray(data)) {
      const items = await prisma.$transaction(
        data.map(c => prisma.movilFreeClient.create({
          data: {
            nif: c.nif || '',
            nombre: c.nombre || '',
            direccion: c.direccion || '',
            poblacion: c.poblacion || '',
            provincia: c.provincia || '',
            cp: c.cp || '',
            movil: c.movil || '',
            fijo: c.fijo || '',
            email: c.email || '',
            totalComprado: c.totalComprado || 0
          }
        }))
      )
      return NextResponse.json(items)
    }

    const item = await prisma.movilFreeClient.create({
      data: {
        nif: data.nif,
        nombre: data.nombre,
        direccion: data.direccion,
        poblacion: data.poblacion,
        provincia: data.provincia,
        cp: data.cp,
        movil: data.movil,
        fijo: data.fijo,
        email: data.email,
        totalComprado: data.totalComprado || 0
      }
    })
    return NextResponse.json(item)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
