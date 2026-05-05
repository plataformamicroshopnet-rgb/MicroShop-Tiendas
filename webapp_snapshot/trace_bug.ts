import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("=========================================")
    console.log("TRACE REQUERIDO POR EL USUARIO")
    console.log("=========================================")
    
    // 1. Elegir una operación real que podemos mover.
    // Vamos a coger una cualquiera que tenga periodId y fecha clara.
    const originalSale = await prisma.sale.findFirst({
        where: { periodId: { not: null }, fecha: { contains: '/' } }
    });

    if (!originalSale) {
        console.log("❌ No hay operaciones en la BD para probar.");
        return;
    }

    console.log("1. OPERACIÓN ELEGIDA PARA LA PRUEBA:")
    console.log("- ID Real:", originalSale.id);
    console.log("- Producto:", originalSale.producto);
    console.log("- Fecha Original:", originalSale.fecha);
    console.log("- PeriodId Original:", originalSale.periodId);
    console.log("- Fecha de Creación:", originalSale.createdAt);

    // Identificar de qué mes a qué mes la movemos
    // Parse old date
    let oldMonth = "01";
    let oldYear = "2026";
    if (originalSale.fecha) {
        const p = originalSale.fecha.split('/');
        if (p.length === 3) {
            oldMonth = p[1];
            oldYear = p[2];
        }
    }

    // Movemos siempre sumando un mes, envuelto al año
    let nMonth = parseInt(oldMonth, 10);
    let nYear = parseInt(oldYear, 10);
    nMonth++;
    if (nMonth > 12) { nMonth = 1; nYear++; }
    
    const newFecha = `15/${String(nMonth).padStart(2, '0')}/${nYear}`;
    console.log(`\nVamos a moverla textualmente a la fecha: ${newFecha}`);

    // SIMULAR EL CÓDIGO EXACTO DEL PATCH /api/sales
    const updates = { fecha: newFecha };
    const updateData: any = {};
    
    if (updates.fecha !== undefined) {
      updateData.fecha = updates.fecha
      
      if (updates.fecha) {
        const parts = updates.fecha.split('/');
        if (parts.length === 3) {
          const nm = parseInt(parts[1], 10);
          const ny = parseInt(parts[2], 10);
          
          const matchingWp = await prisma.workPeriod.findFirst({
            where: { month: nm, year: ny }
          });
          
          if (matchingWp) {
            console.log(`- El script Backend encontró el Periodo UUID: ${matchingWp.id} (Mes ${nm}/${ny})`);
            updateData.periodId = matchingWp.id;
          } else {
            console.log(`- El script Backend NO encontró Periodo para el Mes ${nm}/${ny}. Seteando a null.`);
            updateData.periodId = null;
          }
        }
      }
    }
    
    // 2. Modificamos la BD
    console.log("\n2. EJECUTANDO UPDATE DE BD (SIMULANDO PATCH /api/sales)...");
    const updatedSale = await prisma.sale.update({
        where: { id: originalSale.id },
        data: updateData
    });

    console.log("\n3. BD DESPUÉS DEL PATCH:");
    console.log("- Fecha Nueva:", updatedSale.fecha);
    console.log("- PeriodId Nuevo:", updatedSale.periodId);

    // 4. Qué endpoint usa Operaciones para listar ese mes?
    // /api/sales?periodKey=YYYY_MM
    console.log("\n4. COMPROBANDO ENDPOINT GET /api/sales DEL VIEJO MES Y DEL NUEVO MES:");
    
    // Buscar el WorkPeriod del mes VIEJO
    const wpOld = await prisma.workPeriod.findFirst({ where: { id: originalSale.periodId as string } })
       || await prisma.workPeriod.findFirst({ where: { month: parseInt(oldMonth), year: parseInt(oldYear) }});

    if (wpOld) {
        const targetMonthStr = String(wpOld.month).padStart(2, '0');
        const targetYearStr = String(wpOld.year);
        
        const salesOldMonth = await prisma.sale.findMany({
          where: {
            OR: [
              { periodId: wpOld.id },
              { fecha: { contains: `/${targetMonthStr}/${targetYearStr}` } }
            ]
          }
        });

        const foundInOld = salesOldMonth.find(s => s.id === originalSale.id);
        console.log(`- ¿Aparece la operación en la lista del Endpoint para el MES VIEJO (${targetMonthStr}/${targetYearStr})? -> ${foundInOld ? "SÍ (ERROR) ❌" : "NO (CORRECTO) ✅"}`);
    }

    // Buscar en el mes NUEVO
    const targetMonthNew = String(nMonth).padStart(2, '0');
    const targetYearNew = String(nYear);
    const saleNewMonth = await prisma.sale.findMany({
        where: {
            OR: [
                { periodId: updatedSale.periodId as any },
                { fecha: { contains: `/${targetMonthNew}/${targetYearNew}` } }
            ]
        }
    });
    
    const foundInNew = saleNewMonth.find(s => s.id === originalSale.id);
    console.log(`- ¿Aparece la operación en la lista del Endpoint para el MES NUEVO (${targetMonthNew}/${targetYearNew})? -> ${foundInNew ? "SÍ (CORRECTO) ✅" : "NO (ERROR) ❌"}`);

}
main().catch(console.error);
