const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { username: { contains: 'Carmen' } } });
  console.log("Carmen DB permissions:", user.permissions);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
