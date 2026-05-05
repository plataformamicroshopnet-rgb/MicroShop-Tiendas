const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDelete() {
  const sale = await prisma.sale.findFirst();
  if (!sale) {
    console.log("No sales found to delete");
    return;
  }
  
  try {
    console.log("Attempting to delete sale ID:", sale.id);
    await prisma.sale.delete({ where: { id: sale.id } });
    console.log("SUCCESS! The sale was deleted.");
  } catch (error) {
    console.error("PRISMA EXACT ERROR:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDelete();
