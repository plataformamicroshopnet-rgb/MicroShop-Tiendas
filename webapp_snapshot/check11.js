const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  // This is the EXACT text from the user's image if copied to clipboard.
  // We'll simulate the tab separation assuming the columns are exactly as they appear visually.
  const line = "APPLE\tACCESORIO\tAirPods (4th gen) ANC RENT\t01/05/2026\t31/05/2026\tMEDIA\t157,90 €\t3,16 €\t6,32 €";
  const parts = line.split('\t').map(p => p.trim());
  
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
  
  console.log('Row Producto:', row.producto);
  console.log('pNameNorm:', pNameNorm);
  console.log('Match Index:', matchIndex);
  if (matchIndex >= 0) {
      console.log('Matched Product:', items[matchIndex].producto);
      console.log('New values that would be set:');
      console.log(' - Gama:', row.gama); // "01/05/2026"
      console.log(' - Desde:', row.desde); // "3,16 €"
      console.log(' - Comision:', row.comision); // "MEDIA"
  }
}
main().finally(() => prisma.$disconnect());
