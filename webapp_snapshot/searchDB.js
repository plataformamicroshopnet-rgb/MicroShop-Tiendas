const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:\\Proyecto Tiendas\\MicroShop Tiendas\\webapp_snapshot\\prisma\\database.sqlite';
const db = new sqlite3.Database(dbPath);

const tables = ['Sale', 'ProductCatalog', 'VentaLibroMayor', 'Objective', 'AppSetting', 'ExtraRule', 'TiendaCommissionRule'];

db.serialize(() => {
    tables.forEach(table => {
        db.all(`PRAGMA table_info(${table})`, (err, cols) => {
            if (!cols) return;
            const textCols = cols.filter(c => c.type === 'TEXT').map(c => c.name);
            textCols.forEach(col => {
                db.all(`SELECT DISTINCT ${col} FROM ${table} WHERE ${col} LIKE '%RENT%' OR ${col} LIKE '%PREPAGO%'`, (err, rows) => {
                    if (rows && rows.length > 0) {
                        console.log(`Table ${table}, Column ${col}:`, rows);
                    }
                });
            });
        });
    });
});

setTimeout(() => db.close(), 1000);
