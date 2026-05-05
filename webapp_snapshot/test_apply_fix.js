const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({ log: ['query'] });
  // Start a query to ensure connection is open and file is locked
  await prisma.sale.findFirst();
  
  global.prisma = prisma;
  
  // Try to rename while the connection is still alive (should fail)
  try {
    fs.renameSync('./prisma/database.sqlite', './prisma/temp_fail.sqlite');
    console.log("Renamed while alive? BAD");
  } catch(e) {
    console.log("Failed while alive (expected):", e.message);
  }
  
  // Apply my exact fix
  await prisma.$disconnect()
  const globalForPrisma = global;
  if (globalForPrisma.prisma) {
     await globalForPrisma.prisma.$disconnect()
  }
  
  // Try to rename again!
  try {
    fs.renameSync('./prisma/database.sqlite', './prisma/temp_success.sqlite');
    fs.renameSync('./prisma/temp_success.sqlite', './prisma/database.sqlite');
    console.log("SUCCESS! The file lock was released!!");
  } catch (e) {
    console.error("OH NO IT STILL FAILED!!:", e.message);
  }
}
main();
