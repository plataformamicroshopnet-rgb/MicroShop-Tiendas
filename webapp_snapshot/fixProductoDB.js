const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:\\Proyecto Tiendas\\MicroShop Tiendas\\webapp_snapshot\\prisma\\database.sqlite';
const db = new sqlite3.Database(dbPath);

console.log("Updating producto strings in DB...");
db.serialize(() => {
    // Sale table
    db.run("UPDATE Sale SET producto = REPLACE(producto, ' RENT', ' Rent') WHERE producto LIKE '% RENT%'", function(err) {
        if (err) console.error(err); else console.log("Sale producto RENT updated:", this.changes);
    });
    db.run("UPDATE Sale SET producto = REPLACE(producto, ' PREPAGO', ' Prepago') WHERE producto LIKE '% PREPAGO%'", function(err) {
        if (err) console.error(err); else console.log("Sale producto PREPAGO updated:", this.changes);
    });
    db.run("UPDATE Sale SET producto = REPLACE(producto, 'RENT ', 'Rent ') WHERE producto LIKE 'RENT %'", function(err) {
        if (err) console.error(err); else console.log("Sale producto RENT prefix updated:", this.changes);
    });
    db.run("UPDATE Sale SET producto = REPLACE(producto, 'PREPAGO ', 'Prepago ') WHERE producto LIKE 'PREPAGO %'", function(err) {
        if (err) console.error(err); else console.log("Sale producto PREPAGO prefix updated:", this.changes);
    });

    // ProductCatalog table
    db.run("UPDATE ProductCatalog SET producto = REPLACE(producto, ' RENT', ' Rent') WHERE producto LIKE '% RENT%'", function(err) {
        if (err) console.error(err); else console.log("ProductCatalog producto RENT updated:", this.changes);
    });
    db.run("UPDATE ProductCatalog SET producto = REPLACE(producto, ' PREPAGO', ' Prepago') WHERE producto LIKE '% PREPAGO%'", function(err) {
        if (err) console.error(err); else console.log("ProductCatalog producto PREPAGO updated:", this.changes);
    });
    db.run("UPDATE ProductCatalog SET producto = REPLACE(producto, 'RENT ', 'Rent ') WHERE producto LIKE 'RENT %'", function(err) {
        if (err) console.error(err); else console.log("ProductCatalog producto RENT prefix updated:", this.changes);
    });
    db.run("UPDATE ProductCatalog SET producto = REPLACE(producto, 'PREPAGO ', 'Prepago ') WHERE producto LIKE 'PREPAGO %'", function(err) {
        if (err) console.error(err); else console.log("ProductCatalog producto PREPAGO prefix updated:", this.changes);
    });
});

setTimeout(() => db.close(), 1000);
