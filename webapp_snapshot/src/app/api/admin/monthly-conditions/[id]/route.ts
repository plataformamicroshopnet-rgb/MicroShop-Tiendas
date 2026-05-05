import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'

const prisma = new PrismaClient()

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { type, text, amount, order } = body

    const condition = await prisma.monthlyCondition.update({
      where: { id },
      data: {
        type: type !== undefined ? type : undefined,
        text: text !== undefined ? text : undefined,
        amount: amount !== undefined ? amount : undefined,
        order: order !== undefined ? order : undefined
      }
    })

    return NextResponse.json({ success: true, data: condition })
  } catch (error: any) {
    console.error('Error updating condition:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    await prisma.monthlyCondition.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting condition:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
