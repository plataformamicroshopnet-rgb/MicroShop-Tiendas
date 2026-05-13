const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  await prisma.user.updateMany({
    where: { username: 'Carmen' },
    data: { password: hash }
  });
  console.log("Carmen password set to 123456");
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
