const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('prisma/database.sqlite');
db.all("SELECT year, month, concepto, importe_total FROM gastos_historico WHERE year = 2018 AND grupo = 'MERCADERIAS';", (err, rows) => {
  console.log(rows);
});
