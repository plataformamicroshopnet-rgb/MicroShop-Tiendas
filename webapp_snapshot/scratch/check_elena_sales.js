const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.sale.findMany({
    orderBy: { vendedor: 'asc' }
  });
  console.log(`Total sales in DB: ${sales.length}`);
  sales.forEach((s, idx) => {
    console.log(`${idx + 1}. [${s.vendedor}] [${s.fecha}] [${s.detalle}] ${s.producto} (cuota: ${s.cuota}, importe: ${s.importe}, pendiente: ${s.pendiente})`);
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
