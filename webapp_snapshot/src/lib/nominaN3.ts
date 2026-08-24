// ── La regla N+3 del Pago de Comisiones (el ERP): el mes M se paga el 1 de M+4 ──
// Hasta ese día la nómina del mes vive EN BORRADOR y se re-verifica sola cada
// madrugada: una operación añadida tarde (Cristina, una olvidada de julio…)
// entra sola en la nómina de su mes, como si se hubiera tecleado en su día.
// A PARTIR de ese día la nómina es inmutable ('pagada' en el ERP): una venta
// nueva dejaría a Tiendas diciendo una cifra y al abonaré del ERP otra, sin
// ningún aviso en ningún lado. Por eso el alta en meses ya pagados se bloquea
// para todo el mundo (dueño, 25-ago-2026).

/** El día en que se paga (regla N+3) la nómina del mes de esa fecha. */
export function fechaPagoN3(fechaVenta: Date): Date {
  return new Date(fechaVenta.getFullYear(), fechaVenta.getMonth() + 4, 1)
}

/** true si la nómina del mes de `fechaVenta` ya está pagada a día de `hoy`. */
export function mesYaPagadoN3(fechaVenta: Date, hoy: Date = new Date()): boolean {
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  return h.getTime() >= fechaPagoN3(fechaVenta).getTime()
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** «julio 2026», para los mensajes. */
export function nombreMes(d: Date): string {
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}
