const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const sales = await prisma.sale.findMany({ where: { vendedor: { contains: 'Cristina' } } }); 
  console.log('Total:', sales.length); 
  console.log('Pendientes:', sales.filter(s => s.pendiente === 'Si').length); 
  console.log('No Pendientes:', sales.filter(s => s.pendiente !== 'Si').length); 
} 
main().finally(() => prisma.$disconnect());
