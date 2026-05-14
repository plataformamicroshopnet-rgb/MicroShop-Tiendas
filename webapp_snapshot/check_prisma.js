const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.objective.count();
    console.log(`Total rows in Objective table: ${count}`);
    
    const pymeCount = await prisma.objective.count({ where: { profile: 'Pyme' } });
    console.log(`Total rows in Objective table for Pyme: ${pymeCount}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
