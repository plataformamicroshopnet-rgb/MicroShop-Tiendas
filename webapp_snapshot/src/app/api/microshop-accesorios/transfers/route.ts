import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const items = await prisma.microShopStockTransfer.findMany({
      include: {
        product: true
      },
      orderBy: {
        fecha: 'desc'
      }
    })
    const mfItems = await prisma.movilFreeStockTransfer.findMany({
      include: {
        product: true
      },
      orderBy: {
        fecha: 'desc'
      }
    })
    const combined = [...items, ...mfItems].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    return NextResponse.json(combined)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const { productId, origen, destino, cantidad, vendedor } = data

    if (!productId || !origen || !destino || !cantidad || !vendedor) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 })
    }

    if (origen === destino) {
      return NextResponse.json({ error: 'El origen y el destino no pueden ser iguales' }, { status: 400 })
    }

    const qty = Number(cantidad)
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ error: 'La cantidad debe ser un número positivo' }, { status: 400 })
    }

    // Check if it belongs to MovilFree
    const isMovilFree = await prisma.movilFreeProduct.findUnique({ where: { id: productId } })
    if (isMovilFree) {
      const movistarStores = ['Auxiliadora 45', 'Correhuela', 'Villamayor', 'Béjar']
      if (movistarStores.includes(destino)) {
        return NextResponse.json({ error: 'Los productos de Movilfree no se pueden traspasar a tiendas Movistar' }, { status: 400 })
      }

      const sourceStock = await prisma.movilFreeStock.findUnique({
        where: {
          productId_tienda: {
            productId,
            tienda: origen
          }
        }
      })

      if (!sourceStock || sourceStock.cantidad < qty) {
        return NextResponse.json({ error: `Stock insuficiente en la tienda origen (${origen === 'O2' ? 'Movilfree' : origen}). Stock actual: ${sourceStock ? sourceStock.cantidad : 0}` }, { status: 400 })
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Decrement origin stock
        const updatedOrigin = await tx.movilFreeStock.update({
          where: {
            productId_tienda: {
              productId,
              tienda: origen
            }
          },
          data: {
            cantidad: { decrement: qty }
          }
        })

        // 2. Increment/Create destination stock
        const updatedDest = await tx.movilFreeStock.upsert({
          where: {
            productId_tienda: {
              productId,
              tienda: destino
            }
          },
          update: {
            cantidad: { increment: qty }
          },
          create: {
            productId,
            tienda: destino,
            cantidad: qty
          }
        })

        // 3. Create transfer log
        const transfer = await tx.movilFreeStockTransfer.create({
          data: {
            productId,
            origen,
            destino,
            cantidad: qty,
            vendedor,
            estado: 'COMPLETADO'
          },
          include: {
            product: true
          }
        })

        return { updatedOrigin, updatedDest, transfer }
      })

      return NextResponse.json(result.transfer)
    }

    // Default to MicroShop
    const sourceStock = await prisma.microShopStock.findUnique({
      where: {
        productId_tienda: {
          productId,
          tienda: origen
        }
      }
    })

    if (!sourceStock || sourceStock.cantidad < qty) {
      return NextResponse.json({ error: `Stock insuficiente en la tienda origen (${origen}). Stock actual: ${sourceStock ? sourceStock.cantidad : 0}` }, { status: 400 })
    }

    // Atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Decrement origin stock
      const updatedOrigin = await tx.microShopStock.update({
        where: {
          productId_tienda: {
            productId,
            tienda: origen
          }
        },
        data: {
          cantidad: { decrement: qty }
        }
      })

      // 2. Increment/Create destination stock
      const updatedDest = await tx.microShopStock.upsert({
        where: {
          productId_tienda: {
            productId,
            tienda: destino
          }
        },
        update: {
          cantidad: { increment: qty }
        },
        create: {
          productId,
          tienda: destino,
          cantidad: qty
        }
      })

      // 3. Create transfer log
      const transfer = await tx.microShopStockTransfer.create({
        data: {
          productId,
          origen,
          destino,
          cantidad: qty,
          vendedor,
          estado: 'COMPLETADO'
        },
        include: {
          product: true
        }
      })

      return { updatedOrigin, updatedDest, transfer }
    })

    return NextResponse.json(result.transfer)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
