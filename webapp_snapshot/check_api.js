const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function GET() {
  const queryPeriodKey = '2026_05';
  const strictPeriod = true;
  let records = [];

  if (queryPeriodKey && strictPeriod) {
    const wp = await prisma.workPeriod.findUnique({ where: { period_key: queryPeriodKey } });
    if (wp) {
      records = await prisma.productCatalog.findMany({
        where: { periodId: wp.id },
        orderBy: { createdAt: 'asc' }
      });
    }
  }

  const catalogs = { "Fija": [], "Móvil": [], "Ti": [], "Rent": [], "Micro": [], "O2": [], "Seguro": [], "miMovistar": [], "Traslado miMovistar": [], "Suscripciones TV": [], "Prepago": [], "Varios": [], "Repos": [], "Resto BAF": [] };
  for (const r of records) {
    if (!catalogs[r.categoria]) {
      catalogs[r.categoria] = [];
    }
    catalogs[r.categoria].push({
      producto: r.producto,
      mensual: r.mensual,
      anual: r.anual
    });
  }

  console.log(Object.keys(catalogs).map(k => `${k}: ${catalogs[k].length}`));
}

GET().finally(() => prisma.$disconnect());
