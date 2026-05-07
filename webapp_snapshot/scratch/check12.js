const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  const line = "APPLE\tACCESORIO\tAirPods (2nd gen) RENT\tMEDIA\t122,80 €\t2,46 €\t4,91 €\t01/05/2026\t31/05/2026";
  const parts = line.split('\t').map(p => p.trim());
  
  // My parser logic:
  const isDate = (s) => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test((s || '').trim());
  const isNewFormat = isDate(parts[3]) || isDate(parts[4]); // FALSE, because parts[3] is 'MEDIA' and parts[4] is '122,80 €'
  
  console.log('isNewFormat:', isNewFormat);
  
  const row = {
    fabricante: parts[0] || '',
    categoria: parts[1] || '',
    producto: parts[2] || '',
    gama: parts[3] || '',
    amountAsStr: parts.length > 4 ? parts[4] : '0',
    comision: parts.length > 5 ? parts[5] : '',
    comisionConCoste: parts.length > 6 ? parts[6] : '',
    desde: parts.length > 7 ? parts[7] : '',
    hasta: parts.length > 8 ? parts[8] : '',
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
  
  console.log('pNameNorm:', pNameNorm);
  console.log('rowDesde:', rowDesde);
  console.log('matchIndex:', matchIndex);
  if (matchIndex >= 0) {
      console.log('Matched with:', items[matchIndex].producto);
  }
}
main().finally(() => prisma.$disconnect());
