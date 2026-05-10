import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { normalizeRole } from '@/lib/appConfig'

const prisma = new PrismaClient()

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const allUsers = await prisma.user.findMany()
  
  const comerciales = allUsers
    .filter((u: any) => normalizeRole(u.role) === 'COMERCIAL' || normalizeRole(u.role) === 'JEFE DE VENTAS')
    .map((u: any) => {
      let teamStr = u.team;
      if (!teamStr || teamStr === 'Sin Equipo') {
          if (u.username.toLowerCase().includes('salva')) {
              teamStr = 'Jefe Equipo MicroShop';
          } else {
              teamStr = 'Equipo MicroShop';
          }
      }
      return { 
        name: u.username, 
        role: u.role,
        codigoComercial: u.codigoComercial,
        team: teamStr,
        agendaKey: u.codigoComercial || u.username
      };
    })

  return NextResponse.json({ success: true, comerciales })
}
