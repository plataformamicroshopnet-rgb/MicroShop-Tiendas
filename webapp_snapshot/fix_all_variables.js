const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const rawData = `0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	276,53	0,00	276,53	644,38	0,00	0,00	644,38
141,52	0,00	0,00	141,52	362,13	0,00	0,00	362,13	636,25	0,00	0,00	636,25	392,12	0,00	0,00	392,12
0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	70,76	74,94	9,10	154,80
0,00	27,34	0,00	27,34	0,00	15,52	0,00	15,52	0,00	27,80	0,00	27,80	0,00	30,84	0,00	30,84
391,71	414,85	50,39	856,95	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	392,55	415,74	50,49	858,78
0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00
0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	0,00	871,41	0,00	871,41	0,00	3.130,15	0,00	3.130,15
776,66	0,00	0,00	776,66	855,68	0,00	0,00	855,68	2.421,80	0,00	0,00	2.421,80	511,43	0,00	0,00	511,43
0,00	0,00	0,00	0,00	128,89	136,50	16,58	281,97	136,00	144,03	17,49	297,52	0,00	0,00	0,00	0,00
0,00	329,26	0,00	329,26	0,00	234,85	0,00	234,85	0,00	241,16	0,00	241,16	3.617,93	4.076,52	465,40	8.159,85`;

const rows = rawData.split('\n');

const rowToConcepto = {
  0: 'Impuestos (Basur, IBI, Circ.)',
  1: 'Mantenimiento Vehiculos',
  2: 'Arsys + Golden Soft',
  3: 'Comisiones Tarjetas, etc',
  4: 'Comisiones Bancarias',
  5: 'Material de Oficina',
  6: 'Seguros Tiendas',
  7: 'Seguros Automovil',
  8: 'Mutua',
  9: 'Varios'
};

function parseVal(str) {
  if (!str) return 0;
  const num = parseFloat(str.trim().replace(/\./g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

async function main() {
  // Delete all existing Gastos Variables for 2026
  await prisma.gastoMensual.deleteMany({
    where: { year: 2026, grupo: 'Gastos Variables' }
  });

  for (let r = 0; r < rows.length; r++) {
    const concepto = rowToConcepto[r];
    const columns = rows[r].split('\t');
    
    // Each month has 4 columns: c, r, dif, total
    for (let month = 1; month <= 4; month++) {
      const baseIdx = (month - 1) * 4;
      const cVal = parseVal(columns[baseIdx]);
      const rVal = parseVal(columns[baseIdx + 1]);
      const difVal = parseVal(columns[baseIdx + 2]);
      const totalVal = parseVal(columns[baseIdx + 3]);
      
      // We only insert if there's any non-zero value, or just insert anyway
      if (cVal > 0 || rVal > 0 || difVal > 0 || totalVal > 0) {
        await prisma.gastoMensual.create({
          data: {
            year: 2026,
            month,
            grupo: 'Gastos Variables',
            concepto,
            importe_c: cVal,
            importe_r: rVal,
            importe_dif: difVal,
            importe_total: totalVal
          }
        });
      }
    }
  }

  console.log('All Gastos Variables perfectly mapped and restored!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
