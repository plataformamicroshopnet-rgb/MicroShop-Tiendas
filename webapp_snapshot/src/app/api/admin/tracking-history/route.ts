import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MODULE_ADMIN')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const monthStr = searchParams.get('month')
    const yearStr = searchParams.get('year')

    // Si no pasan el mes/año o es modo "ACTUAL", parseamos la fecha y sacamos el mes actual al vuelo
    if (!monthStr || !yearStr || monthStr === 'CURRENT') {
      const now = new Date()
      // Modo Mes en Curso: extraemos "al vuelo" de la tabla masiva UserActivity de los últimos dias del mes actual
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const logs = await prisma.userActivity.findMany({
        where: { createdAt: { gte: startOfMonth } },
        select: { path: true, username: true, action: true, device: true, createdAt: true }
      })

      // Generar Top 10 Rutas
      const pathCounts: Record<string, number> = {}
      logs.forEach(l => { pathCounts[l.path] = (pathCounts[l.path] || 0) + 1 })
      const topRoutes = Object.keys(pathCounts)
        .map(p => ({ path: p, views: pathCounts[p] }))
        .sort((a,b) => b.views - a.views)
        .slice(0, 10)

      // Generar Top 10 Usuarios (por numero de acciones)
      const userCounts: Record<string, number> = {}
      logs.forEach(l => { 
        if (l.username) userCounts[l.username] = (userCounts[l.username] || 0) + 1 
      })
      const topUsers = Object.keys(userCounts)
        .map(u => ({ username: u, actions: userCounts[u], sessions: Math.ceil(userCounts[u]/5) }))
        .sort((a,b) => b.actions - a.actions)
        .slice(0, 10)

      // Extras: Device stats y Errores
      const totalDesktops = logs.filter(l => l.device === 'DESKTOP').length
      const totalMobiles = logs.filter(l => l.device === 'MOBILE').length
      const errorsAndDeletes = Object.entries(
        logs.filter(l => l.action === 'ERROR' || l.action === 'DELETE')
        .reduce((acc, log) => {
          let name = log.username || 'Anonimo';
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5)

      // Picos horarios (Top 10 horas)
      const hourCounts: Record<string, number> = {}
      logs.forEach(l => {
        const h = new Date(l.createdAt).getHours()
        const hourLabel = `${h.toString().padStart(2, '0')}:00`
        hourCounts[hourLabel] = (hourCounts[hourLabel] || 0) + 1
      })
      const horary = Object.keys(hourCounts)
        .map(h => ({ name: h, value: hourCounts[h] }))
        .sort((a,b) => a.name.localeCompare(b.name))

      return NextResponse.json({
        success: true,
        type: 'CURRENT',
        topRoutes,
        topUsers,
        devices: { desktop: totalDesktops, mobile: totalMobiles },
        errorsAndDeletes,
        horary
      })
    }

    // MODO HISTÓRICO: Rescatar directo de las tablas ultrarápidas guardadas por código cron
    const month = parseInt(monthStr, 10)
    const year = parseInt(yearStr, 10)

    const topRoutesHist = await prisma.topRouteHistory.findMany({
      where: { month, year },
      orderBy: { views: 'desc' },
      take: 10
    })

    const topUsersHist = await prisma.topUserHistory.findMany({
      where: { month, year },
      orderBy: { actions: 'desc' },
      take: 10
    })

    return NextResponse.json({
      success: true,
      type: 'HISTORICAL',
      topRoutes: topRoutesHist,
      topUsers: topUsersHist,
    })

  } catch (error) {
    console.error('Error fetching tracking history:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
