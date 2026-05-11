const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🏁 Iniciando proceso mensual de cierre de Trazabilidad...')

  // 1. Determinar el mes a "cerrar" (el mes pasado)
  const now = new Date()
  let targetMonth = now.getMonth() // Va de 0 a 11, así que el actual es getMonth(), pero queremos el anterior. Wait, si es enero (0), el pasado es diciembre (11)
  let targetYear = now.getFullYear()

  if (targetMonth === 0) {
    targetMonth = 12 // Guardaremos los meses del 1 al 12
    targetYear -= 1
  }
  // En Prisma buscaremos el mes pasado basado en las fechas RAW
  
  // Vamos a usar una aproximación manual: busquemos todas las actividades para compilar
  // En este diseño: vamos a calcular las de "Hace entre 31 y 1 días"
  const startOfPreviousMonth = new Date(targetYear, targetMonth - 1, 1) // targetMonth es ej 1-12. Así que targetMonth - 1 es para 0-index.
  const endOfPreviousMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999)

  console.log(`Cerrando mes: ${targetMonth}/${targetYear} (Rango: ${startOfPreviousMonth.toISOString()} a ${endOfPreviousMonth.toISOString()})`)

  // Asegurarnos que haya algo que procesar
  const totalLogs = await prisma.userActivity.count({
    where: {
      createdAt: {
        gte: startOfPreviousMonth,
        lte: endOfPreviousMonth
      }
    }
  })

  if (totalLogs === 0) {
    console.log('✅ No hay logs de actividad para el mes pasado. Fin del script.')
    process.exit(0)
  }

  console.log(`📊 Encontrados ${totalLogs} registros en bruto. Compactando...`)

  // --- TOP RUTAS ---
  const routesGroups = await prisma.userActivity.groupBy({
    by: ['path'],
    where: {
      createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth }
    },
    _count: { path: true },
    orderBy: { _count: { path: 'desc' } },
    take: 10
  })

  for (const r of routesGroups) {
    await prisma.topRouteHistory.upsert({
      where: { month_year_path: { month: targetMonth, year: targetYear, path: r.path } },
      update: { views: r._count.path },
      create: { month: targetMonth, year: targetYear, path: r.path, views: r._count.path }
    })
  }

  // --- TOP USUARIOS ---
  const usersGroups = await prisma.userActivity.groupBy({
    by: ['username'],
    where: {
      createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth }
    },
    _count: { action: true }, // Acciones totales
    orderBy: { _count: { action: 'desc' } },
    take: 10
  })

  // Para sesiones podríamos hacer agrupaciones complejas nativas, pero vamos a estimarlas (ej 1 sesión cada 10 clics para este reporting rústico, o contar distinct days)
  // En sqlite distinct no es tan facil en groupby de prisma, así que tomamos actions
  for (const u of usersGroups) {
    let estimatedSessions = Math.ceil(u._count.action / 5) // roughly
    await prisma.topUserHistory.upsert({
      where: { month_year_username: { month: targetMonth, year: targetYear, username: u.username || 'Anonimo' } },
      update: { actions: u._count.action, sessions: estimatedSessions },
      create: { month: targetMonth, year: targetYear, username: u.username || 'Anonimo', actions: u._count.action, sessions: estimatedSessions }
    })
  }

  console.log('💾 Historial congelado guardado en base de datos. Procediendo a purgar datos obsoletos...')

  // --- PURGAR VIEJOS (> 45 días) ---
  const fortyFiveDaysAgo = new Date()
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45)

  const deleted = await prisma.userActivity.deleteMany({
    where: {
      createdAt: { lt: fortyFiveDaysAgo }
    }
  })

  console.log(`🗑️ Purgados ${deleted.count} registros antiguos en bruto. Base de datos optimizada.`)
  console.log('🚀 Finalizado con éxito.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
