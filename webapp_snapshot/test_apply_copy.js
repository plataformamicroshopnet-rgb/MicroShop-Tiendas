const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient({ log: ['query'] });
  // Start a query to ensure connection is open and file is locked
  await prisma.sale.findFirst();
  
  // Try to overwrite the database using copyFile while it's locked
  try {
    fs.copyFileSync('./prisma/temp_test.sqlite', './prisma/database.sqlite');
    console.log("SUCCESS! We can COPY over an open file on Windows!");
  } catch(e) {
    console.log("Failed to COPY while alive:", e.message);
  }
}
main();
