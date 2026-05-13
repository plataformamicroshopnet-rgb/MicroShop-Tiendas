const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ where: { username: { contains: 'Carmen' } } });
  console.log(users.map(u => ({ username: u.username, role: u.role, permissions: u.permissions })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
