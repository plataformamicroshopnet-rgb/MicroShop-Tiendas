import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: { username: 'Vanessa' },
    data: { username: 'Vanesa' }
  });
  console.log(`Updated ${result.count} users`);
}

main().finally(() => prisma.$disconnect());
