const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  // Simulate the UI state exactly
  const updatedItems = items.map(item => ({
    ...item,
    importStatus: 'missing'
  }));
  
  const debugPaste = fs.readFileSync('c:/Proyecto Tiendas/MicroShop Tiendas/webapp_snapshot/debug_paste.txt', 'utf-8');
  const lines = debugPaste.split('\n').filter(l => l.trim().length > 0);
  
  const parseSpanishNumber = (str) => {
    let clean = (str || '').replace(/[^0-9.,-]/g, '')
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.')
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.')
    }
    return clean || '0'
  }
  
  lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim());
      const isDate = (s) => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test((s || '').trim());
      const isNewFormat = isDate(parts[3]) || isDate(parts[4]);

      let row = {};
      if (isNewFormat) {
          row = {
              producto: parts[2] || '',
              desde: parts[3] || '',
              comision: parts.length > 7 ? parseSpanishNumber(parts[7]) : '',
          };
      } else {
          row = {
              producto: parts[2] || '',
              desde: parts[7] || '',
              comision: parts.length > 5 ? parseSpanishNumber(parts[5]) : '',
          };
      }
      
      const normalize = (s) => (s || '').replace(/\s+/g, '').toLowerCase()
      const pNameNorm = normalize(row.producto)
      const rowDesde = (row.desde || '').trim()
      
      let matchIndex = updatedItems.findIndex(it => 
         normalize(it.producto) === pNameNorm && 
         (it.validFrom || '').trim() === rowDesde
      )

      if (matchIndex === -1) {
        matchIndex = updatedItems.findIndex(it => {
          const dbName = normalize(it.producto);
          return dbName.includes(pNameNorm) || pNameNorm.includes(dbName);
        })
      }
      
      if (matchIndex >= 0) {
          const item = updatedItems[matchIndex];
          item.importStatus = 'unchanged';
          let changed = false;
          if (item.comision !== row.comision) {
              item.comision = row.comision;
              changed = true;
          }
          if (changed) {
              item.importStatus = 'updated';
          }
      }
  });
  
  const missingCount = updatedItems.filter(i => i.importStatus === 'missing').length;
  const updatedCount = updatedItems.filter(i => i.importStatus === 'updated').length;
  const unchangedCount = updatedItems.filter(i => i.importStatus === 'unchanged').length;
  
  console.log(`Missing (RED): ${missingCount}`);
  console.log(`Updated (YELLOW): ${updatedCount}`);
  console.log(`Unchanged (TRANSPARENT): ${unchangedCount}`);
  
}
main().finally(() => prisma.$disconnect());
