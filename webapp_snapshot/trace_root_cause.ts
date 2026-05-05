import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function trace() {
    console.log("=== TRAZADO REAL DE OPERACIÓN ===")
    
    // 1. Coger la operación usada para la prueba de "Registro de Operaciones"
    // ID: 89e72957-eba3-44d8-80d4-e3fe7eec42d0
    const testId = "89e72957-eba3-44d8-80d4-e3fe7eec42d0";
    const sale = await prisma.sale.findUnique({ where: { id: testId }});
    
    if (!sale) {
        console.log("No encuentro la venta."); return; 
    }
    
    console.log("1. ID REAL DE LA OPERACIÓN:");
    console.log(sale.id);

    console.log("\n2. ESTADO INICIAL EN BASE DE DATOS:");
    console.log("- Producto:", sale.producto);
    console.log("- Fecha actual almacenada:", sale.fecha);
    console.log("- PeriodId actual:", sale.periodId);
    console.log("- Cuota estática (Euros):", sale.cuota);
    console.log("- Grupo de Cuota:", sale.grupo);

    console.log("\n3. ENDPOINT QUE USA OPERACIONES:");
    console.log("GET /api/sales?periodKey=XXXX_XX");
    console.log("La respuesta procesa: importe: sale.cuota");

    console.log("\n4. ANÁLISIS DE LA CAUSA RAÍZ:");
    console.log("Si la fecha mueve la venta de un mes a otro, TIENE QUE ADAPTAR SU CUOTA (Importe) Y GRUPO a la parrilla de ese nuevo mes/fecha.");
    console.log("Pero el PATCH /api/sales SOLO actualiza `fecha` y `periodId`. NUNCA toca `sale.cuota` ni `sale.grupo` tras crearse.");
    
    console.log("\n5. ¿QUÉ HACE LIQUIDACIONES?");
    console.log("Liquidaciones IGNORA el campo estático `sale.cuota` e invoca `calculateDynamicCommission` -> `overrideBaseValue`, resolviendo en tiempo real el precio con la API de catálogos.");
    
    console.log("El resultado es que Liquidaciones 'sana' el fallo dinámicamente, pero Operaciones y Métricas reflejan los datos calcificados en el disco del primer mes.");
}
trace().catch(console.error);
