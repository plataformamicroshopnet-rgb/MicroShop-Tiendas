const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activePeriod = await prisma.workPeriod.findFirst({ where: { status: 'ACTIVE' } });
  const items = await prisma.productCatalog.findMany({ 
    where: { periodId: activePeriod.id, categoria: 'RENT' } 
  });
  
  const pDate = (d, isEnd = false) => {
    if (!d || !d.trim()) return isEnd ? 99999999 : 0;
    const parts = d.split('/');
    if (parts.length === 3) {
       return parseInt(parts[2])*10000 + parseInt(parts[1])*100 + parseInt(parts[0]);
    }
    return isEnd ? 99999999 : 0;
  }
  
  const byProduct = {};
  items.forEach(it => {
      const pName = String(it.producto).trim().toLowerCase();
      if (!byProduct[pName]) byProduct[pName] = [];
      byProduct[pName].push(it);
  });
  
  let overlaps = 0;
  for (const [pName, variations] of Object.entries(byProduct)) {
      if (variations.length > 1) {
          for (let i = 0; i < variations.length; i++) {
              for (let j = i + 1; j < variations.length; j++) {
                  const startA = pDate(variations[i].validFrom, false);
                  const endA = pDate(variations[i].validTo, true);
                  const startB = pDate(variations[j].validFrom, false);
                  const endB = pDate(variations[j].validTo, true);

                  if (startA <= endB && endA >= startB) {
                      overlaps++;
                      console.log(`Overlap found: ${variations[i].producto} (${variations[i].validFrom}-${variations[i].validTo}) vs (${variations[j].validFrom}-${variations[j].validTo})`);
                  }
              }
          }
      }
  }
  
  console.log(`Total overlaps found: ${overlaps}`);
}
main().finally(() => prisma.$disconnect());
