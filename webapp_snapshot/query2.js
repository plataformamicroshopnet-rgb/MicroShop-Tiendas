const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.importePlus.findMany();
    const tmas = p.filter(r => r.concepto.includes('TMA'));
    const mics = p.filter(r => r.concepto.includes('MIC') || r.concepto.includes('Micro'));
    console.log("TMAs:", tmas[0]?.totalObjetivos);
    console.log("MICs:", mics[0]?.totalObjetivos);
}
main().catch(console.error).finally(()=>prisma.$disconnect());
