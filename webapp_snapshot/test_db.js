const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const assignments = await prisma.extraAssignment.findMany({ include: { period: true } });
    console.log(JSON.stringify(assignments, null, 2));
}
main().finally(() => prisma.$disconnect());
