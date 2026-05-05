const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.condicionPlus.findMany();
    p.forEach(r => {
        if (r.concepto.includes('TMA') || r.concepto.includes('MIC') || r.concepto.includes('Micro')) {
            console.log(r.concepto, r.importeObj1, r.importeObj2, r.objTodaEmpresa);
        }
    });
}
main().catch(console.error).finally(()=>prisma.$disconnect());
