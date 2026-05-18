const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ where: { username: { contains: 'Admin' } } });
  console.log(JSON.stringify(users.map(u => ({ username: u.username, role: u.role, permissions: u.permissions })), null, 2));
}
main().finally(() => prisma.$disconnect());
