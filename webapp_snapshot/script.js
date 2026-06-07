const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const wp = await prisma.workPeriod.findFirst({ where: { period_key: "2026_06" }});
  const t = await prisma.territorialConfig.findFirst({ where: { periodId: wp.id } });
  console.log(JSON.stringify(t.o2Rules, null, 2));
}
main().finally(() => prisma.$disconnect());
