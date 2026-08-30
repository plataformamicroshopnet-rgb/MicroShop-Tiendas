/**
 * EL LIBRILLO DE CADA PALANCA DE COMISIONES (icono ℹ del Panel).
 *
 * Petición del dueño (30-ago-2026): igual que en Territorial PDV, cada fila
 * de comisiones lleva un icono que explica QUÉ cuenta de verdad y CÓMO se
 * cobra — porque «corre el sentimiento entre los comerciales de que es muy
 * difícil cobrar: llega fin de mes, les sale un dinero, y a los tres meses no
 * cobran casi nada». La respuesta a ese sentimiento está aquí, escrita:
 * la cifra del panel es la foto de hoy, el cobro es N+3 tras re-verificar.
 *
 * ⚠️ MISMA REGLA QUE EL «OJO» (condicionantesTexto): los números salen de la
 * REGLA del mes, nunca escritos a mano. Si el dueño cambia un objetivo o un
 * importe, este texto cambia con él.
 */
import { textoCondicionantes } from './condicionantesTexto'

const num = (v: any) => {
  const n = Number(String(v ?? '').replace(/[€%\s]/g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}
const fmt = (v: any) => {
  const n = num(v)
  return n.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}
const esPct = (v: any) => String(v ?? '').includes('%')
const importeTxt = (v: any) => esPct(v) ? `el ${String(v).trim()} de tus €` : `${fmt(v)} € por unidad`

/** Lo que NO cuenta — la letra pequeña de exclusión de cada palanca, cuando
 *  la tiene (pedida por el dueño para el fútbol, 30-ago-2026). */
const QUE_NO_CUENTA: Record<string, string> = {
  'extra repos up destino fútbol': 'repos con un repo-down (bajada de valor) a ±20 días, en CUALQUIER canal; y los de origen LaLiga o Champions a destino Fútbol Total — eso no es subir. Además el cliente debe mantener el Fútbol Total activo el día 8 del segundo mes, o Telefónica lo tira.',
  'alta baf total': 'las altas con una baja de fibra en el domicilio a ±30 días (mismo titular o distinto): Telefónica las anula.',
  'alta baf convergente': 'las altas con baja a ±30 días; y si la fibra y el paquete van en pedidos DISTINTOS de Movistar, se degrada a fibra suelta.',
}

/** Traducción amable de lo que cuenta cada token del desplegable. Si un token
 *  no está en el mapa, se enseña tal cual (mejor literal que inventado). */
const QUE_CUENTA: Record<string, string> = {
  // OJO TRASLADOS (verificado con el TER, 30-ago-2026): Telefónica los PAGA
  // (×2 su cuota + 10 € de extra) pero NO los cuenta para el cumplimiento —
  // «se pagan pero no puntúan». Aquí pasa igual: no suman unidades.
  'alta baf total': 'las altas de fibra: miMovistar y Resto BAF. Los traslados NO puntúan aquí — se pagan aparte (×2 su cuota + 10 € de extra), pero no suman al objetivo',
  'alta baf convergente': 'las altas de miMovistar (fibra + paquete). La fibra sola (Resto BAF) NO, y los traslados tampoco puntúan (se pagan aparte)',
  'arpu': 'todos tus Repos (Arpu) en €: lo que sube la cuota del cliente. El repo de fútbol también suma aquí sus 78 €',
  'extra repos up destino fútbol': 'TU UNIDAD aquí es el repo de fútbol: la línea del extra que crea el programa, una por cliente. El OBJETIVO en cambio viene del cuadro COMPLETO del fútbol de Telefónica (TC1435): altas de miMovistar con Fútbol Total, Champions o LaLiga; altas de Fusión Bar; y los repos destino Fútbol Total, su pago único, Champions o LaLiga — por eso el número del objetivo es alto: lo alimenta todo el fútbol del mes. Las ORTI no rehechas en 15 días suman al objetivo',
  'dispositivos, seguro': 'los € de tus dispositivos (Rent y venta) y de tus seguros',
  'solución fttr': 'las altas de la fibra invisible (Solución FTTR)',
  'swap': 'los Swap (renove del terminal del cliente)',
  'movistar prosegur alarmas (venta asistida), movistar prosegur alarmas (venta en tienda)': 'las alarmas Movistar Prosegur: vendidas en tienda o asistidas',
}

export interface ExplicacionComision {
  titulo: string
  bloques: { etiqueta: string; texto: string }[]
}

export function explicaReglaComision(rule: any): ExplicacionComision {
  const bloques: { etiqueta: string; texto: string }[] = []
  const productos = String(rule?.productosCuentan || '').trim()
  const clave = productos.toLowerCase()
  const porHoras = num(rule?.totalHoras) > 0

  // ── qué cuenta ──
  bloques.push({
    etiqueta: 'QUÉ CUENTA',
    texto: QUE_CUENTA[clave] || `las ventas de: ${productos || rule?.nombre || 'esta palanca'}`,
  })
  if (QUE_NO_CUENTA[clave]) {
    bloques.push({ etiqueta: 'QUÉ NO CUENTA', texto: QUE_NO_CUENTA[clave] })
  }

  // ── el objetivo ──
  const obj1 = num(rule?.objPrimerTramo)
  if (obj1 > 0) {
    bloques.push({
      etiqueta: 'TU OBJETIVO',
      texto: porHoras
        ? `el equipo entero tiene ${fmt(rule.objPrimerTramo)}${esPct(rule?.importePrimerTramo) || obj1 > 200 ? ' €' : ''} este mes; el tuyo es TU PARTE según tus horas de la plantilla — es el número que ves en tu fila. A más horas, más objetivo y más premio en juego.`
        : `cada comercial tiene el suyo: ${fmt(rule.objPrimerTramo)}. No se reparte por horas.`,
    })
  }

  // ── qué paga ──
  const partes: string[] = []
  if (num(rule?.importePrimerTramo) > 0) {
    partes.push(`al llegar a tu objetivo: ${importeTxt(rule.importePrimerTramo)} — y cuentan TODAS las del mes, desde la primera, no solo las que pasan del objetivo`)
  }
  if (num(rule?.objSegundoTramo) > 0 && num(rule?.importeSegundoTramo) > 0) {
    // ¿el 2º tramo es de equipo? (condicionante REQUIRE_TEAM_OBJ2/23)
    let esEquipo2 = false
    try {
      const conds = JSON.parse(String(rule?.condicionantes || '[]'))
      esEquipo2 = Array.isArray(conds) && conds.some((c: any) =>
        c?.type === 'REQUIRE_TEAM_OBJ2' || c?.type === 'REQUIRE_TEAM_OBJ23')
    } catch { /* sin condicionantes */ }
    partes.push(`si ${esEquipo2 ? 'EL EQUIPO ENTERO llega' : 'llegas'} a ${fmt(rule.objSegundoTramo)}, sube a ${importeTxt(rule.importeSegundoTramo)} — también para todas`)
  }
  if (num(rule?.objTercerTramo) > 0 && num(rule?.importeTercerTramo) > 0) {
    partes.push(`y con ${fmt(rule.objTercerTramo)}, a ${importeTxt(rule.importeTercerTramo)}`)
  }
  if (partes.length > 0) bloques.push({ etiqueta: 'QUÉ PAGA', texto: partes.join('; ') + '.' })

  // ── las condiciones (el mismo texto que el OJO ámbar) ──
  for (const c of textoCondicionantes(rule)) {
    bloques.push({ etiqueta: 'CONDICIÓN', texto: c })
  }

  // ── el porqué del «me salía más a fin de mes» ──
  bloques.push({
    etiqueta: 'ASÍ SE COBRA',
    texto: 'lo que ves en el panel es la FOTO DE HOY. Antes de pagarse, cada venta se re-verifica contra '
      + 'lo que Telefónica liquida de verdad: las pendientes que no llegan a instalarse, las anuladas y lo '
      + 'mal tipificado SE CAEN — por eso la cifra de fin de mes puede bajar después. El mes se cobra el '
      + 'día 1 del cuarto mes (agosto → 1 de diciembre). La mejor defensa para que no se te caiga nada: '
      + 'nº de pedido bien puesto, el producto EXACTO y el cliente instalado.',
  })

  return { titulo: String(rule?.nombre || 'Palanca'), bloques }
}
