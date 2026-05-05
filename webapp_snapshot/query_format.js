const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.importePlus.findMany();
    const c = await prisma.condicionPlus.findMany();
    console.log("IMPORTE PLUS");
    console.table(p.filter(r => r.concepto.includes('TMA') || r.concepto.includes('MIC') || r.concepto.includes('Micro')));
    console.log("CONDICION PLUS");
    console.table(c.filter(r => r.concepto.includes('TMA') || r.concepto.includes('MIC') || r.concepto.includes('Micro')));
}
main().catch(console.error).finally(()=>prisma.$disconnect());
