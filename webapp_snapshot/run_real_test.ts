import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testApi() {
    const testId = "89e72957-eba3-44d8-80d4-e3fe7eec42d0";

    const sBefore = await prisma.sale.findUnique({where:{id:testId}});
    console.log("=== ESTADO 1: Operación 89e72957-eba3-44d8-80d4-e3fe7eec42d0 ANTES ===");
    console.log("- Fecha actual:", sBefore?.fecha);
    console.log("- Cuota estática:", sBefore?.cuota);
    console.log("- Grupo de familia:", sBefore?.grupo);

    console.log("\n-> API: Modificando fecha a 20/03/2026 (Forzando catálogo Marzo vía PATCH)...");
    
    const r1 = await fetch("http://localhost:3000/api/sales", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
             id: testId,
             updates: { fecha: "20/03/2026", producto: sBefore?.producto } // No updates.importe = undefined!
        })
    });
    
    console.log("   API Response:", await r1.json());

    const sAfter = await prisma.sale.findUnique({where:{id:testId}});
    console.log("\n=== ESTADO 2: TRAS PATCH A MARZO ===");
    console.log("- Nueva Fecha BD:", sAfter?.fecha);
    console.log("- Nueva Cuota estática BD:", sAfter?.cuota);
    console.log("- Nuevo Grupo BD:", sAfter?.grupo);

}

testApi();
