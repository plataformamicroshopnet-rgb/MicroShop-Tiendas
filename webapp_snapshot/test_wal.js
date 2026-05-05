const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checkpointing...');
  const res = await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
  console.log('Result:', res);
}

main().catch(console.error).finally(() => prisma.$disconnect());
