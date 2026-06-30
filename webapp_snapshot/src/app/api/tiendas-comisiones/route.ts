export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { ROLES, normalizeRole } from '@/lib/appConfig'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const periodKey = searchParams.get('periodKey')

  if (!periodKey) {
    return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 })
  }

  try {
    const rules = await prisma.tiendaCommissionRule.findMany({
      where: { periodKey },
      orderBy: { order: 'asc' }
    })

    const session = await getSession();
    let isComercial = false;
    let username = '';

    if (session && session.user && session.user.username) {
      const dbUser = await prisma.user.findUnique({
        where: { username: session.user.username },
        select: { role: true, username: true }
      });
      if (dbUser) {
        isComercial = normalizeRole(dbUser.role) === 'COMERCIAL';
        username = dbUser.username;
      }
    }
    
    const hours = await prisma.tiendaComercialHour.findMany({
      where: { periodKey },
      orderBy: { comercial: 'asc' }
    })

    const filteredHours = isComercial 
      ? hours.filter(h => h.comercial.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === username.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()) 
      : hours;

    return NextResponse.json({ success: true, rules, hours: filteredHours })
  } catch (error) {
    console.error('Error GET tiendas comisiones:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener datos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { periodKey, rules, hours } = data

    if (!periodKey) {
      return NextResponse.json({ success: false, error: 'Falta periodKey' }, { status: 400 })
    }

    // Usaremos una transacción para asegurar consistencia
    await prisma.$transaction([
      prisma.tiendaCommissionRule.deleteMany({ where: { periodKey } }),
      prisma.tiendaComercialHour.deleteMany({ where: { periodKey } }),
      
      prisma.tiendaCommissionRule.createMany({
        data: (rules || []).map((r: any, index: number) => ({
          periodKey,
          nombre: r.nombre || '',
          productosCuentan: r.productosCuentan || '',
          objPrimerTramo: r.objPrimerTramo !== undefined && r.objPrimerTramo !== '' ? Number(r.objPrimerTramo) : null,
          importePrimerTramo: r.importePrimerTramo || '',
          objSegundoTramo: r.objSegundoTramo !== undefined && r.objSegundoTramo !== '' ? Number(r.objSegundoTramo) : null,
          importeSegundoTramo: r.importeSegundoTramo || '',
          objTercerTramo: r.objTercerTramo !== undefined && r.objTercerTramo !== '' ? Number(r.objTercerTramo) : null,
          importeTercerTramo: r.importeTercerTramo || '',
          condicionantes: r.condicionantes || '',
          totalHoras: r.totalHoras !== undefined && r.totalHoras !== '' ? Number(r.totalHoras) : null,
          order: index,
        }))
      }),

      prisma.tiendaComercialHour.createMany({
        data: (hours || []).map((h: any) => ({
          periodKey,
          comercial: h.comercial || '',
          tienda: h.tienda ? String(h.tienda) : null,
          horario: h.horario !== undefined && h.horario !== '' ? Number(h.horario) : 0,
        }))
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error POST tiendas comisiones:', error)
    return NextResponse.json({ success: false, error: 'Error al guardar datos' }, { status: 500 })
  }
}
