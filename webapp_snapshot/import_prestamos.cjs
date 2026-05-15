const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    console.log("Iniciando importación de Préstamos e Hipotecas...");
    
    // Leer el dump generado
    const rawData = fs.readFileSync('prestamos_dump.json', 'utf8');
    const dump = JSON.parse(rawData);
    const retroSheet = dump.find(s => s.sheet === 'Retrospectiva Creditos');
    
    if (!retroSheet) {
        console.error("No se encontró la pestaña Retrospectiva Creditos");
        return;
    }
    
    const rows = retroSheet.data;
    
    // El índice 0 tiene los años: [ "A FECHA...", 2008, 2009, ..., 2026 ]
    const headerRow = rows[0];
    const years = [];
    
    for (let i = 1; i < headerRow.length; i++) {
        if (headerRow[i] && !isNaN(Number(headerRow[i]))) {
            years.push({ index: i, year: Number(headerRow[i]) });
        }
    }
    
    // Mapeo de filas
    const mappings = [
        { rowIdx: 1, field: 'lineaCredito' },
        { rowIdx: 2, field: 'cuentaCorriente' },
        { rowIdx: 3, field: 'icoUnicaja1' },
        { rowIdx: 4, field: 'depositoIberabal' },
        { rowIdx: 5, field: 'icoUnicaja2' },
        { rowIdx: 6, field: 'impuestosHacienda' },
        { rowIdx: 7, field: 'aplazamientoHacienda' },
        { rowIdx: 8, field: 'prestamoPadres' },
        { rowIdx: 9, field: 'pagoMultaHacienda' },
        { rowIdx: 10, field: 'despidos' },
        { rowIdx: 11, field: 'inversionOficinas' },
        { rowIdx: 12, field: 'creditoTitoVergara' },
        { rowIdx: 13, field: 'creditoMicroInfor' },
        { rowIdx: 14, field: 'creditoEmpresaPiso' },
        
        { rowIdx: 16, field: 'stockMovistar' },
        { rowIdx: 17, field: 'deudaZeleris' },
        { rowIdx: 18, field: 'stockMovilfree' },
        { rowIdx: 19, field: 'deudaMovistar' },
        
        { rowIdx: 22, field: 'valorEmpresa' },
        { rowIdx: 24, field: 'planPensiones' },
        { rowIdx: 25, field: 'cuentasYCaja' },
        { rowIdx: 26, field: 'prestamosEmpresa' },
        { rowIdx: 27, field: 'prestamosHipotecaCampoamor' },
        { rowIdx: 28, field: 'pisosCampoamorRecreo' },
        { rowIdx: 29, field: 'pisosPrincipeVergara' },
        { rowIdx: 30, field: 'valorCoche' }
    ];

    for (const { index, year } of years) {
        const recordData = { year };
        
        for (const map of mappings) {
            const rawVal = rows[map.rowIdx] && rows[map.rowIdx][index];
            let val = 0;
            if (rawVal !== null && rawVal !== undefined) {
                // Remove strings if any and convert to number
                if (typeof rawVal === 'string') {
                    const parsed = parseFloat(rawVal.replace(/[^0-9.-]+/g, ""));
                    if (!isNaN(parsed)) val = parsed;
                } else {
                    val = Number(rawVal) || 0;
                }
            }
            recordData[map.field] = val;
        }

        await prisma.patrimonioRecord.upsert({
            where: { year },
            update: recordData,
            create: recordData
        });
        
        console.log(`Guardado año ${year}`);
    }
    
    console.log("¡Importación de Préstamos completada!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
