const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  const debugPaste = fs.readFileSync('c:/Proyecto Tiendas/MicroShop Tiendas/webapp_snapshot/debug_paste.txt', 'utf-8');
  const lines = debugPaste.split('\n').filter(l => l.trim().length > 0);
  
  let matchCount = 0;
  let failCount = 0;
  
  lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim());
      const row = {
        producto: parts[2] || '',
        desde: parts[7] || '',
      };
      
      const normalize = (s) => (s || '').replace(/\s+/g, '').toLowerCase()
      const pNameNorm = normalize(row.producto)
      const rowDesde = (row.desde || '').trim()
      
      let matchIndex = items.findIndex(it => 
         normalize(it.producto) === pNameNorm && 
         (it.validFrom || '').trim() === rowDesde
      )

      if (matchIndex === -1) {
        matchIndex = items.findIndex(it => {
          const dbName = normalize(it.producto);
          return dbName.includes(pNameNorm) || pNameNorm.includes(dbName);
        })
      }
      
      if (matchIndex >= 0) {
          matchCount++;
      } else {
          failCount++;
          console.log('Failed to match:', row.producto);
      }
  });
  
  console.log(`Matched: ${matchCount}, Failed: ${failCount}`);
}
main().finally(() => prisma.$disconnect());
