import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function finalTest() {
    console.log("=== PRUEBA FINAL: RE-CALCULO AL EDITAR ===");
    const testId = "89e72957-eba3-44d8-80d4-e3fe7eec42d0";

    // 1. Verificar estado actual
    const s1 = await prisma.sale.findUnique({ where: { id: testId }});
    console.log("ESTADO ACTUAL:");
    console.log(`- Fecha: ${s1?.fecha} | Producto: ${s1?.producto} | Cuota: ${s1?.cuota} | Grupo: ${s1?.grupo}`);
    
    // 2. Ejecutar PATCH simulado localmente para forzar el código insertado en route.ts
    // Wait, let's just use regular fetch if the server is running ?
    // The server is running on localhost:3000! Let's fetch!
    
    console.log("\n-> ENVIANDO PATCH PARA MOVER A MARZO (10/03/2026):");
    const r1 = await fetch("http://localhost:3000/api/sales", {
         method: "PATCH",
         headers: { "Content-Type": "application/json", "Cookie": "next-auth.session-token=mock" }, // Wait, API is protected!
    });
    // Since API is protected, I will just call Prisma exactly as the endpoint does.
}
finalTest();
