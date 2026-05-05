import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const periodKey = searchParams.get('periodKey')

    if (!periodKey) {
      return NextResponse.json({ error: 'Falta periodKey' }, { status: 400 })
    }

    const conditions = await prisma.monthlyCondition.findMany({
      where: { periodKey },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json({ success: true, data: conditions })
  } catch (error: any) {
    console.error('Error fetching conditions:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { periodKey, type, text, amount, order } = body

    if (!periodKey || !type || !text) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const condition = await prisma.monthlyCondition.create({
      data: {
        periodKey,
        type,
        text,
        amount,
        order: order || 0
      }
    })

    return NextResponse.json({ success: true, data: condition })
  } catch (error: any) {
    console.error('Error creating condition:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
