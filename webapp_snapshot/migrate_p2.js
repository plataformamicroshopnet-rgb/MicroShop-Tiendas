const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const columns = await prisma.$queryRawUnsafe("PRAGMA table_info(WorkPeriod)");
        console.log("Columnas WorkPeriod:", columns.map(c => c.name));
        
        if (!columns.some(c => c.name === 'pymeMultiplier')) {
            console.log("No existen los campos! Alterando tabla manualmente...");
            await prisma.$executeRawUnsafe("ALTER TABLE WorkPeriod ADD COLUMN pymeMultiplier REAL NOT NULL DEFAULT 5.0");
            await prisma.$executeRawUnsafe("ALTER TABLE WorkPeriod ADD COLUMN tramo1Limit REAL NOT NULL DEFAULT 50.0");
            await prisma.$executeRawUnsafe("ALTER TABLE WorkPeriod ADD COLUMN tramo2Limit REAL NOT NULL DEFAULT 80.0");
            await prisma.$executeRawUnsafe("ALTER TABLE WorkPeriod ADD COLUMN tramo3Limit REAL NOT NULL DEFAULT 100.0");
            console.log("Columnas de Fase C añadidas por script SQL raw");
        } else {
            console.log("Las columnas ya existen (Prisma las añadió con éxito antes de colapsar)");
        }
    } catch (e) {
        console.error("Error migrando BD:", e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
