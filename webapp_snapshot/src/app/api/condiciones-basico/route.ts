import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()
const SETTING_KEY = 'condiciones_basico_data'

export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY }
    })
    
    if (setting && setting.value) {
      return NextResponse.json(JSON.parse(setting.value))
    }
    
    // Default empty state if nothing exists
    return NextResponse.json({ columns: [], rows: [] })
  } catch (error) {
    console.error('Error fetching condiciones basico:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() // Expects { columns: [...], rows: [...] }

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(payload) },
      create: { key: SETTING_KEY, value: JSON.stringify(payload) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving condiciones basico:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
