const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mayVencimientos = await prisma.vencimiento.findMany();
  
  mayVencimientos.forEach(v => {
    if (['4792040067', '4792040068', '4792041502'].includes(v.nFactura)) {
      console.log(`Factura: ${v.nFactura}, Móviles: ${v.moviles}, IVA: ${v.iva}`);
    }
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
