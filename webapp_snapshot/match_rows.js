const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const records = await prisma.gastoMensual.findMany({ 
    where: { year: 2026, grupo: 'Gastos Variables' },
    orderBy: { concepto: 'asc' }
  });
  
  const byConcepto = {};
  for (const r of records) {
    if (!byConcepto[r.concepto]) byConcepto[r.concepto] = [];
    byConcepto[r.concepto].push(r);
  }
  
  for (const [concepto, recs] of Object.entries(byConcepto)) {
    console.log(`\n=== ${concepto} ===`);
    for (const r of recs) {
      if (r.importe_c > 0 || r.importe_r > 0 || r.importe_dif > 0 || r.importe_total > 0) {
        console.log(`M${r.month}: c=${r.importe_c}, r=${r.importe_r}, dif=${r.importe_dif}, t=${r.importe_total}`);
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
