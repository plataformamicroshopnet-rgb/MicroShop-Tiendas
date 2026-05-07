const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const o2Products = await prisma.productCatalog.findMany({
    where: { categoria: 'O2' },
  });
  
  const subcategorias = [...new Set(o2Products.map(p => p.subcategoria))];
  const fabricantes = [...new Set(o2Products.map(p => p.fabricante))];
  
  console.log('Total O2 Products:', o2Products.length);
  console.log('Subcategorias:', subcategorias);
  console.log('Fabricantes:', fabricantes);
}

main().catch(console.error).finally(() => prisma.$disconnect());
