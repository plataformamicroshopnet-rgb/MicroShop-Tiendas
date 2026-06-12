// Migración idempotente: copia el Boletín al Nº Pedido Movistar en las
// ventas donde el Nº Pedido esté vacío. El boletín era donde los
// comerciales apuntaban el código de operación de Movistar (CO...)
// antes de existir el campo numeroPedido. No toca filas que ya tengan
// numeroPedido, así que es seguro ejecutarla en cada arranque.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const candidatas = await prisma.sale.findMany({
    where: {
      AND: [
        { OR: [{ numeroPedido: null }, { numeroPedido: '' }] },
        { NOT: { boletin: null } },
        { NOT: { boletin: '' } }
      ]
    },
    select: { id: true, boletin: true }
  });

  let migradas = 0;
  for (const s of candidatas) {
    const valor = String(s.boletin || '').trim();
    if (!valor) continue;
    await prisma.sale.update({
      where: { id: s.id },
      data: { numeroPedido: valor.slice(0, 20) }
    });
    migradas++;
  }
  console.log(`[Boot-Migracion] Boletin -> N Pedido: ${migradas} filas migradas (de ${candidatas.length} candidatas).`);
}

main()
  .catch(err => console.error('[Boot-Migracion] Error migrando boletin a numeroPedido:', err))
  .finally(() => prisma.$disconnect());
