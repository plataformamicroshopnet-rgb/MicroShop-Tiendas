import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const periods = await prisma.workPeriod.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ success: true, periods })
  } catch (error) {
    console.error('Error fetching periods:', error)
    return NextResponse.json({ success: false, error: 'Database error fetching periods' })
  }
}
