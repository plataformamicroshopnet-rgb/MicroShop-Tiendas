const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const wp = await prisma.workPeriod.findUnique({where: {period_key: '2026_05'}});
  if(!wp) return console.log('no may');
  const records = await prisma.productCatalog.findMany({
    where: { periodId: wp.id },
    orderBy: { createdAt: 'asc' }
  });
  
  const catalogs = { "Fija": [], "Móvil": [], "Ti": [], "Rent": [], "Micro": [], "O2": [], "Seguro": [], "miMovistar": [], "Traslado miMovistar": [], "Suscripciones TV": [], "Prepago": [], "Varios": [], "Repos": [], "Resto BAF": [] }
  for (const r of records) {
    if (!catalogs[r.categoria]) {
      catalogs[r.categoria] = []
    }
    catalogs[r.categoria].push({
      producto: r.producto,
    })
  }

  const mapped = { "Fija y Móvil": [], "Ti": [], "Rent": [], "Seguro": [], "O2": [], "miMovistar": [], "Suscripciones TV": [], "Prepago": [], "Varios": [], "Repos": [], "Resto BAF": [], "Traslado miMovistar": [] }
  for (const [cat, items] of Object.entries(catalogs)) {
    if (!mapped[cat]) mapped[cat] = [];
    mapped[cat] = [...mapped[cat], ...items.map(it => ({
      producto: it.producto,
    }))]
  }

  console.log(Object.keys(mapped).map(k => `${k}: ${mapped[k].length}`));
}
main().finally(() => prisma.$disconnect());
