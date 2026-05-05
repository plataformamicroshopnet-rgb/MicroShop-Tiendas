const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        console.log("Migrando ImportePyme...");
        const resPyme = await prisma.$executeRawUnsafe("UPDATE ImportePyme SET isPercentage = 1 WHERE UPPER(TRIM(grupo)) IN ('TMA', 'TMI', 'MICRO', 'MIC', 'TI')");
        console.log("ImportePyme actualizados:", resPyme);
        
        console.log("Migrando ImportePlus...");
        const resPlus = await prisma.$executeRawUnsafe("UPDATE ImportePlus SET isPercentage = 1 WHERE UPPER(TRIM(grupo)) IN ('TMA', 'TMI', 'MICRO', 'MIC', 'TI')");
        console.log("ImportePlus actualizados:", resPlus);

        console.log("Migracion SQLite completada!");
    } catch (e) {
        console.error("Error migrando BD:", e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
