const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  // Simulated pasting of the OLD Excel format (no comision columns)
  // "APPLE\tACCESORIO\tAirPods (2nd gen) RENT\tMEDIA\t122,80 €\t01/05/2026\t31/05/2026"
  const line = "APPLE\tACCESORIO\tAirPods (2nd gen) RENT\tMEDIA\t122,80 €\t01/05/2026\t31/05/2026";
  const parts = line.split('\t').map(p => p.trim());
  
  // Let's pretend it uses the NEW parsing logic on OLD data:
  const row = {
    fabricante: parts[0] || '',
    categoria: parts[1] || '',
    producto: parts[2] || '',
    gama: parts[3] || '',
    amountAsStr: parts.length > 4 ? parts[4] : '0',
    comision: parts.length > 5 ? parts[5] : '', // "01/05/2026"
    comisionConCoste: parts.length > 6 ? parts[6] : '', // "31/05/2026"
    desde: parts.length > 7 ? parts[7] : '', // ""
    hasta: parts.length > 8 ? parts[8] : '', // ""
  };
  
  const pName = row.producto.toLowerCase();
  const rowDesde = row.desde; // ""
  
  let matchIndex = items.findIndex(it => 
       (it.producto || '').toLowerCase() === pName && 
       (it.validFrom || '').trim() === rowDesde
  );
  
  console.log('Exact match index:', matchIndex); // should be -1 because "" !== "01/05/2026"
  
  if (matchIndex === -1) {
    const nameMatches = items.filter(it => (it.producto || '').toLowerCase() === pName);
    console.log('Name matches length:', nameMatches.length); // should be 1
    if (nameMatches.length === 1) {
       console.log('Matched via fallback!');
    }
  }
}
main().finally(() => prisma.$disconnect());
