import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session || !session.user) {
      // No rastreamos usuarios anónimos/desconectados
      return NextResponse.json({ success: true, ignored: true })
    }

    const { path, action = 'VIEW', errorDetails } = await request.json()

    if (!path) {
      return NextResponse.json({ success: false, error: 'Path is required' }, { status: 400 })
    }

    // Detect device automatically from User Agent
    const userAgent = request.headers.get('user-agent') || ''
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent)
    const device = isMobile ? 'MOBILE' : 'DESKTOP'

    // Insertar registro en auditoría (capturamos el posible error si la BD local aún no se ha reiniciado/sincronizado)
    try {
      await prisma.userActivity.create({
        data: {
          userId: session.user.id || null,
          username: session.user.username || 'Desconocido',
          role: session.user.role || 'GUEST',
          path,
          action,
          device,
          errorDetails: errorDetails || null
        }
      })
    } catch (dbError: any) {
      console.warn('[Tracking Log Ignorado] La tabla UserActivity podría no existir todavía. Error:', dbError.message)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in Activity POST:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
