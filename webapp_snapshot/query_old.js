const { PrismaClient } = require('@prisma/client');
function queryOld() {
  const p = new PrismaClient({ datasources: { db: { url: 'file:./database.sqlite.bkp' } } });
  p.sale.count().then(c => console.log('BKP Sales:', c)).catch(e=>console.error).finally(()=>p.$disconnect());
}
function queryPeriodId() {
  const p = new PrismaClient({ datasources: { db: { url: 'file:./database_backup_antes_periodId.sqlite' } } });
  p.sale.count().then(c => console.log('PERIOD Sales:', c)).catch(e=>console.error).finally(()=>p.$disconnect());
}
queryOld();
queryPeriodId();
