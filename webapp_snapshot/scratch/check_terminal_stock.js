const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== MovilFreeProducts ===");
  const mfProducts = await prisma.movilFreeProduct.findMany({
    include: { stocks: true }
  });
  console.log(JSON.stringify(mfProducts, null, 2));

  console.log("\n=== MicroShopProducts ===");
  const msProducts = await prisma.microShopProduct.findMany({
    include: { stocks: true }
  });
  console.log(JSON.stringify(msProducts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
