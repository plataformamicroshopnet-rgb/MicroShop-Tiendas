const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  // Simulated pasting of the OLD Excel format
  const line = "APPLE\tACCESORIO\tAirPods (2nd gen) RENT\tMEDIA\t122,80 €\t01/05/2026\t31/05/2026";
  const parts = line.split('\t').map(p => p.trim());
  
  const row = { producto: parts[2] || '' };
  const pName = row.producto.toLowerCase();
  
  const nameMatches = items.filter(it => (it.producto || '').toLowerCase() === pName);
  console.log(`pName: '${pName}'`);
  console.log('Matches length:', nameMatches.length);
  if (nameMatches.length > 0) {
      console.log('Matched item:', nameMatches[0].producto);
  }
}
main().finally(() => prisma.$disconnect());
