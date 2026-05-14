const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve('microshop.db'); // Wait, check what db it uses
const db = new Database('data/microshop.db'); // Wait, where is the db?
const row = db.prepare("SELECT COUNT(*) as c FROM objetivos").get();
console.log(row);
