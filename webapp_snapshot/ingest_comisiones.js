const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

const monthMap = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12'
};

function parseSheetName(sheetName) {
    const lower = sheetName.toLowerCase().replace(/\s/g, '');
    let monthPart = lower.substring(0, 3);
    let yearPart = lower.substring(3);
    
    if (yearPart.length === 2) {
        yearPart = '20' + yearPart;
    }
    
    const monthNum = monthMap[monthPart];
    if (!monthNum) return null;
    
    // We will use format "YYYY_MM" to be fully compatible with global periods optionally, 
    // but without actually creating global periods.
    return {
        periodKey: `${yearPart}_${monthNum}`
    };
}

async function main() {
    const p = path.resolve('Comisiones Tiendas y FFVV v2.xlsx');
    const wb = xlsx.readFile(p);
    
    for (const sheetName of wb.SheetNames) {
        const periodInfo = parseSheetName(sheetName);
        if (!periodInfo) {
            console.log(`Saltando pestaña irreconocible: ${sheetName}`);
            continue;
        }
        
        console.log(`Procesando ${sheetName} -> ${periodInfo.periodKey}`);
        
        const sheet = wb.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        let count = 0;
        
        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const ffvvName = row[0]; 
            const tiendaName = row[9];
            
            // FFVV
            if (ffvvName && typeof ffvvName === 'string' && !ffvvName.toUpperCase().includes('TOTAL')) {
                const importe = parseFloat(row[1]) || null;
                const aceleradores = parseFloat(row[2]) || null;
                const descuentos = parseFloat(row[3]) || null;
                const dietas = parseFloat(row[4]) || null;
                const km = parseFloat(row[5]) || null;
                const incentivos = parseFloat(row[6]) || null;
                const total = (importe || 0) + (aceleradores || 0) - (descuentos || 0);
                
                await prisma.comisionFFVVTienda.create({
                    data: {
                        periodKey: periodInfo.periodKey,
                        tipo: 'FFVV',
                        nombre: ffvvName,
                        importe, aceleradores, descuentos, dietas, km, incentivos, total
                    }
                });
                count++;
            }
            
            // TIENDAS Y LOGISTICA
            if (tiendaName && typeof tiendaName === 'string' && !tiendaName.toUpperCase().includes('TOTAL') && !tiendaName.toUpperCase().includes('IMPORTE') && tiendaName.toUpperCase() !== 'NULL') {
                if (tiendaName.toUpperCase() === 'SALVA') {
                    const importe = parseFloat(row[10]) || null;
                    const gasolina = parseFloat(row[11]) || null;
                    const dietas = parseFloat(row[12]) || null;
                    const km = parseFloat(row[13]) || null;
                    const incentivos = parseFloat(row[14]) || null;
                    const total = (importe || 0) + (gasolina || 0) + (dietas || 0) + (km || 0) + (incentivos || 0);
                    
                    await prisma.comisionFFVVTienda.create({
                        data: {
                            periodKey: periodInfo.periodKey,
                            tipo: 'LOGISTICA',
                            nombre: tiendaName,
                            importe, gasolina, dietas, km, incentivos, total
                        }
                    });
                    count++;
                } else {
                    const importe = parseFloat(row[10]) || null;
                    const o2Varios = parseFloat(row[11]) || null;
                    const descuentos = parseFloat(row[12]) || null;
                    const total = (importe || 0) + (o2Varios || 0) - (descuentos || 0);
                    
                    await prisma.comisionFFVVTienda.create({
                        data: {
                            periodKey: periodInfo.periodKey,
                            tipo: 'TIENDA',
                            nombre: tiendaName,
                            importe, o2Varios, descuentos, total
                        }
                    });
                    count++;
                }
            }
        }
        
        console.log(`Insertados ${count} registros en ${periodInfo.periodKey}`);
    }
    console.log("¡Volcado completado!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
