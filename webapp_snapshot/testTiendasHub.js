const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const { canView } = require('./src/lib/permissions.ts');

  const user = await prisma.user.findFirst({ where: { username: { contains: 'AdminCristina' } } });
  if (user) {
    const safeUser = { role: user.role, permissions: user.permissions };
    console.log("canView MODULE_TIENDAS:", canView(safeUser, 'MODULE_TIENDAS'));
  } else {
    console.log("AdminCristina not found");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
