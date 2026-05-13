const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { username: { contains: 'Salva' } } });
  if (user) {
    console.log("Salva DB permissions:", user.permissions);
  } else {
    console.log("Salva not found");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
