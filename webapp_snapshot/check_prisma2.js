const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rulesCount = await prisma.tiendaCommissionRule.count();
    console.log(`Total rows in TiendaCommissionRule table: ${rulesCount}`);
    
    const rulesList = await prisma.tiendaCommissionRule.findMany({ take: 2 });
    console.log(rulesList);
}
main().catch(console.error).finally(() => prisma.$disconnect());
