/**
 * Motor de cálculos financieros para el Seguimiento Diario de Jefatura.
 * Extrae la lógica pura matemática de React para garantizar precisión.
 */

export interface TrackingRowData {
  id: string;
  comercialName: string;
  objectiveMonth: number;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
}

export interface TrackingGroupData {
  id: string;
  name: string;
  rows: TrackingRowData[];
  pymeVal?: number | null;
  basicoVal?: number | null;
}

// -----------------------------------------------------
// CÁLCULOS A NIVEL DE FILA (COMERCIAL)
// -----------------------------------------------------

export function calculateRow(row: TrackingRowData) {
  const objectiveWeekly = row.objectiveMonth / 4;
  const totalReal = (row.week1 || 0) + (row.week2 || 0) + (row.week3 || 0) + (row.week4 || 0);
  const remaining = row.objectiveMonth - totalReal;
  // Se protege contra divisiones por 0
  const progressPercent = row.objectiveMonth > 0 ? (totalReal / row.objectiveMonth) : 0;

  return {
    objectiveWeekly,
    totalReal,
    remaining,
    progressPercent
  };
}

const SALAMANCA_HOLIDAYS = [
  // 2024
  '2024-01-01', '2024-01-06', '2024-03-28', '2024-03-29', '2024-04-23', '2024-05-01', '2024-06-12', '2024-08-15', '2024-09-09', '2024-10-12', '2024-11-01', '2024-12-06', '2024-12-25',
  // 2025
  '2025-01-01', '2025-01-06', '2025-04-17', '2025-04-18', '2025-04-23', '2025-05-01', '2025-06-12', '2025-08-15', '2025-09-08', '2025-10-12', '2025-11-01', '2025-12-06', '2025-12-08', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-06', '2026-04-02', '2026-04-03', '2026-04-23', '2026-05-01', '2026-06-12', '2026-08-15', '2026-09-08', '2026-10-12', '2026-11-02', '2026-12-08', '2026-12-25'
];

export function getMonthBusinessDays(year: number, month: number, upToDay?: number) {
  let days = 0;
  const endDay = upToDay ? Math.min(upToDay, new Date(year, month, 0).getDate()) : new Date(year, month, 0).getDate();

  for (let d = 1; d <= endDay; d++) {
    const date = new Date(year, month - 1, d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isHoliday = SALAMANCA_HOLIDAYS.includes(dateStr);

    if (!isWeekend && !isHoliday) {
      days++;
    }
  }
  return days;
}


/** ¿Es festivo en Salamanca? (usa el mismo calendario que getMonthBusinessDays) */
function esFestivoSalamanca(d: Date): boolean {
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return SALAMANCA_HOLIDAYS.includes(iso);
}

// ── Días laborables de un periodo YYYY_MM (L-V, DESCONTANDO los festivos de
// Salamanca — decisión del dueño: si la tienda cierra, ese día no puede
// repartirse el reto). Mismo calendario que el Seguimiento Diario de Jefatura
// (SALAMANCA_HOLIDAYS), así que las dos pantallas cuentan igual.

/** Laborables que QUEDAN del mes contando desde hoy (incluido). 0 si ya se cerró. */
export function getDiasLaborablesRestantes(periodKey: string, hoyRef?: Date): number {
  if (!periodKey) return 0;
  const [yStr, mStr] = String(periodKey).split(/[_-]/);
  const y = Number(yStr), m = Number(mStr); // m = 1..12
  if (!y || !m) return 0;
  const hoy = hoyRef ? new Date(hoyRef) : new Date(); hoy.setHours(0, 0, 0, 0);
  const finMes = new Date(y, m, 0);          // último día del mes
  const inicioMes = new Date(y, m - 1, 1);
  const cursor = new Date(Math.max(hoy.getTime(), inicioMes.getTime())); cursor.setHours(0, 0, 0, 0);
  if (cursor > finMes) return 0;             // mes ya cerrado: no hay reto diario que repartir
  let count = 0;
  for (const d = new Date(cursor); d <= finMes; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();                   // 0=dom, 6=sáb
    if (wd !== 0 && wd !== 6 && !esFestivoSalamanca(d)) count++;
  }
  return count;
}

/** Laborables TRANSCURRIDOS del mes, del día 1 hasta `hasta` (incluido). */
export function getDiasLaborablesHasta(periodKey: string, hasta: Date): number {
  if (!periodKey || !hasta) return 0;
  const [yStr, mStr] = String(periodKey).split(/[_-]/);
  const y = Number(yStr), m = Number(mStr);
  if (!y || !m) return 0;
  const finMes = new Date(y, m, 0);
  const tope = new Date(Math.min(new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate()).getTime(), finMes.getTime()));
  if (tope < new Date(y, m - 1, 1)) return 0; // la fecha es anterior al mes
  let count = 0;
  for (const d = new Date(y, m - 1, 1); d <= tope; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6 && !esFestivoSalamanca(d)) count++;
  }
  return count;
}

export function getPeriodBusinessDays(year: number, month: number) {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
  
  const totalBusinessDays = Math.max(1, getMonthBusinessDays(year, month));
  const passedBusinessDays = Math.max(1, isCurrentMonth ? getMonthBusinessDays(year, month, today.getDate()) : totalBusinessDays);

  return { totalBusinessDays, passedBusinessDays };
}

// -----------------------------------------------------
// CÁLCULOS A NIVEL DE GRUPO (MACRO)
// -----------------------------------------------------

export function calculateGroup(group: TrackingGroupData, year: number, month: number) {
  let groupTotalObjective = 0;
  let groupTotalReal = 0;

  group.rows.forEach(row => {
    groupTotalObjective += row.objectiveMonth || 0;
    groupTotalReal += (row.week1 || 0) + (row.week2 || 0) + (row.week3 || 0) + (row.week4 || 0);
  });

  const groupRemaining = groupTotalObjective - groupTotalReal;
  const groupProgressPercent = groupTotalObjective > 0 ? (groupTotalReal / groupTotalObjective) : 0;

  // Días laborables (Lunes a Viernes, descontando festivos de Salamanca)
  const { totalBusinessDays, passedBusinessDays } = getPeriodBusinessDays(year, month);

  // Déficit actual: Objetivo Mensual / Laborables Totales * Laborables Transcurridos - Total Ventas Acumuladas
  const expectedToday = (groupTotalObjective / totalBusinessDays) * passedBusinessDays;
  const currentDeficit = expectedToday - groupTotalReal;

  // Proyectamos Volumen: Total Ventas / Días Laborables Transcurridos * Días Laborables Totales del Mes
  const projectedEOM = (groupTotalReal / passedBusinessDays) * totalBusinessDays;
  
  // Proyectamos Éxito: Proyectamos Volumen / Objetivo Mensual
  const projectedPercent = groupTotalObjective > 0 ? (projectedEOM / groupTotalObjective) : 0;

  // Sistema de Puntuaciones por cumplimiento
  let points = 0;
  if (groupProgressPercent < 0.8) points = 0;
  else if (groupProgressPercent < 1.0) points = 1;
  else if (groupProgressPercent < 1.2) points = 2;
  else points = 4;

  return {
    groupTotalObjective,
    groupTotalReal,
    groupRemaining,
    groupProgressPercent,
    expectedToday,
    currentDeficit,
    projectedEOM,
    projectedPercent,
    points,
    totalBusinessDays,
    passedBusinessDays
  };
}
