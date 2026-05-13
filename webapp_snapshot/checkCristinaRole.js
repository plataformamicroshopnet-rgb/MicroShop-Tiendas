const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { username: { contains: 'AdminCristina' } } });
  if (user) {
    console.log("AdminCristina role:", user.role);
  } else {
    console.log("AdminCristina not found");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
