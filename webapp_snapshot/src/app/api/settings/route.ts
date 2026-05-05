import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  
  if (!key) {
    return NextResponse.json({ success: false, error: 'Missing setting key' }, { status: 400 })
  }

  const setting = await prisma.appSetting.findUnique({
    where: { key }
  })

  // Return the raw value or null so the frontend can handle defaults
  return NextResponse.json({ success: true, value: setting ? setting.value : null })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !['ADMIN', 'JEFE DE VENTAS'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'No autorizado. Se requieren permisos de gestión.' }, { status: 401 })
  }

  try {
    const { key, value } = await request.json()
    
    if (!key) {
       return NextResponse.json({ success: false, error: 'Missing setting key' }, { status: 400 })
    }

    const updated = await prisma.appSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    })
    
    return NextResponse.json({ success: true, setting: updated })

  } catch(e) {
    console.error('Error saving setting:', e)
    return NextResponse.json({ success: false, error: 'Error del servidor al guardar configuración' }, { status: 500 })
  }
}
