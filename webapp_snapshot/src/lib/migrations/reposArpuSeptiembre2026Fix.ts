import { PrismaClient } from '@prisma/client'
import { claveFactoresRepoArpu, leeFactoresRepoArpu, FactoresRepoArpu } from '../salesUtils'

// LOS MULTIPLICADORES «X» DE LA PESTAÑA REPOS (ARPU) DE SEPTIEMBRE-2026
// (02-sep-2026, el dueño: «corrige los X de los Repos Arpu de la tarifa de
// septiembre, están puestos los de agosto»).
//
// El comunicado Nacional de septiembre (OFE_PDV_035) cambia la tabla entera del
// repo de ARPU y mueve el corte:
//     agosto:      ∆ARPU >= 10 € → ×2      · < 10 € → ×1,5
//     septiembre:  ∆ARPU >= 35 € → ×1,25   · el resto → ×1
// septiembre2026Fix guardó esa tabla en `repo_arpu_factores_2026_09`, pero solo
// la lee el producto de importe a mano («Reposicionamientos destino BAF…»). Las
// otras 24 filas de la pestaña —Fútbol Total, Netflix, Movistar+, Disney…— llevan
// el multiplicador en la propia fila (`comisionConCoste`, que NO son euros: es
// la X) y al clonar el mes vinieron con los de agosto: ×2 desde 10 € y ×1,5 por
// debajo. Nueva Venta multiplica con esa X al grabar y la deja escrita en la
// cuota, así que desde el día 1 se estaban grabando repos de septiembre con los
// precios de agosto (7 Fútbol Total a 78 € en vez de 48,75 €).
//
// LO QUE HACE (solo en el mes 2026_09, idempotente):
//  1) Cada fila de «Repos UP» con ∆ARPU (`comision`) y X de agosto (2 o 1,5)
//     pasa a la X de septiembre según su ∆ARPU: >= 35 € → 1,25 · < 35 € → 1.
//     Una X que ya no sea 2 ni 1,5 se respeta (la tocó alguien a mano).
//  2) Las cuatro filas retiradas «Repos … incremento de ARPU …» (por tramos)
//     también, por coherencia: el tramo «=> 35€» a 1,25 y los otros tres a 1.
//  3) Las ventas de septiembre de esos productos que se grabaron con la X vieja
//     (cuota == ∆ARPU × X vieja, al céntimo) se re-estampan con la nueva y dejan
//     rastro en anotaciones. Un importe que no case con la tarifa vieja es un
//     precio a mano y no se toca (mismo criterio que /api/catalogs/reprice).
//     Los repos plegados dentro de un alta (venta conjunta) van con el
//     multiplicador del alta y no pasan por aquí.
//
// Los multiplicadores salen de la tabla del mes (AppSetting), no de números
// escritos aquí: si el dueño la cambia, esta corrección sigue la tabla.

const MES = '2026_09'
const TABLA_SEPT: FactoresRepoArpu = { corte: 35, alto: 1.25, bajo: 1 }

const aNum = (v: any): number => {
  const t = String(v ?? '').replace(',', '.').trim()
  if (!t || t === '-') return NaN
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}
const esXDeAgosto = (x: number) => Math.abs(x - 2) < 1e-9 || Math.abs(x - 1.5) < 1e-9
const fmtX = (x: number) => x.toFixed(2)
const r2 = (n: number) => Math.round(n * 100) / 100
const norm = (s: any) => String(s ?? '').trim().toLowerCase()

export async function fixReposArpuSeptiembre2026() {
  const prisma = new PrismaClient()
  try {
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: MES } })
    if (!wp) { console.log('[repos arpu sept] el mes', MES, 'no existe todavía: no se toca nada'); return }

    const cfg = await prisma.appSetting.findUnique({ where: { key: claveFactoresRepoArpu(MES) } })
    const f = cfg?.value ? leeFactoresRepoArpu(cfg.value) : TABLA_SEPT
    const xPara = (deltaArpu: number) => (deltaArpu >= f.corte ? f.alto : f.bajo)

    // ── 1 · la pestaña Repos (Arpu): la X por el ∆ARPU de cada fila ──────────
    type Cambio = { producto: string; com: number; xVieja: number; xNueva: number }
    const cambios: Cambio[] = []
    const filas = await prisma.productCatalog.findMany({ where: { periodId: wp.id, categoria: 'Repos UP' } })
    for (const fila of filas) {
      const com = aNum(fila.comision), xVieja = aNum(fila.comisionConCoste)
      if (!Number.isFinite(com) || com <= 0) continue          // el producto de importe a mano («-») y filas a 0
      if (!Number.isFinite(xVieja) || !esXDeAgosto(xVieja)) continue // X vacía o ya tocada a mano: se respeta
      const xNueva = xPara(com)
      if (Math.abs(xNueva - xVieja) < 1e-9) continue
      await prisma.productCatalog.update({ where: { id: fila.id }, data: { comisionConCoste: fmtX(xNueva) } })
      cambios.push({ producto: String(fila.producto), com, xVieja, xNueva })
    }

    // ── 2 · las cuatro filas retiradas por tramos de ARPU ─────────────────────
    const retiradas = await prisma.productCatalog.findMany({
      where: { periodId: wp.id, categoria: 'Repos', producto: { contains: 'incremento de ARPU' } },
    })
    let retiradasCambiadas = 0
    for (const fila of retiradas) {
      const xVieja = aNum(fila.comisionConCoste)
      if (!Number.isFinite(xVieja) || !esXDeAgosto(xVieja)) continue
      const nombre = norm(fila.producto)
      const esTramoAlto = nombre.includes('=> 35') || nombre.includes('>= 35') || nombre.includes('=>35') || nombre.includes('>=35')
      const xNueva = esTramoAlto ? f.alto : f.bajo
      if (Math.abs(xNueva - xVieja) < 1e-9) continue
      await prisma.productCatalog.update({ where: { id: fila.id }, data: { comisionConCoste: String(xNueva) } })
      retiradasCambiadas++
    }

    // ── 3 · las ventas de septiembre grabadas con la X de agosto ──────────────
    let reestampadas = 0, respetadas = 0
    if (cambios.length > 0) {
      const porProducto = new Map(cambios.map(c => [norm(c.producto), c]))
      const ventas = await prisma.sale.findMany({
        where: { OR: [{ periodId: wp.id }, { fecha: { contains: '/09/2026' } }] },
        select: { id: true, producto: true, detalle: true, grupo: true, sheet: true, cuota: true, anulado: true, anotaciones: true, fecha: true },
      })
      for (const v of ventas) {
        if (norm(v.anulado) === 'si') continue
        const esRepo = norm(v.detalle) === 'repos up' || norm(v.grupo || v.sheet) === 'repos up'
        if (!esRepo) continue
        const c = porProducto.get(norm(v.producto))
        if (!c) continue
        const actual = Number(v.cuota)
        if (!Number.isFinite(actual) || actual === 0) continue
        const precioViejo = r2(c.com * c.xVieja), precioNuevo = r2(c.com * c.xNueva)
        if (Math.abs(actual - precioViejo) >= 0.005) { respetadas++; continue }   // precio a mano: no se toca
        const rastro = `Repreciado 02/09/2026: ${c.com.toFixed(2).replace('.', ',')} € × ${String(c.xNueva).replace('.', ',')} (antes × ${String(c.xVieja).replace('.', ',')}, comunicado de septiembre)`
        const notas = String(v.anotaciones || '').trim()
        await prisma.sale.update({
          where: { id: v.id },
          data: { cuota: precioNuevo, anotaciones: notas ? `${notas} · ${rastro}` : rastro },
        })
        reestampadas++
      }
    }

    if (cambios.length || retiradasCambiadas || reestampadas) {
      console.log(`[repos arpu sept] X corregidas en ${cambios.length} filas de Repos (Arpu) (${f.alto} desde ${f.corte} €, ${f.bajo} por debajo)` +
        ` · ${retiradasCambiadas} filas retiradas · ${reestampadas} ventas de septiembre re-estampadas · ${respetadas} con precio a mano respetadas`)
      for (const c of cambios) console.log(`   ${c.producto}: ${c.com} € × ${c.xVieja} → × ${c.xNueva}`)
    } else {
      console.log('[repos arpu sept] ya al día')
    }
  } catch (e: any) {
    console.error('[repos arpu sept] error (no bloquea el arranque):', e?.message || e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
