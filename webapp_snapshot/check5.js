const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  // Simulated pasting of a single row matching the user's image exactly:
  // "APPLE\tACCESORIO\tAirPods (2nd gen) RENT\tMEDIA\t122,80 €\t2,46 €\t4,91 €\t01/05/2026\t31/05/2026"
  const line = "APPLE\tACCESORIO\tAirPods (2nd gen) RENT\tMEDIA\t122,80 €\t2,46 €\t4,91 €\t01/05/2026\t31/05/2026";
  const parts = line.split('\t').map(p => p.trim());
  
  const row = {
    fabricante: parts[0] || '',
    categoria: parts[1] || '',
    producto: parts[2] || '',
    gama: parts[3] || '',
    desde: parts[7] || ''
  };
  
  const pName = row.producto.toLowerCase();
  const rowDesde = row.desde;
  
  let matchIndex = items.findIndex(it => 
       (it.producto || '').toLowerCase() === pName && 
       (it.validFrom || '').trim() === rowDesde
  );
  
  console.log('Exact match index:', matchIndex);
  
  if (matchIndex === -1) {
    const nameMatches = items.filter(it => (it.producto || '').toLowerCase() === pName);
    console.log('Name matches length:', nameMatches.length);
  }
}
main().finally(() => prisma.$disconnect());
