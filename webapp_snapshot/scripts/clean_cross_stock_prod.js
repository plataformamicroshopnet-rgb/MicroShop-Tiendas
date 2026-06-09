const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("[Boot-Clean] Starting production stock cleanup...");
  
  const movistarStores = ['Auxiliadora 45', 'Correhuela', 'Villamayor', 'Béjar'];
  
  // 1. Reset MovilFreeStock entries for Movistar stores to 0
  const resultMf = await prisma.movilFreeStock.updateMany({
    where: {
      tienda: {
        in: movistarStores
      }
    },
    data: {
      cantidad: 0
    }
  });
  console.log(`[Boot-Clean] Updated ${resultMf.count} MovilFreeStock records in Movistar stores to 0.`);
}

main()
  .catch(err => console.error("[Boot-Clean] Error during stock cleanup:", err))
  .finally(() => prisma.$disconnect());
