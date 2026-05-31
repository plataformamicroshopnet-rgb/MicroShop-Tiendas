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
      let count = 0;
      for (const c of data) {
        let finalNif = c.nif ? String(c.nif).trim() : `SIN_NIF_${Math.random().toString(36).substring(2, 10)}`;
        if (finalNif === '') {
           finalNif = `SIN_NIF_${Math.random().toString(36).substring(2, 10)}`;
        }
        
        try {
          const existing = await prisma.movilFreeClient.findUnique({ where: { nif: finalNif } });
          if (existing) {
            await prisma.movilFreeClient.update({
              where: { nif: finalNif },
              data: {
                nombre: c.nombre || existing.nombre,
                movil: c.movil || existing.movil,
                direccion: c.direccion || existing.direccion,
                totalComprado: c.totalComprado || existing.totalComprado
              }
            });
          } else {
            await prisma.movilFreeClient.create({
              data: {
                nif: finalNif,
                nombre: c.nombre || 'Desconocido',
                direccion: c.direccion || '',
                poblacion: c.poblacion || '',
                provincia: c.provincia || '',
                cp: c.cp || '',
                movil: c.movil || '',
                fijo: c.fijo || '',
                email: c.email || '',
                totalComprado: c.totalComprado || 0
              }
            });
          }
          count++;
        } catch (err) {
          console.error("Error inserting client: ", err);
        }
      }
      return NextResponse.json({ success: true, count });
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
