const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:\\Proyecto Tiendas\\MicroShop Tiendas\\webapp_snapshot\\prisma\\database.sqlite';
const db = new sqlite3.Database(dbPath);

console.log("Updating DB with correct table names...");
db.serialize(() => {
    db.run("UPDATE Sale SET categoria = 'Rent' WHERE categoria = 'RENT'", function(err) {
        if (err) console.error(err);
        else console.log("Sale categoria RENT updated", this.changes);
    });
    db.run("UPDATE Sale SET categoria = 'Prepago' WHERE categoria = 'PREPAGO'", function(err) {
        if (err) console.error(err);
        else console.log("Sale categoria PREPAGO updated", this.changes);
    });
    db.run("UPDATE Sale SET detalle = 'Rent' WHERE detalle = 'RENT'", function(err) {
        if (err) console.error(err);
        else console.log("Sale detalle RENT updated", this.changes);
    });
    db.run("UPDATE Sale SET detalle = 'Prepago' WHERE detalle = 'PREPAGO'", function(err) {
        if (err) console.error(err);
        else console.log("Sale detalle PREPAGO updated", this.changes);
    });
    db.run("UPDATE ProductCatalog SET categoria = 'Rent' WHERE categoria = 'RENT'", function(err) {
        if (err) console.error(err);
        else console.log("ProductCatalog RENT updated", this.changes);
    });
    db.run("UPDATE ProductCatalog SET categoria = 'Prepago' WHERE categoria = 'PREPAGO'", function(err) {
        if (err) console.error(err);
        else console.log("ProductCatalog PREPAGO updated", this.changes);
    });
});

db.close();
