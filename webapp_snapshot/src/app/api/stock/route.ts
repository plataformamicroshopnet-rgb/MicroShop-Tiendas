import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const stock = await prisma.stockItem.findMany({
      orderBy: { producto: 'asc' }
    })
    return NextResponse.json({ success: true, data: stock })
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