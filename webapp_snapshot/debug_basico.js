const { PrismaClient } = require('./node_modules/.prisma/client');
const db = new PrismaClient();
async function main() {
  const periods = await db.workPeriod.findMany({ where: { status: 'ACTIVE' } });
  const pid = periods[0]?.id;
  console.log('Period:', periods[0]?.period_key, 'id:', pid);

  const rows = await db.importePlus.findMany({ where: { periodId: pid }, orderBy: { createdAt: 'asc' } });
  const interesting = rows.filter(r => {
    const g = (r.grupo||'').toUpperCase();
    const c = (r.concepto||'').toLowerCase();
    return g.includes('TMA') || g.includes('MIC') || g.includes('MICRO') || g.includes('TI') || c.includes('tma') || c.includes('micro');
  });
  console.log('\n=== importesPlus (Basico) TMA/MIC/TI rows ===');
  interesting.forEach(r => console.log(JSON.stringify({grupo:r.grupo,concepto:r.concepto,isPercentage:r.isPercentage,objetivoUds:r.objetivoUds,totalObjetivos:r.totalObjetivos,t1:r.comisionNacionalMenos50,t2:r.comisionNacionalEntre50Y80,t3:r.comisionNacionalEntre80Y100,t4:r.comisionNacionalMas100})));

  const objs = await db.objetivoPeriodo.findMany({ where: { periodId: pid } });
  const captObj = objs.filter(o => o.profile === 'Captador');
  console.log('\n=== Captador objectives ===');
  captObj.forEach(o => console.log(JSON.stringify({concepto:o.concepto, value:o.value, grupo:o.grupo})));

  // Check sales with detalle=tma that are basico
  const sales = await db.venta.findMany({ where: { periodId: pid } });
  const basicoTMA = sales.filter(s => {
    const c = (s.codigo||'').toLowerCase();
    const isBasico = c.includes('basico xcu') || c.includes('básico xcu');
    const d = (s.detalle||'').toLowerCase().trim();
    return isBasico && d === 'tma';
  });
  console.log('\n=== Basico TMA sales ===', basicoTMA.length, 'total');
  const confirmed = basicoTMA.filter(s => s.estado !== 'Pendiente' && s.pendiente !== 'Si');
  const pending = basicoTMA.filter(s => s.estado === 'Pendiente' || s.pendiente === 'Si');
  const sumC = confirmed.reduce((a,s)=>a+parseFloat(String(s.cuota||s.importe||'0').replace(',','.')),0);
  const sumP = pending.reduce((a,s)=>a+parseFloat(String(s.cuota||s.importe||'0').replace(',','.')),0);
  console.log('Confirmed:', confirmed.length, 'sum cuota:', sumC.toFixed(2));
  console.log('Pending:', pending.length, 'sum cuota:', sumP.toFixed(2));
}
main().catch(console.error).finally(()=>db.$disconnect());
