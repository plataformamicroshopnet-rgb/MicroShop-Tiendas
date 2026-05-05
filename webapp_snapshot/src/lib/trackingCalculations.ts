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
