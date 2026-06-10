import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const stock = await prisma.stockItem.findMany({
      orderBy: { producto: 'asc' }
    })

    const msProducts = await prisma.microShopProduct.findMany({
      include: { stocks: true }
    })

    let storeTotals = { Correhuela: 0, Auxiliadora: 0, Bejar: 0, Villamayor: 0 }
    let storeUds = { Correhuela: 0, Auxiliadora: 0, Bejar: 0, Villamayor: 0 }

    msProducts.forEach((p: any) => {
      const coste = p.coste || 0
      p.stocks?.forEach((s: any) => {
        const tienda = s.tienda
        const cantidad = s.cantidad || 0
        if (tienda === 'Correhuela') {
          storeTotals.Correhuela += cantidad * coste
          storeUds.Correhuela += cantidad
        } else if (tienda === 'Auxiliadora 45' || tienda === 'Auxiliadora') {
          storeTotals.Auxiliadora += cantidad * coste
          storeUds.Auxiliadora += cantidad
        } else if (tienda === 'Béjar' || tienda === 'Bejar') {
          storeTotals.Bejar += cantidad * coste
          storeUds.Bejar += cantidad
        } else if (tienda === 'Villamayor') {
          storeTotals.Villamayor += cantidad * coste
          storeUds.Villamayor += cantidad
        }
      })
    })

    const totalValor = storeTotals.Correhuela + storeTotals.Auxiliadora + storeTotals.Bejar + storeTotals.Villamayor
    const totalUds = storeUds.Correhuela + storeUds.Auxiliadora + storeUds.Bejar + storeUds.Villamayor

    const accesoriosHubTotals = {
      Correhuela: storeTotals.Correhuela,
      Auxiliadora: storeTotals.Auxiliadora,
      Bejar: storeTotals.Bejar,
      Villamayor: storeTotals.Villamayor,
      UdsC: storeUds.Correhuela,
      UdsA: storeUds.Auxiliadora,
      UdsB: storeUds.Bejar,
      UdsV: storeUds.Villamayor,
      TotalValor: totalValor,
      TotalUds: totalUds
    }

    return NextResponse.json({ success: true, data: stock, accesoriosHubTotals })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action, tabCategory, items, item } = body

    if (action === 'bulk') {
      // Wipe old stock for this tab to do a fresh replace
      await prisma.stockItem.deleteMany({
        where: { tabCategory }
      })

      if (items && items.length > 0) {
        await prisma.stockItem.createMany({
          data: items.map((it: any) => ({
            tabCategory,
            producto: it.producto,
            pvd: it.pvd || 0,
            pvp: it.pvp || 0,
            udsCorrehuela: it.udsCorrehuela || 0,
            udsAuxiliadora: it.udsAuxiliadora || 0,
            udsBejar: it.udsBejar || 0,
            udsVillamayor: it.udsVillamayor || 0,
            udsMovilfree: it.udsMovilfree || 0,
            observaciones: it.observaciones || ''
          }))
        })
      }
    } else if (action === 'create') {
        const created = await prisma.stockItem.create({
            data: {
                tabCategory: item.tabCategory,
                producto: item.producto,
                pvd: item.pvd || 0,
                pvp: item.pvp || 0,
                udsCorrehuela: item.udsCorrehuela || 0,
                udsAuxiliadora: item.udsAuxiliadora || 0,
                udsBejar: item.udsBejar || 0,
                udsVillamayor: item.udsVillamayor || 0,
                udsMovilfree: item.udsMovilfree || 0,
                observaciones: item.observaciones || ''
            }
        })
        return NextResponse.json({ success: true, data: created })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
    try {
        const { id, ...data } = await req.json()
        const updated = await prisma.stockItem.update({
            where: { id },
            data: {
                producto: data.producto,
                pvd: data.pvd,
                pvp: data.pvp,
                udsCorrehuela: data.udsCorrehuela,
                udsAuxiliadora: data.udsAuxiliadora,
                udsBejar: data.udsBejar,
                udsVillamayor: data.udsVillamayor,
                udsMovilfree: data.udsMovilfree,
                observaciones: data.observaciones
            }
        })
        return NextResponse.json({ success: true, data: updated })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ success: false }, { status: 400 })

        await prisma.stockItem.delete({
            where: { id }
        })
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}