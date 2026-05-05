import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const rows = await p.sale.groupBy({
  by: ['codigo', 'vendedor'],
  where: { codigo: { in: ['Plus N7D','Plus 1SK','Plus K2Z','Plus NFG','Básico XCU','Plus ZF7'] } },
  _count: { codigo: true }
});

rows.sort((a,b) => a.codigo.localeCompare(b.codigo))
    .forEach(x => console.log(`${x.codigo.padEnd(15)} -> ${x.vendedor} (${x._count.codigo} ventas)`));

await p.$disconnect();
