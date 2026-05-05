const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDelete() {
  try {
    const fakeId = "this-id-does-not-exist-12345";
    console.log("Attempting to delete fake sale ID:", fakeId);
    await prisma.sale.delete({ where: { id: fakeId } });
    console.log("SUCCESS! The sale was deleted.");
  } catch (error) {
    console.log("PRISMA EXACT ERROR:", error.message);
    console.log("PRISMA ERROR CODE:", error.code);
  } finally {
    await prisma.$disconnect();
  }
}

testDelete();
