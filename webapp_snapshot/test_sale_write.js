const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function catchWriteError() {
  try {
    await prisma.sale.createMany({
      data: [{
        sheet: 'OP',
        vendedor: 'Prueba',
        fecha: '28/03/2026',
        codigo: 'BLOCK_EMPTY_CODE',
        producto: 'Test',
        nombreCliente: 'TEST',
        nif: 'TEST',
        potencial: '',
        telf: '',
        pendiente: '',
        anulado: 'No',
        anotaciones: '',
        grupo: '-',
        cuota: null,
        detalle: '',
        periodId: null
      }]
    });
  } catch (error) {
    console.error("--- REAL SERVER ERROR BEGIN ---")
    console.error(error.message);
    console.error("--- REAL SERVER ERROR END ---")
    console.error("Code:", error.code);
    console.error("Meta:", error.meta);
  } finally {
    await prisma.$disconnect();
  }
}

catchWriteError();
