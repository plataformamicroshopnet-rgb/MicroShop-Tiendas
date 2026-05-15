const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function run() {
    console.log("Iniciando importación de Liquidez Ángel Luis (vía SQLite directa)...");

    const rawData = fs.readFileSync('prestamos_dump.json', 'utf-8');
    const allSheets = JSON.parse(rawData);
    
    const sheet = allSheets.find(s => s.sheet === 'Liquidez Angel Luis');
    if (!sheet) {
        throw new Error("No se encontró la pestaña 'Liquidez Angel Luis'");
    }

    const data = sheet.data;

    // Años y sus índices de columna (los datos están en las columnas pares, las impares son "Diferencia")
    const years = [
        { index: 2, year: 2018 },
        { index: 4, year: 2019 },
        { index: 6, year: 2020 },
        { index: 8, year: 2021 },
        { index: 10, year: 2022 },
        { index: 12, year: 2023 },
        { index: 14, year: 2024 },
        { index: 16, year: 2025 },
        { index: 18, year: 2026 },
    ];

    const mappings = [
        { rowIdx: 2, field: 'liqSantander' },
        { rowIdx: 3, field: 'liqUnicaja' },
        { rowIdx: 4, field: 'liqCajaMetalico' },
        { rowIdx: 5, field: 'liqRentaCampoamor' },
        { rowIdx: 6, field: 'liqRentaRecreo' },
        { rowIdx: 7, field: 'liqRentaVillaviciosa' },
        { rowIdx: 8, field: 'planPensiones' },
        { rowIdx: 9, field: 'liqPrestamoEmpresaPiso' },
        { rowIdx: 10, field: 'liqPrestamoEmpresa' },
        { rowIdx: 11, field: 'liqPrestamoEmpresaImpuestos' },
        { rowIdx: 12, field: 'liqPrestamoEmpresaFinMes' },
        { rowIdx: 13, field: 'liqInteresesPrestamo' },
        { rowIdx: 14, field: 'liqSueldos' },
        { rowIdx: 15, field: 'liqPisoCampoamor' },
        { rowIdx: 16, field: 'liqPisoRecreo' },
        { rowIdx: 17, field: 'liqPisoVillaviciosa' },
        { rowIdx: 18, field: 'liqHipotecaCampoamor1' },
        { rowIdx: 19, field: 'liqHipotecaCampoamor2' },
        { rowIdx: 20, field: 'liqHacienda' },
    ];

    const db = new sqlite3.Database(path.join(__dirname, 'prisma', 'database.sqlite'));

    for (const { index, year } of years) {
        const updateData = {};
        
        for (const map of mappings) {
            const rawValue = data[map.rowIdx]?.[index];
            if (rawValue !== null && rawValue !== undefined && rawValue !== "" && rawValue !== " ") {
                updateData[map.field] = Number(rawValue);
            } else {
                updateData[map.field] = 0;
            }
        }

        const sets = Object.keys(updateData).map(k => `${k} = ${updateData[k]}`);
        const sql = `UPDATE PatrimonioRecord SET ${sets.join(', ')} WHERE year = ${year}`;

        await new Promise((resolve, reject) => {
            db.run(sql, function(err) {
                if (err) reject(err);
                else {
                    console.log(`Guardado Liquidez año ${year}`);
                    resolve();
                }
            });
        });
    }

    db.close();
    console.log("¡Importación de Liquidez completada!");
}

run().catch(e => console.error(e));
