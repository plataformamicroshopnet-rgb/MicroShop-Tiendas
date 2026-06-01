const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.movilFreeClient.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  });
  console.log(clients.map(c => c.nif));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
