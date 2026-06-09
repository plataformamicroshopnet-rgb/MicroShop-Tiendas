import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== MOVILFREE ===')
  console.log('--- ALL STOCKS ---')
  const stocks = await prisma.movilFreeStock.findMany({
    include: { product: true }
  })
  console.log(stocks.map(s => ({
    tienda: s.tienda,
    product: s.product.nombre,
    cantidad: s.cantidad
  })))

  console.log('--- ALL TRANSFERS ---')
  const transfers = await prisma.movilFreeStockTransfer.findMany({
    include: { product: true }
  })
  console.log(transfers.map(t => ({
    product: t.product.nombre,
    origen: t.origen,
    destino: t.destino,
    cantidad: t.cantidad,
    vendedor: t.vendedor,
    fecha: t.fecha
  })))

  console.log('=== MICROSHOP ===')
  console.log('--- ALL STOCKS ---')
  const msStocks = await prisma.microShopStock.findMany({
    include: { product: true }
  })
  console.log(msStocks.map(s => ({
    tienda: s.tienda,
    product: s.product.nombre,
    cantidad: s.cantidad
  })))

  console.log('--- ALL TRANSFERS ---')
  const msTransfers = await prisma.microShopStockTransfer.findMany({
    include: { product: true }
  })
  console.log(msTransfers.map(t => ({
    product: t.product?.nombre,
    origen: t.origen,
    destino: t.destino,
    cantidad: t.cantidad,
    vendedor: t.vendedor,
    fecha: t.fecha
  })))
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
