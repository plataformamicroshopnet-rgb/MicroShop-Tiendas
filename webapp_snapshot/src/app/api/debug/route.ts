import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { sanitizeSale } from '@/lib/salesUtils';

const prisma = new PrismaClient();

// Helper to match Salamanca holidays
const isHoliday = (y: number, m: number, d: number) => {
    if (m === 1 && (d === 1 || d === 6)) return true;
    if (m === 4 && d === 23) return true;
    if (m === 5 && d === 1) return true;
    if (m === 6 && d === 12) return true; // San Juan de Sahagún
    if (m === 8 && d === 15) return true;
    if (m === 9 && d === 8) return true;  // Virgen de la Vega
    if (m === 10 && d === 12) return true;
    if (m === 11 && d === 1) return true;
    if (y === 2026 && m === 11 && d === 2) return true;
    if (y === 2025 && m === 10 && d === 13) return true;
    if (m === 12 && (d === 6 || d === 8 || d === 25)) return true;
    if (y === 2026 && m === 12 && d === 7) return true;
    if (y === 2025 && m === 4 && (d === 17 || d === 18)) return true;
    if (y === 2026 && m === 4 && (d === 2 || d === 3)) return true;
    return false;
};

// Días laborables en el mes
const getWorkingDaysInMonth = (y: number, m: number) => {
    let days = 0;
    const date = new Date(y, m - 1, 1);
    while (date.getMonth() === m - 1) {
        const dayOfWeek = date.getDay();
        const dayOfMonth = date.getDate();
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(y, m, dayOfMonth)) {
            days++;
        }
        date.setDate(date.getDate() + 1);
    }
    return days;
};

// Días laborables hasta hoy
const calcularDiasLaborablesHastaHoy = (y: number, m: number) => {
    const today = new Date();
    const targetIsPast = (today.getFullYear() > y) || (today.getFullYear() === y && today.getMonth() > m - 1);

    let lastDayToCount = new Date(y, m, 0).getDate();
    if (!targetIsPast && today.getFullYear() === y && today.getMonth() === m - 1) {
        lastDayToCount = today.getDate();
    }

    let elapsed = 0;
    for (let d = 1; d <= lastDayToCount; d++) {
        const dt = new Date(y, m - 1, d);
        const dayOfWeek = dt.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday(y, m, d)) {
            elapsed++;
        }
    }
    return elapsed;
};

export async function GET() {
  const diagnostics: any = {};
  diagnostics.steps = [];

  try {
    const activePeriodKey = "2026_06";
    const prevYearKey = "2025_06";
    const [yearStr, monthStr] = activePeriodKey.split('_');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const logStep = (name: string, fn: () => any) => {
      const start = Date.now();
      const res = fn();
      diagnostics.steps.push({ name, timeMs: Date.now() - start });
      return res;
    };

    const logStepAsync = async (name: string, fn: () => Promise<any>) => {
      const start = Date.now();
      const res = await fn();
      diagnostics.steps.push({ name, timeMs: Date.now() - start });
      return res;
    };

    // 1. Fetching Sales for current and previous period
    const currSales = await logStepAsync("fetchCurrentSales", () => prisma.sale.findMany({
      where: {
        OR: [
          { period: { period_key: activePeriodKey } },
          { fecha: { contains: `/06/2026` } }
        ]
      }
    }));

    const prevSales = await logStepAsync("fetchPreviousSales", () => prisma.sale.findMany({
      where: {
        OR: [
          { period: { period_key: prevYearKey } },
          { fecha: { contains: `/06/2025` } }
        ]
      }
    }));

    // 2. Fetch Catalogs
    const catalogs = await logStepAsync("fetchCatalogs", () => prisma.productCatalog.findMany());

    // 3. Fetch Configs for both periods
    const getPeriodConfigs = async (periodKey: string) => {
      const wp = await prisma.workPeriod.findUnique({ where: { period_key: periodKey } });
      if (!wp) return [ { objetivos: {} }, [], [], [] ];
      
      const objectives = await prisma.objective.findMany({ where: { periodId: wp.id } });
      const pyme = await prisma.importePyme.findMany({ where: { periodId: wp.id } });
      const plus = await prisma.importePlus.findMany({ where: { periodId: wp.id } });
      const assignments = await prisma.extraAssignment.findMany({ where: { periodId: wp.id } });
      return [ { objectives }, pyme, plus, assignments ];
    };

    const currConfigs = await logStepAsync("fetchCurrentConfigs", () => getPeriodConfigs(activePeriodKey));
    const prevConfigs = await logStepAsync("fetchPreviousConfigs", () => getPeriodConfigs(prevYearKey));

    // 4. Fetch Periods
    const periods = await logStepAsync("fetchPeriods", () => prisma.workPeriod.findMany());

    // 5. Run processMetrics simulation
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const processMetricsDryRun = (salesListRaw: any[], configs: any[], y: number, m: number) => {
      const [objData, pymeData, plusData, extrasData] = configs;
      const salesList = salesListRaw.map(sanitizeSale);

      const stats = Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1,
          dayOfWeek: ['D', 'L', 'M', 'X', 'J', 'V', 'S'][new Date(y, m - 1, i + 1).getDay()],
          isWeekend: [0, 6].includes(new Date(y, m - 1, i + 1).getDay()),
          ops: 0,
          importe: 0,
          accumOps: 0,
          accumImporte: 0
      }));

      salesList.forEach((sale: any) => {
          if (sale.pendiente === 'Anulado' || sale.anulado === 'Si') return;
          let saleDay = -1;
          if (sale.fecha) {
              const match = String(sale.fecha).match(/^(\d{1,2})\//);
              if (match) saleDay = parseInt(match[1], 10);
          }
          if (saleDay >= 1 && saleDay <= daysInMonth) {
              stats[saleDay - 1].ops += 1;
          }
      });

      const workingDaysElapsed = calcularDiasLaborablesHastaHoy(y, m);
      const effectiveDays = workingDaysElapsed || 1;
      const totalWorkingDaysInMonth = getWorkingDaysInMonth(y, m);
      const totalOps = salesList.filter(s => s.pendiente !== 'Anulado' && s.anulado !== 'Si').length;

      return {
          totalOps,
          mediaOpsDiaria: totalOps / effectiveDays,
          estOps: (totalOps / effectiveDays) * totalWorkingDaysInMonth,
          workingDaysElapsed
      };
    };

    const currMetrics = logStep("processMetricsCurrent", () => processMetricsDryRun(currSales, currConfigs, year, month));
    const prevMetrics = logStep("processMetricsPrevious", () => processMetricsDryRun(prevSales, prevConfigs, year - 1, month));

    diagnostics.success = true;
    diagnostics.metrics = {
      currMetrics,
      prevMetrics
    };
    
    // Check SQLite optimization and WAL checkpoint clean
    await prisma.$queryRawUnsafe('PRAGMA optimize');

    return NextResponse.json(diagnostics);

  } catch (e: any) {
    diagnostics.success = false;
    diagnostics.error = String(e);
    diagnostics.stack = e.stack;
    return NextResponse.json(diagnostics, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    fs.writeFileSync('c:/Proyecto Tiendas/MicroShop Tiendas/webapp_snapshot/debug_paste.txt', body.text);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
