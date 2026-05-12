const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:\\Proyecto Tiendas\\MicroShop Tiendas\\webapp_snapshot\\prisma\\database.sqlite';
const db = new sqlite3.Database(dbPath);

db.all("SELECT DISTINCT categoria, detalle FROM sales", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(JSON.stringify(rows, null, 2));
    db.close();
});
