const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  // Simulated pasting from a source that uses spaces instead of tabs
  const line = "APPLE ACCESORIO AirPods (2nd gen) RENT MEDIA 122,80 € 2,46 € 4,91 € 01/05/2026 31/05/2026";
  const parts = line.split('\t').map(p => p.trim());
  
  console.log('parts.length:', parts.length);
  
  const row = { producto: parts[2] || '' };
  
  const normalize = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
  const pNameNorm = normalize(row.producto);
  
  console.log('pNameNorm:', `'${pNameNorm}'`);
  
  let matchIndex = items.findIndex(it => {
      const dbName = normalize(it.producto);
      return dbName.includes(pNameNorm) || pNameNorm.includes(dbName);
  });
  
  console.log('matchIndex:', matchIndex);
  if (matchIndex >= 0) {
      console.log('Matched with:', items[matchIndex].producto);
  }
}
main().finally(() => prisma.$disconnect());
