const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const source = await prisma.workPeriod.findUnique({
    where: { period_key: '2026_05' },
    include: { catalogs: true }
  });
  if (!source) return console.log('Source 2026_05 not found');

  const target = await prisma.workPeriod.findUnique({
    where: { period_key: '2026_06' },
    include: { catalogs: true }
  });
  if (!target) return console.log('Target 2026_06 not found');

  // Fix catalogs
  if (source.catalogs.length > 0) {
    await prisma.productCatalog.deleteMany({ where: { periodId: target.id } });
    const toInsert = source.catalogs.map(c => ({
      categoria: c.categoria,
      producto: c.producto,
      mensual: c.mensual,
      anual: c.anual,
      validFrom: c.validFrom,
      validTo: c.validTo,
      fabricante: c.fabricante,
      gama: c.gama,
      subcategoria: c.subcategoria,
      comision: c.comision,
      comisionConCoste: c.comisionConCoste,
      periodId: target.id
    }));
    await prisma.productCatalog.createMany({ data: toInsert });
    console.log('Fixed catalogs for 2026_06');
  }

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
    console.log('Fixed TiendaCommissionRule for 2026_06');
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
    console.log('Fixed TiendaComercialHour for 2026_06');
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
      console.log('Fixed AppSetting:', newKey);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
