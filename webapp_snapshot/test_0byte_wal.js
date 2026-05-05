const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

async function test() {
  fs.copyFileSync('./prisma/database.sqlite', './prisma/temp_test.sqlite');
  fs.writeFileSync('./prisma/temp_test.sqlite-wal', '');
  fs.writeFileSync('./prisma/temp_test.sqlite-shm', '');

  const p = new PrismaClient({ datasources: { db: { url: 'file:./temp_test.sqlite' } } });
  try {
    const c = await p.sale.count();
    console.log("Count with 0 byte WAL:", c);
  } catch(e) {
    console.error("ERROR 0-byte wal:", e);
  } finally {
    await p.$disconnect();
  }
}
test();
