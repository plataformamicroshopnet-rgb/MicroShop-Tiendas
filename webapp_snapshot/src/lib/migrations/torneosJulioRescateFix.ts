import { PrismaClient } from '@prisma/client'

// RESCATE DE LOS TORNEOS DE JULIO-2026 (31-ago-2026, el dueño: «tienes que
// reconstruir en Julio el Torneo de Dispositivos + Seguros y el de Seguros que
// estaba ya finalizado, que se ha borrado entero por error»).
//
// QUÉ PASÓ. Hasta que llegó la configuración POR MES, los torneos vivían todos
// en UNA sola clave global, `torneos_config`. Los de julio estaban ahí. Cuando
// se montó el torneo de agosto («Altas BAF Movistar Conv.», 24-31 de agosto) se
// guardó encima de esa clave global y los dos de julio desaparecieron: no había
// todavía una `torneos_config_2026_07` donde quedaran a salvo. Por eso julio
// aparece hoy sin torneos y agosto sí los tiene.
//
// DE DÓNDE SALE LO QUE SE REPONE. De la copia de seguridad del QNAP del
// 1-agosto-2026 a las 10:00 (MicroShop_Tiendas_Backup_20260801_1000.zip), que
// es la última que aún tenía la clave global con los torneos de julio dentro.
// Se copia TAL CUAL estaba, sin retocar ni un importe:
//   · «Dispositivos + Seguros» — se mide por IMPORTE (€ vendidos)
//   · «Seguros (Dispositivo, Smartphone y Tablet)» — se mide por NÚMERO de ventas
//   Los dos, a podio: 1º 100 € · 2º 75 € · 3º 50 €.
//
// El formato es el ANTIGUO (solo nombre, tipo de venta, métrica y premios) y no
// hay que traducirlo: `parseTorneosConfig` rellena lo que falta con los valores
// de siempre — sin fechas, el torneo vale para el mes entero, y sin `premioModo`
// se lee como PODIO, que es exactamente lo que era.
//
// Solo escribe si la clave NO existe: si algún día el dueño rehace los torneos
// de julio a mano, esto no se los pisa.

const CLAVE = 'torneos_config_2026_07'

const CONFIG_JULIO = {
  concursos: [
    {
      id: 'c1',
      nombre: 'Dispositivos + Seguros',
      tipoVenta: 'Dispositivos + Seguros',
      metrica: 'importe',
      premios: [
        { pos: 1, importe: 100, texto: '' },
        { pos: 2, importe: 75, texto: '' },
        { pos: 3, importe: 50, texto: '' },
      ],
    },
    {
      id: 'c2',
      nombre: 'Seguros (Dispositivo, Smartphone y Tablet)',
      tipoVenta: 'Seguro',
      metrica: 'count',
      premios: [
        { pos: 1, importe: 100, texto: '' },
        { pos: 2, importe: 75, texto: '' },
        { pos: 3, importe: 50, texto: '' },
      ],
    },
  ],
}

export async function fixTorneosJulioRescate() {
  const prisma = new PrismaClient()
  try {
    const ya = await prisma.appSetting.findUnique({ where: { key: CLAVE } })
    if (ya) {
      console.log('[torneosJulio] julio ya tiene torneos — no se toca')
      return
    }
    await prisma.appSetting.create({
      data: { key: CLAVE, value: JSON.stringify(CONFIG_JULIO) },
    })
    console.log('[torneosJulio] rescatados los 2 torneos de julio-2026 de la copia del 1-ago')
  } catch (e) {
    console.error('[torneosJulio] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
