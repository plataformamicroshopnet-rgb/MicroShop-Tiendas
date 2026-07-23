import { PrismaClient } from '@prisma/client'

// ─── Parche de datos (jul-2026, regla del dueño transmitida por O2) ──────────
// Las «Fibra Adicional …» NO cuentan ni para los bonos territoriales O2
// (mensual/trimestral) ni para la palanca personal «Altas/Portas Fibra» de
// Marta: se pagan por su propia comisión («Internas Fibra» a 3 €/ud, cuya
// lista NO se toca — sus «Interna Fibra Adicional …» son nombres distintos).
//
// La configuración vive en AppSetting (territorial_o2_{mes} con `tipoVenta` y
// o2_rules_v2_{mes} con `productosCuentan`, listas separadas por comas) y solo
// se puede corregir en producción, así que este parche corre al ARRANCAR
// (instrumentation.ts). Es idempotente: cuando ya no queda nada que quitar,
// no escribe. Meses afectados: junio y julio de 2026 (el clonado de periodos
// arrastró la lista); los meses nuevos se crean ya sin las adicionales.

const MESES = ['2026_06', '2026_07']
const QUITAR = new Set([
  'fibra adicional 1 gb',
  'fibra adicional 300 mb',
  'fibra adicional 600 mb',
])

function limpiaLista(valor: unknown): { nuevo: string; quitados: number } | null {
  if (typeof valor !== 'string' || !valor.trim()) return null
  const partes = valor.split(',').map(p => p.trim()).filter(Boolean)
  const filtradas = partes.filter(p => !QUITAR.has(p.toLowerCase()))
  if (filtradas.length === partes.length) return null
  return { nuevo: filtradas.join(', '), quitados: partes.length - filtradas.length }
}

export async function runO2AdicionalesFix() {
  const prisma = new PrismaClient()
  try {
    for (const mes of MESES) {
      // Bono territorial (mensual + trimestral): reglas con `tipoVenta`
      const tKey = `territorial_o2_${mes}`
      const t = await prisma.appSetting.findUnique({ where: { key: tKey } })
      if (t?.value) {
        try {
          const reglas = JSON.parse(t.value)
          let quitados = 0
          if (Array.isArray(reglas)) {
            for (const r of reglas) {
              const res = limpiaLista(r?.tipoVenta)
              if (res) { r.tipoVenta = res.nuevo; quitados += res.quitados }
            }
          }
          if (quitados > 0) {
            await prisma.appSetting.update({
              where: { key: tKey },
              data: { value: JSON.stringify(reglas) },
            })
            console.log(`[o2-fix] ${tKey}: quitadas ${quitados} Fibra Adicional del bono`)
          }
        } catch (e) {
          console.error(`[o2-fix] ${tKey}: JSON ilegible, sin tocar`, e)
        }
      }

      // Palancas personales: solo «Altas/Portas …» (las «Internas Fibra» se
      // conservan — sus adicionales cobran los 3 €/ud y sus nombres empiezan
      // por «Interna», que no está en la lista a quitar).
      const oKey = `o2_rules_v2_${mes}`
      const o = await prisma.appSetting.findUnique({ where: { key: oKey } })
      if (o?.value) {
        try {
          const data = JSON.parse(o.value)
          let quitados = 0
          for (const r of data?.rules ?? []) {
            const res = limpiaLista(r?.productosCuentan)
            if (res) { r.productosCuentan = res.nuevo; quitados += res.quitados }
          }
          if (quitados > 0) {
            await prisma.appSetting.update({
              where: { key: oKey },
              data: { value: JSON.stringify(data) },
            })
            console.log(`[o2-fix] ${oKey}: quitadas ${quitados} Fibra Adicional de Altas/Portas`)
          }
        } catch (e) {
          console.error(`[o2-fix] ${oKey}: JSON ilegible, sin tocar`, e)
        }
      }
    }
  } catch (e) {
    console.error('[o2-fix] error no fatal, la app arranca igual:', e)
  } finally {
    await prisma.$disconnect()
  }
}
