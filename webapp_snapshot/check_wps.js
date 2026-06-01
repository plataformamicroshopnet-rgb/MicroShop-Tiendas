const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const wp = await prisma.workPeriod.findMany();
  console.log(wp);
}
main().finally(() => prisma.$disconnect());
