const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Normalize concept names (from 2025 to match 2026)
  await prisma.gastoMensual.updateMany({
    where: { concepto: 'Arrendamientos' },
    data: { concepto: 'Arrendamiento' }
  });
  
  await prisma.gastoMensual.updateMany({
    where: { concepto: 'Gasoil Solred' },
    data: { concepto: 'Gasoil/Solred' }
  });

  await prisma.gastoMensual.updateMany({
    where: { concepto: 'Teléfono Fijo y Móvil' },
    data: { concepto: 'Telefono Fijo y Movil' }
  });

  await prisma.gastoMensual.updateMany({
    where: { concepto: 'Sanitas (Angel Luis)' },
    data: { concepto: 'Rentas (Angel Luis)' }
  });

  // 2. Fix Comisiones Bancarias for 2026
  // They should be Enero: 391.71, Febrero: 414.85, Marzo: 50.39, Abril: 856.95
  // We will delete existing 2026 Comisiones Bancarias and recreate them cleanly in the "Total" column (importe_total)
  await prisma.gastoMensual.deleteMany({
    where: { year: 2026, concepto: 'Comisiones Bancarias' }
  });

  const correctComisiones = [
    { month: 1, val: 391.71 },
    { month: 2, val: 414.85 },
    { month: 3, val: 50.39 },
    { month: 4, val: 856.95 }
  ];

  for (const c of correctComisiones) {
    await prisma.gastoMensual.create({
      data: {
        year: 2026,
        month: c.month,
        grupo: 'Gastos Variables',
        concepto: 'Comisiones Bancarias',
        importe_c: c.val, // Put it in the first column so it matches what they usually paste
        importe_r: 0,
        importe_dif: 0,
        importe_total: 0 // In Matrix, total is often computed, or they just use the first col
      }
    });
  }

  console.log('DB fixes applied successfully.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
