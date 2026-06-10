const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("[Boot-Clean] Production stock cleanup bypassed (allow cross-stock).");
}

main()
  .catch(err => console.error("[Boot-Clean] Error during stock cleanup:", err))
  .finally(() => prisma.$disconnect());
