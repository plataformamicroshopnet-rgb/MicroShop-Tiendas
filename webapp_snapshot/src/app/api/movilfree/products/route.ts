import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { nextIdentificador } from '@/lib/identificador'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const items = await prisma.movilFreeProduct.findMany({
      include: { stocks: true },
      orderBy: { createdAt: 'desc' }
    })

    // Auto-migrate legacy stocks to MovilFreeStock (O2) if empty
    let migrated = false
    for (const item of items) {
      if (item.stocks.length === 0 && item.stock > 0) {
        await prisma.movilFreeStock.create({
          data: {
            productId: item.id,
            tienda: 'O2',
            cantidad: item.stock
          }
        }).catch(e => console.error("Error migrating stock:", e))
        migrated = true
      }
    }

    let finalItems = items
    if (migrated) {
      finalItems = await prisma.movilFreeProduct.findMany({
        include: { stocks: true },
        orderBy: { createdAt: 'desc' }
      })
    }

    const msItems = await prisma.microShopProduct.findMany({
      include: { stocks: true },
      orderBy: { createdAt: 'desc' }
    })

    const combined = [
      ...finalItems.map(item => ({ ...item, isMovilFree: true })),
      ...msItems.map(item => ({ ...item, isMovilFree: false }))
    ]
    return NextResponse.json(combined)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Un terminal con IMEI es una UNIDAD ÚNICA serializada: cada IMEI es su propia
// ficha (stock 1) y NO se fusiona por nombre. Los accesorios y los terminales
// sin IMEI siguen acumulándose por nombre+cantidad (comportamiento histórico).
const isTerminal = (cat: any) => String(cat || '').trim().toLowerCase() === 'terminal'
const cleanImei = (v: any) => String(v || '').replace(/\D/g, '').trim()

export async function POST(req: Request) {
  try {
    const data = await req.json()

    // Crea una unidad de terminal serializada. Devuelve { error } si el IMEI no
    // es válido o ya existe (cada IMEI debe ser único en todo el catálogo).
    const createTerminalUnit = async (prod: any, tienda: string) => {
      const imei = cleanImei(prod.imei)
      if (imei.length !== 15) {
        return { error: `IMEI inválido para "${(prod.nombre || 'terminal').toString().trim()}": deben ser 15 dígitos.` }
      }
      const dup = await prisma.movilFreeProduct.findFirst({ where: { imei } })
      if (dup) {
        return { error: `Ya existe un terminal con el IMEI ${imei} ("${dup.nombre}"). Cada IMEI debe ser único.` }
      }
      const product = await prisma.movilFreeProduct.create({
        data: {
          nombre: (prod.nombre || 'Terminal').toString().trim(),
          categoria: 'Terminal',
          precio: Number(prod.precio) || 0,
          coste: Number(prod.coste) || 0,
          stock: 0,
          imei,
          identificador: await nextIdentificador(prisma),
          ...(prod.createdAt ? { createdAt: new Date(prod.createdAt) } : {})
        }
      })
      // Cada IMEI = 1 unidad en la tienda indicada.
      await prisma.movilFreeStock.create({
        data: { productId: product.id, tienda, cantidad: 1 }
      })
      return { product }
    }

    // ── Importación en masa ──
    if (Array.isArray(data) || Array.isArray(data.products)) {
      const productsList = Array.isArray(data) ? data : data.products
      const tienda = Array.isArray(data) ? 'O2' : (data.tienda || 'O2')

      let count = 0
      const errores: string[] = []

      // Terminales con IMEI: una ficha por unidad, sin fusionar por nombre.
      const seenImeis = new Set<string>()
      const terminalRows = productsList.filter((it: any) => isTerminal(it.categoria) && cleanImei(it.imei).length > 0)
      const otherRows = productsList.filter((it: any) => !(isTerminal(it.categoria) && cleanImei(it.imei).length > 0))

      for (const prod of terminalRows) {
        const imei = cleanImei(prod.imei)
        if (seenImeis.has(imei)) { errores.push(`IMEI ${imei} repetido en el pegado: se ignora la duplicada.`); continue }
        seenImeis.add(imei)
        const r = await createTerminalUnit(prod, tienda)
        if (r.error) errores.push(r.error)
        else count++
      }

      // Resto (accesorios + terminales sin IMEI): se acumulan por nombre.
      const map = new Map<string, any>()
      for (const item of otherRows) {
        const key = item.nombre ? item.nombre.trim() : 'Desconocido'
        if (map.has(key)) {
          map.get(key).stock += (Number(item.stock) || 1)
        } else {
          map.set(key, { ...item, nombre: key, stock: Number(item.stock) || 1 })
        }
      }

      for (const prod of Array.from(map.values())) {
        let product = await prisma.movilFreeProduct.findFirst({ where: { nombre: prod.nombre } })
        if (product) {
          product = await prisma.movilFreeProduct.update({
            where: { id: product.id },
            data: {
              precio: prod.precio,
              coste: prod.coste,
              categoria: prod.categoria,
              ...(prod.createdAt ? { createdAt: new Date(prod.createdAt) } : {})
            }
          })
        } else {
          product = await prisma.movilFreeProduct.create({
            data: {
              nombre: prod.nombre,
              categoria: prod.categoria || 'Varios',
              precio: prod.precio || 0,
              coste: prod.coste || 0,
              stock: 0,
              imei: prod.imei || null,
              identificador: await nextIdentificador(prisma),
              ...(prod.createdAt ? { createdAt: new Date(prod.createdAt) } : {})
            }
          })
        }

        const targetStock = Number(prod.stock) || 0
        await prisma.movilFreeStock.upsert({
          where: { productId_tienda: { productId: product.id, tienda } },
          update: { cantidad: { increment: targetStock } },
          create: { productId: product.id, tienda, cantidad: targetStock }
        })
        count++
      }

      return NextResponse.json({ success: true, count, errores })
    }

    // ── Alta individual ──
    const tienda = data.tienda || 'O2'

    // Terminal con IMEI → ficha única por unidad (stock 1).
    if (isTerminal(data.categoria) && cleanImei(data.imei).length > 0) {
      const r = await createTerminalUnit(data, tienda)
      if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
      const result = await prisma.movilFreeProduct.findUnique({
        where: { id: r.product!.id },
        include: { stocks: true }
      })
      return NextResponse.json(result)
    }

    // Resto: dedup por nombre + acumula stock (comportamiento histórico).
    const pName = data.nombre ? data.nombre.trim() : 'Sin Nombre'
    let product = await prisma.movilFreeProduct.findFirst({ where: { nombre: pName } })

    if (product) {
      product = await prisma.movilFreeProduct.update({
        where: { id: product.id },
        data: {
          categoria: data.categoria || product.categoria,
          precio: Number(data.precio) || product.precio,
          coste: Number(data.coste) || product.coste,
          imei: data.imei || product.imei
        }
      })
    } else {
      product = await prisma.movilFreeProduct.create({
        data: {
          nombre: pName,
          categoria: data.categoria || 'Varios',
          precio: Number(data.precio) || 0,
          coste: Number(data.coste) || 0,
          stock: 0,
          imei: data.imei || null,
          identificador: await nextIdentificador(prisma)
        }
      })
    }

    // Upsert store specific stock
    const targetStock = Number(data.stock) || 0
    await prisma.movilFreeStock.upsert({
      where: { productId_tienda: { productId: product.id, tienda } },
      update: { cantidad: { increment: targetStock } },
      create: { productId: product.id, tienda, cantidad: targetStock }
    })

    const result = await prisma.movilFreeProduct.findUnique({
      where: { id: product.id },
      include: { stocks: true }
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
