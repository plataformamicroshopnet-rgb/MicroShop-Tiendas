const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rules = await prisma.tiendaCommissionRule.findMany();
    console.log(rules);
}
main();
