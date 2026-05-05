import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'

const prisma = new PrismaClient()

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { updates } = body

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
    }

    // Ejecutar todas las actualizaciones de orden en una transacción
    await prisma.$transaction(
      updates.map((update: { id: string; order: number }) =>
        prisma.monthlyCondition.update({
          where: { id: update.id },
          data: { order: update.order }
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error reordering conditions:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
