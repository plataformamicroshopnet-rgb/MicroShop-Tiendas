const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { username: { contains: 'Carmen' } } });
  console.log("Carmen password:", user.password);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
