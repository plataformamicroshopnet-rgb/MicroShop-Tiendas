const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const period = await prisma.workPeriod.findUnique({ where: { period_key: '2026_06' } });
  if (!period) {
    console.log("No 2026_06 period found");
    return;
  }
  const products = await prisma.productCatalog.findMany({
    where: { periodId: period.id, categoria: 'Traslado miMovistar' }
  });
  console.log("Total items in Traslado miMovistar:", products.length);
  
  const grouped = {};
  for (const p of products) {
    const key = [p.producto, p.subcategoria, p.gama, p.fabricante].map(x => (x||'').trim().toLowerCase()).join('|');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }
  
  for (const [key, vars] of Object.entries(grouped)) {
    if (vars.length > 1) {
      console.log(`\nDUPLICATE FOUND IN DB: ${key}`);
      console.log(vars);
    }
  }
}
main().finally(() => prisma.$disconnect());
