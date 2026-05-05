const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./prisma/database.sqlite');
db.all("SELECT count(*) as count FROM Sale", (err, rows) => {
  if (err) console.error(err);
  else console.log("Raw SQLite Sale Count:", rows);
});
