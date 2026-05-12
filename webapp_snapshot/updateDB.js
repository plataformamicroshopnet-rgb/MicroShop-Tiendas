const sqlite3 = require('sqlite3').verbose();
const dbPath = 'C:\\Proyecto Tiendas\\MicroShop Tiendas\\webapp_snapshot\\prisma\\database.sqlite';
const db = new sqlite3.Database(dbPath);

console.log("Updating DB...");
db.serialize(() => {
    db.run("UPDATE sales SET categoria = 'Rent' WHERE categoria = 'RENT'", function(err) {
        console.log("sales categoria RENT updated", this.changes);
    });
    db.run("UPDATE sales SET categoria = 'Prepago' WHERE categoria = 'PREPAGO'", function(err) {
        console.log("sales categoria PREPAGO updated", this.changes);
    });
    db.run("UPDATE sales SET detalle = 'Rent' WHERE detalle = 'RENT'", function(err) {
        console.log("sales detalle RENT updated", this.changes);
    });
    db.run("UPDATE sales SET detalle = 'Prepago' WHERE detalle = 'PREPAGO'", function(err) {
        console.log("sales detalle PREPAGO updated", this.changes);
    });
    db.run("UPDATE catalogs SET category = 'Rent' WHERE category = 'RENT'", function(err) {
        console.log("catalogs RENT updated", this.changes);
    });
    db.run("UPDATE catalogs SET category = 'Prepago' WHERE category = 'PREPAGO'", function(err) {
        console.log("catalogs PREPAGO updated", this.changes);
    });
});

db.close();
