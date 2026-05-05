import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const trim = searchParams.get('trimestre')
    
    if (!year || !trim) {
        return NextResponse.json({ error: 'Faltan parámetros year y trimestre' }, { status: 400 })
    }

    const key = `visitas_ffvv_${year}_${trim}`
    const setting = await prisma.appSetting.findUnique({ where: { key } })
    
    if (setting && setting.value) {
      return NextResponse.json(JSON.parse(setting.value))
    }
    
    return NextResponse.json({ clients: [], movements: [] })
  } catch (error) {
    console.error('Error fetching visitas:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_CUMPLIMIENTO')) {
       return NextResponse.json({ error: 'No autorizado / Solo Lectura' }, { status: 403 })
    }
    const payload = await request.json()
    const { year, trimestre, data } = payload

    if (!year || !trimestre || !data) {
        return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    const key = `visitas_ffvv_${year}_${trimestre}`
    
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(data) },
      create: { key, value: JSON.stringify(data) }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving visitas:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
