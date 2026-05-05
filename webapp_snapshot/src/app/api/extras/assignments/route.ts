import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const periodKey = searchParams.get('periodKey')

    if (!periodKey) {
      return NextResponse.json({ success: false, error: 'Se requiere periodKey' }, { status: 400 })
    }

    const assignments = await prisma.extraAssignment.findMany({
      where: {
        period: {
          period_key: periodKey
        }
      },
      include: {
        rule: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ success: true, assignments })
  } catch (error: any) {
    console.error('[GET ExtraAssignments]', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
