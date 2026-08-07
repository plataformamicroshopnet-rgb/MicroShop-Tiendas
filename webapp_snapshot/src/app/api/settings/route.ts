import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  // `keys=a,b,c` devuelve un diccionario clave→valor de una sola vez (las claves
  // que no existan salen a null). Lo usa la pantalla del Jefe de Tiendas, que
  // necesita 18 ajustes a la vez (los 9 del mes y los 9 de respaldo).
  //
  // A diferencia de `key=` (que es de siempre y lo llaman muchas pantallas), esta
  // vía SÍ exige sesión y tiene tope: leer muchos ajustes de golpe es leer la
  // parametrización económica entera del negocio, y en AppSetting viven también
  // los objetivos territoriales, las reglas de O2 y los datos de Ganancias.
  const keys = searchParams.get('keys')
  if (keys) {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
    }
    const lista = [...new Set(keys.split(',').map(k => k.trim()).filter(Boolean))]
    if (lista.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing setting keys' }, { status: 400 })
    }
    if (lista.length > 100) {
      return NextResponse.json({ success: false, error: 'Demasiadas claves (máximo 100).' }, { status: 400 })
    }
    try {
      const filas = await prisma.appSetting.findMany({ where: { key: { in: lista } } })
      const values: Record<string, string | null> = {}
      for (const k of lista) values[k] = null
      for (const f of filas) values[f.key] = f.value
      return NextResponse.json({ success: true, values })
    } catch (e) {
      console.error('Error reading settings:', e)
      return NextResponse.json({ success: false, error: 'Error del servidor al leer configuración' }, { status: 500 })
    }
  }

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
