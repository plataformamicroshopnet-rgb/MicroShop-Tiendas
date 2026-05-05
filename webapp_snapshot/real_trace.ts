import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['query'] })

async function diag() {
  console.log("=== INICIANDO TRAZA REAL EXIGIDA ===");

  // 1. Buscamos cualquier venta de Marzo (mes 3)
  const wpMarzo = await prisma.workPeriod.findFirst({ where: { month: 3, year: 2026 }});
  if (!wpMarzo) {
     console.log("No existe WP marzo. Abortando"); return;
  }

  const sale = await prisma.sale.findFirst({
      where: { periodId: wpMarzo.id }
  });

  if (!sale) {
      console.log("No hay ventas en marzo. Abortando"); return;
  }

  console.log("1. ID REAL SELECCIONADO:", sale.id);
  console.log("   Producto:", sale.producto);
  console.log("   Fecha original BD:", sale.fecha);
  console.log("   Period ID original:", sale.periodId);

  // 2. Modificamos la base de datos (SIMULAMOS PATCH EXACTO con fechas problemáticas como 2026-04-15)
  // ¿Y si la UI manda "2026-04-15"?
  // La UI de operaciones/page.tsx NO tiene type='date' sino un campo de texto u otro formato?
  
  // Actually, Let's check what GET /api/sales does precisely for that month before and after!
  console.log("\n2. CONSULTANDO ENDPOINT API PARA MARZO ANTES DEL CAMBIO...");
  const getSalesMarzoBefore = await prisma.sale.findMany({
      where: {
          OR: [
              { periodId: wpMarzo.id },
              { fecha: { contains: `/03/2026` } } // El padStart(2,0)
          ]
      }
  });
  console.log(`   Aparece en GET Marzo Antes: ${getSalesMarzoBefore.some(s => s.id === sale.id)}`);

  console.log("\n3. MODIFICANDO VENTA (Cambio a 15/04/2026)...");
  const wpAbril = await prisma.workPeriod.findFirst({ where: { month: 4, year: 2026 }});
  
  // ¿Qué código usamos en PATCH? Reasignamos periodId.
  const updatedSale = await prisma.sale.update({
      where: { id: sale.id },
      data: {
          fecha: "15/04/2026",
          periodId: wpAbril ? wpAbril.id : null
      }
  });

  console.log("   Valores POST-PATCH:");
  console.log("   Fecha nueva:", updatedSale.fecha);
  console.log("   Period ID Nuevo:", updatedSale.periodId);

  console.log("\n4. CONSULTANDO ENDPOINTS API TRAS EL CAMBIO...");
  const getSalesMarzoAfter = await prisma.sale.findMany({
      where: {
          OR: [
              { periodId: wpMarzo.id },
              { fecha: { contains: `/03/2026` } }
          ]
      }
  });

  const getSalesAbrilAfter = await prisma.sale.findMany({
      where: {
          OR: [
              { periodId: wpAbril!.id },
              { fecha: { contains: `/04/2026` } }
          ]
      }
  });

  console.log(`   ¿Sigue en Marzo (Viejo)? -> ${getSalesMarzoAfter.some(s => s.id === sale.id)}`);
  console.log(`   ¿Aparece en Abril (Nuevo)? -> ${getSalesAbrilAfter.some(s => s.id === sale.id)}`);

  // Restoring manually to leave DB clean
  await prisma.sale.update({
      where: { id: sale.id },
      data: { fecha: sale.fecha, periodId: sale.periodId }
  });
}

diag().catch(console.error);
