import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const rules = await prisma.extraRule.findMany({ include: { period: true } })
  const conditions = await prisma.monthlyCondition.findMany({ where: { type: 'COMISION_EXTRA' } })
  console.log(JSON.stringify({rules, conditions}, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
