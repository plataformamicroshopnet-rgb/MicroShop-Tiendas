const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Busca el periodo de Abril 2026
  const periods = await p.workPeriod.findMany({ select: { id: true, period_key: true }, orderBy: { period_key: 'desc' }, take: 8 })
  console.log('Períodos en BD:', periods.map(x => x.period_key))

  const apr = periods.find(x => x.period_key.includes('2026') && (x.period_key.endsWith('_4') || x.period_key.endsWith('_04')))
  if (!apr) { console.log('No se encuentra Abril 2026'); return }
  console.log('\nUsando:', apr.period_key, '(id:', apr.id + ')\n')

  const sales = await p.sale.findMany({
    where: {
      periodId: apr.id,
      anulado: { not: 'Si' },
      pendiente: { not: 'Anulado' },
    },
    select: { cuota: true, detalle: true, codigo: true, pendiente: true }
  })

  const PLUS_CODES = ['plus 1ks', 'plus 1sk', 'plus nfg', 'plus n7d', 'plus k2z', 'plus zf7']
  const isPlus = c => PLUS_CODES.some(x => (c || '').toLowerCase().includes(x))
  const isBasico = c => (c || '').toLowerCase().includes('basico xcu') || (c || '').toLowerCase().includes('básico xcu')
  const sum = arr => arr.reduce((t, s) => t + Number(s.cuota ?? 0), 0)

  const tma = sales.filter(s => (s.detalle || '').toLowerCase().trim() === 'tma')
  const micro = sales.filter(s => (s.detalle || '').toLowerCase().trim() === 'micro')

  const tmaPlus = tma.filter(s => isPlus(s.codigo))
  const tmaBasico = tma.filter(s => isBasico(s.codigo))
  const tmaOtros = tma.filter(s => !isPlus(s.codigo) && !isBasico(s.codigo))
  const micPlus = micro.filter(s => isPlus(s.codigo))
  const micBasico = micro.filter(s => isBasico(s.codigo))
  const micOtros = micro.filter(s => !isPlus(s.codigo) && !isBasico(s.codigo))

  console.log('=== TMA (suma de sale.cuota) ===')
  console.log('  Plus   :', sum(tmaPlus).toFixed(2), '  (', tmaPlus.length, 'ventas )')
  console.log('  Básico :', sum(tmaBasico).toFixed(2), '  (', tmaBasico.length, 'ventas )')
  console.log('  Otros  :', sum(tmaOtros).toFixed(2), '  (', tmaOtros.length, 'ventas ) ← estos no van a Plus ni Básico')
  if (tmaOtros.length) console.log('    Codigos Otros:', [...new Set(tmaOtros.map(s => s.codigo))])

  console.log('\n=== Micro (suma de sale.cuota) ===')
  console.log('  Plus   :', sum(micPlus).toFixed(2), '  (', micPlus.length, 'ventas )')
  console.log('  Básico :', sum(micBasico).toFixed(2), '  (', micBasico.length, 'ventas )')
  console.log('  Otros  :', sum(micOtros).toFixed(2), '  (', micOtros.length, 'ventas ) ← estos no van a Plus ni Básico')
  if (micOtros.length) console.log('    Codigos Otros:', [...new Set(micOtros.map(s => s.codigo))])

  console.log('\n=== Referencia esperada ===')
  console.log('  TMA Plus:    28.573,60  Diferencia:', (sum(tmaPlus) - 28573.60).toFixed(2))
  console.log('  TMA Básico:   1.528,23  Diferencia:', (sum(tmaBasico) - 1528.23).toFixed(2))
  console.log('  Micro Plus:   1.948,80  Diferencia:', (sum(micPlus) - 1948.80).toFixed(2))
  console.log('  Micro Básico: 1.744,80  Diferencia:', (sum(micBasico) - 1744.80).toFixed(2))

  // Ventas pendientes incluidas
  const pendientes = sales.filter(s => s.pendiente === 'Pendiente')
  console.log('\n=== Ventas con pendiente=Pendiente incluidas ===', pendientes.length, 'ventas')
  const tmaPend = pendientes.filter(s => (s.detalle || '').toLowerCase() === 'tma')
  const micPend = pendientes.filter(s => (s.detalle || '').toLowerCase() === 'micro')
  if (tmaPend.length) console.log('  TMA pendientes cuota total:', sum(tmaPend).toFixed(2))
  if (micPend.length) console.log('  Micro pendientes cuota total:', sum(micPend).toFixed(2))
}

main().finally(() => p.$disconnect())
