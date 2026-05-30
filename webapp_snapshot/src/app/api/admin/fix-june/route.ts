import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const source = await prisma.workPeriod.findUnique({
      where: { period_key: '2026_05' },
      include: { catalogs: true }
    });
    if (!source) return NextResponse.json({ success: false, error: 'Source 2026_05 not found' });

    const target = await prisma.workPeriod.findUnique({
      where: { period_key: '2026_06' },
      include: { catalogs: true }
    });
    if (!target) return NextResponse.json({ success: false, error: 'Target 2026_06 not found' });

    const logs = [];

    // Fix TiendaCommissionRule
    const sourceRules = await prisma.tiendaCommissionRule.findMany({ where: { periodKey: source.period_key } });
    if (sourceRules.length > 0) {
      await prisma.tiendaCommissionRule.deleteMany({ where: { periodKey: target.period_key } });
      await prisma.tiendaCommissionRule.createMany({
        data: sourceRules.map(r => ({
          periodKey: target.period_key,
          nombre: r.nombre,
          productosCuentan: r.productosCuentan,
          objPrimerTramo: r.objPrimerTramo,
          importePrimerTramo: r.importePrimerTramo,
          objSegundoTramo: r.objSegundoTramo,
          importeSegundoTramo: r.importeSegundoTramo,
          condicionantes: r.condicionantes,
          totalHoras: r.totalHoras
        }))
      });
      logs.push('Fixed TiendaCommissionRule for 2026_06');
    }

    // Fix TiendaComercialHour
    const sourceHours = await prisma.tiendaComercialHour.findMany({ where: { periodKey: source.period_key } });
    if (sourceHours.length > 0) {
      await prisma.tiendaComercialHour.deleteMany({ where: { periodKey: target.period_key } });
      await prisma.tiendaComercialHour.createMany({
        data: sourceHours.map(h => ({
          periodKey: target.period_key,
          comercial: h.comercial,
          horario: h.horario
        }))
      });
      logs.push('Fixed TiendaComercialHour for 2026_06');
    }

    // Fix AppSettings
    const keysToCopy = [
      `territorial_tiendas_${source.period_key}`,
      `territorial_o2_${source.period_key}`,
      `o2_rules_v2_${source.period_key}`
    ];
    for (const oldKey of keysToCopy) {
      const setting = await prisma.appSetting.findUnique({ where: { key: oldKey } });
      if (setting) {
        const newKey = oldKey.replace(source.period_key, target.period_key);
        await prisma.appSetting.upsert({
          where: { key: newKey },
          update: { value: setting.value },
          create: { key: newKey, value: setting.value }
        });
        logs.push('Fixed AppSetting: ' + newKey);
      }
    }

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error('Error in fix-june:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
