const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { username: 'Carmen' } });
  console.log("Carmen DB role:", user.role, "typeof role:", typeof user.role);
}

main().catch(console.error).finally(() => prisma.$disconnect());
