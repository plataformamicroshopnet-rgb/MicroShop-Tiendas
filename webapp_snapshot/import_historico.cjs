const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando importación desde Excel...');
  const workbook = XLSX.readFile('Ganancias 2014-2026.xlsx');

  const sheetsToProcess = workbook.SheetNames.filter(name => !isNaN(parseInt(name)));
  
  for (const sheetName of sheetsToProcess) {
    const year = parseInt(sheetName);
    console.log(`\nProcesando año ${year}...`);
    
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Buscar filas clave en la hoja
    const rowMap = {};
    let numComerciales = 0;
    
    let isFFVVSection = false;
    
    for (const row of data) {
      if (!row || !row[0] || typeof row[0] !== 'string') continue;
      
      const label = row[0].trim();
      
      const lbl = label.toLowerCase();
      
      if (lbl.includes('ingresos ffvv')) isFFVVSection = true;
      
      if (lbl.includes('cobrado iva')) rowMap.totalCobradoIva = row;
      if (lbl.includes('cobrado sin iva')) rowMap.totalCobradoSinIva = row;
      
      if (lbl.includes('caja tienda') && !isFFVVSection) rowMap.cajaTiendas = row;
      if (lbl.includes('comision') && lbl.includes('tienda') && lbl.includes('local')) rowMap.comisionesTiendasLocales = row;
      if (lbl === 'prv' && !isFFVVSection) rowMap.prvTiendas = row;
      if (lbl.includes('gastos tienda')) rowMap.gastosTiendas = row;
      // Para diferenciar "Comisiones Tiendas" de "Comisiones Tiendas Locales", comprobamos que no sea la local
      if (lbl.includes('comision') && lbl.includes('tienda') && !lbl.includes('local')) rowMap.comisionesTiendas = row;
      
      if (lbl.includes('caja ffvv') || lbl.includes('caja fuerza de venta')) rowMap.cajaFfvv = row;
      if (lbl.includes('plus')) rowMap.produccionPlus = row;
      if (lbl.includes('básico') || lbl.includes('basico')) rowMap.produccionBasico = row;
      if (lbl === 'prv' && isFFVVSection) rowMap.prvFfvv = row;
      if (lbl.includes('gastos ffvv')) rowMap.gastosFfvv = row;
      
      // Buscar numero de comerciales en la hoja de ese año
      if (lbl.includes('dividido') || lbl.includes('prv de') || (lbl.includes('prv') && lbl.includes('ffvv'))) {
         const match = label.match(/(\d+(?:,\d+)?)/);
         if (match) {
             const val = parseFloat(match[1].replace(',', '.'));
             // Asumimos que si encuentra un número razonable (ej. 4 a 20) es el de comerciales
             if (val >= 1 && val <= 30 && numComerciales === 0) {
                 numComerciales = val;
             }
         }
      }
    }
    
    console.log(`Numero de comerciales detectado: ${numComerciales || 1}`);

    for (let month = 1; month <= 12; month++) {
      const colIndex = month; // Enero está en index 1, Febrero en 2, etc.
      
      const getValue = (row) => {
        if (!row) return 0;
        let val = row[colIndex];
        if (typeof val === 'string') {
          // Limpiar euros y puntos de miles
          val = val.replace(/€/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
          val = parseFloat(val);
        }
        return isNaN(val) ? 0 : val;
      };

      const recordData = {
        totalCobradoIva: getValue(rowMap.totalCobradoIva),
        totalCobradoSinIva: getValue(rowMap.totalCobradoSinIva),
        
        cajaTiendas: getValue(rowMap.cajaTiendas),
        comisionesTiendasLocales: getValue(rowMap.comisionesTiendasLocales),
        prvTiendas: getValue(rowMap.prvTiendas),
        gastosTiendas: getValue(rowMap.gastosTiendas),
        comisionesTiendas: getValue(rowMap.comisionesTiendas),
        
        cajaFfvv: getValue(rowMap.cajaFfvv),
        produccionPlus: getValue(rowMap.produccionPlus),
        produccionBasico: getValue(rowMap.produccionBasico),
        prvFfvv: getValue(rowMap.prvFfvv),
        gastosFfvv: getValue(rowMap.gastosFfvv),
        
        numComercialesFfvv: numComerciales || 1
      };

      await prisma.macroFinanceRecord.upsert({
        where: {
          year_month: { year, month }
        },
        update: recordData,
        create: {
          year,
          month,
          ...recordData
        }
      });
    }
    console.log(`Año ${year} guardado correctamente (12 meses).`);
  }

  console.log('\n¡Importación completada!');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  prisma.$disconnect();
  process.exit(1);
});
