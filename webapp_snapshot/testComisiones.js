const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { username: { contains: 'Carmen' } } });
  console.log("Username:", user.username);
  
  const hours = await prisma.tiendaComercialHour.findMany();
  console.log("Comerciales en DB:", [...new Set(hours.map(h => h.comercial))]);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
