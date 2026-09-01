import { PrismaClient } from '@prisma/client'
import { recalcularObjetivosDePalanca, recalcularObjetivosTerritorial } from '@/lib/objetivosPalanca'

/**
 * LOS OBJETIVOS SE PONEN AL DÍA SOLOS AL ARRANCAR.
 *
 * EL PROBLEMA (dueño, 01-sep-2026: «quedamos que se hacía automático»).
 * Los objetivos del Excel de Telefónica llegan del ERP al feed
 * `/api/tramitacion-objetivos`, que además de guardarlos por tienda recalcula
 * los de PALANCA y los del TERRITORIAL. Ese feed se dispara desde el ERP: al
 * guardar el Excel y en su pasada diaria (y al arrancar el ERP).
 *
 * PERO EL ERP NO SE ENTERA DE QUE TIENDAS SE HA DESPLEGADO. El 1-sep-2026 pasó
 * exactamente eso: el dueño subió el Excel, el feed corrió y dejó bien los
 * objetivos por tienda y los de palanca… y horas después se desplegó AQUÍ el
 * recálculo del Territorial (commit eb8206d). Como el ERP no se reinició, nadie
 * volvió a publicar, y el Dashboard siguió enseñando los objetivos de agosto
 * (BAF Total 102 en vez de 115, Convergente 67 en vez de 71, Repos 161 en vez
 * de 144) hasta la pasada de las 05:00 del día siguiente.
 *
 * LA SOLUCIÓN: no depender del ERP para esto. Los objetivos por tienda YA ESTÁN
 * en esta base (`TiendaStoreObjective`); lo único que faltaba era volver a
 * derivar de ellos las palancas y el Territorial. Eso se puede hacer aquí solo,
 * en cada arranque, sin pedirle nada a nadie.
 *
 * SOLO DEL MES EN CURSO EN ADELANTE: un mes ya cerrado no se toca ni para bien.
 * Las dos funciones son idempotentes —con los mismos objetivos por tienda
 * escriben siempre lo mismo—, así que repetirlo en cada despliegue es inofensivo.
 */
export async function fixObjetivosAlDia() {
  const prisma = new PrismaClient()
  try {
    // El mes de HOY en Madrid, que es el reloj con el que trabaja la casa.
    const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
    const mesActual = `${hoy.getFullYear()}_${String(hoy.getMonth() + 1).padStart(2, '0')}`

    // Meses con objetivos por tienda cargados, del actual en adelante.
    const filas = await prisma.tiendaStoreObjective.findMany({
      where: { periodKey: { gte: mesActual } },
      select: { periodKey: true },
      distinct: ['periodKey'],
    })
    const meses = filas.map(f => f.periodKey).sort()
    if (meses.length === 0) {
      console.log('[objetivosAlDia] sin objetivos por tienda de %s en adelante: nada que hacer', mesActual)
      return
    }

    for (const mes of meses) {
      const pal = await recalcularObjetivosDePalanca(prisma, mes)
      const ter = await recalcularObjetivosTerritorial(prisma, mes)
      if (pal.length === 0 && ter.length === 0) {
        console.log('[objetivosAlDia] %s ya estaba al día', mes)
        continue
      }
      const di = (c: { palanca: string; antes: number; ahora: number }) =>
        `${c.palanca} ${c.antes}→${c.ahora}`
      console.log('[objetivosAlDia] %s puesto al día · palancas: %s · territorial: %s',
        mes,
        pal.length ? pal.map(di).join(' · ') : 'sin cambios',
        ter.length ? ter.map(di).join(' · ') : 'sin cambios')
    }
  } catch (e: any) {
    // Nunca tumba el arranque de la aplicación.
    console.error('[objetivosAlDia] aviso:', e?.message || e)
  } finally {
    await prisma.$disconnect().catch(() => { })
  }
}
