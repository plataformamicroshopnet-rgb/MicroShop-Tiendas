// ─────────────────────────────────────────────────────────────────────────────
// ¿QUIÉN PUEDE VER LOS MESES FUTUROS? — port del cerrojo de FFVV a Tiendas.
//
// MOTIVO DE NEGOCIO (del dueño, el mismo que en FFVV): si los comerciales ven
// los objetivos y las condiciones de los meses por venir (los WorkPeriod en
// DRAFT posteriores al mes en vigor), pueden guardarse ventas para el mes que
// más les convenga. Por eso los periodos POSTERIORES al ACTIVE solo los ven
// los roles de mando de Tiendas: ADMIN, JEFE_TIENDAS y DIRECCION (los mismos
// tres que ya ven el hub Cambio de Mes en /api/salud-mes). El mes activo y los
// pasados los ve todo el mundo como siempre.
//
// Los feeds servidor-a-servidor del ERP (cabecera x-prv-secret) no se tocan:
// cada ruta comprueba el secreto antes que nada y esos siguen pasando.
// ─────────────────────────────────────────────────────────────────────────────

export interface PeriodoYM {
  year: number
  month: number
}

/** ¿El periodo es POSTERIOR al activo? Si no hay activo conocido, nada se considera futuro. */
export function esFuturo(periodo: PeriodoYM, activo: PeriodoYM | null | undefined): boolean {
  if (!activo) return false
  if (periodo.year !== activo.year) return periodo.year > activo.year
  return periodo.month > activo.month
}

/** ¿Esta sesión puede ver los periodos futuros? Los tres roles de mando de Tiendas. */
export function sesionPuedeVerFuturo(user: any): boolean {
  const role = String(user?.role || '').toUpperCase()
  return role === 'ADMIN' || role === 'JEFE_TIENDAS' || role === 'DIRECCION'
}
