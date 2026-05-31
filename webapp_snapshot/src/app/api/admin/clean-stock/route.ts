import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const deleted = await prisma.movilFreeProduct.deleteMany({
      where: {
        nombre: {
          startsWith: '202'
        }
      }
    })
    return NextResponse.json({ success: true, count: deleted.count })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
