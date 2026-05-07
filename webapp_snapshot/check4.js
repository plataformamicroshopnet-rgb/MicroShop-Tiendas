const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.productCatalog.findMany({ where: { categoria: 'RENT' } });
  
  const names = items.map(i => i.producto).sort();
  let similar = [];
  for(let i=0; i<names.length-1; i++){
      if(names[i].toLowerCase() === names[i+1].toLowerCase()){
          similar.push(names[i]);
      }
  }
  console.log('Exact case-insensitive duplicates:', similar.length);
  
  // What if we check by "Fabricante" + "Producto" + "Comision"?
  console.log('Total items:', items.length);
}

main().finally(() => prisma.$disconnect());
