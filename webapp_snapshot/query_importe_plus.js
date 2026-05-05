const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.importePlus.findMany();
    p.forEach(r => {
        if (r.concepto.includes('TMA') || r.concepto.includes('MIC')) {
            console.log(r.concepto, r.totalObjetivos);
        }
    });
}
main().catch(console.error).finally(()=>prisma.$disconnect());
