import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_ADMIN')) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    // Limitamos a los últimos 5000 registros para proteger el servidor de sobrecarga
    // en Vercel, pero no limitamos qué roles recoge
    const logs = await prisma.userActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5000 
    })

    return NextResponse.json({ success: true, logs })

  } catch (error: any) {
    console.error('Error fetching UserActivity logs:', error)
    return NextResponse.json({ success: false, error: 'Error del servidor o BD desajustada' }, { status: 500 })
  }
}
