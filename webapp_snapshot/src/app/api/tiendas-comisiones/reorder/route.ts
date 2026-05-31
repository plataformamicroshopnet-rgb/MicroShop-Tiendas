import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { normalizeRole } from '@/lib/appConfig'

const prisma = new PrismaClient()

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user || !session.user.username) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { username: session.user.username },
      select: { role: true }
    });

    if (!dbUser || normalizeRole(dbUser.role) !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 });
    }

    const data = await request.json()
    const { periodKey, orderedIds } = data

    if (!periodKey || !Array.isArray(orderedIds)) {
      return NextResponse.json({ success: false, error: 'Faltan parámetros' }, { status: 400 })
    }

    // Usaremos una transacción para asegurar consistencia
    const queries = orderedIds.map((id: string, index: number) => {
      return prisma.tiendaCommissionRule.update({
        where: { id },
        data: { order: index }
      });
    });

    await prisma.$transaction(queries);

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error POST tiendas-comisiones reorder:', error)
    return NextResponse.json({ success: false, error: 'Error al reordenar' }, { status: 500 })
  }
}
