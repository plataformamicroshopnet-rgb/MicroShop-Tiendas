const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const wp = await prisma.workPeriod.findUnique({ where: { period_key: '2026_03' } });
  if (!wp) {
    console.log("No wp found for 2026_03");
    return;
  }
  console.log("Found WP:", wp);

  const targetMonthStr = String(wp.month).padStart(2, '0');
  const targetYearStr = String(wp.year);
  
  console.log("1. Buscando solo por periodId...");
  let byPeriodId = 'Error: Columna periodId no existe en BD (P2022)';
  try {
    byPeriodId = await prisma.sale.count({ where: { periodId: wp.id } });
  } catch(e) { console.log(e.code) }
  console.log("->", byPeriodId);

  console.log("2. Buscando solo por fecha: contains `/" + targetMonthStr + "/" + targetYearStr + "`...");
  let byFecha = 0;
  try {
    byFecha = await prisma.sale.count({ where: { fecha: { contains: `/${targetMonthStr}/${targetYearStr}` } } });
  } catch(e) { console.log(e.code) }
  console.log("->", byFecha);

  const temporalWhere = {
    fecha: { contains: `/${targetMonthStr}/${targetYearStr}` }
  };

  console.log("3. Búsqueda temporalWhere combinada...");
  const combined = await prisma.sale.count({ where: temporalWhere });
  console.log("->", combined);

  // Simulated baseWhereClause for an ADMIN
  const baseWhereClause = {};
  const finalWhereAdmin = { ...baseWhereClause, ...temporalWhere };
  console.log("4. finalWhere (Admin):", finalWhereAdmin);
  const adminCombined = await prisma.sale.count({ where: finalWhereAdmin });
  console.log("->", adminCombined);

  // Simulated baseWhereClause for a COMERCIAL
  const baseWhereClauseComercial = { codigo: { equals: 'BLOCK_EMPTY_CODE' } };
  const finalWhereComercial = { ...baseWhereClauseComercial, ...temporalWhere };
  console.log("5. finalWhere (Comercial):", finalWhereComercial);
  const comercialCombined = await prisma.sale.count({ where: finalWhereComercial });
  console.log("->", comercialCombined);
  
  console.log("6. Let's print out what the database dates actually look like (first 5).");
  const dates = await prisma.sale.findMany({ select: { fecha: true, id: true }, take: 5 });
  console.log("Dates:", dates);
}

main().catch(console.error).finally(() => prisma.$disconnect());
