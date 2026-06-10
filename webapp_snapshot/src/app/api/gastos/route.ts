export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const conceptoParam = searchParams.get('concepto')
    const grupoParam = searchParams.get('grupo')
    
    // Si envían 'concepto', devolvemos el histórico completo de ese concepto (para gráficas comparativas)
    if (conceptoParam) {
      const records = await prisma.gastoMensual.findMany({
        where: { concepto: conceptoParam },
        orderBy: [{ year: 'asc' }, { month: 'asc' }]
      })
      return NextResponse.json({ success: true, data: records })
    }

    if (grupoParam && !yearParam) {
      const records = await prisma.gastoMensual.findMany({
        where: { grupo: grupoParam },
        orderBy: [{ year: 'asc' }, { month: 'asc' }]
      })
      return NextResponse.json({ success: true, data: records })
    }

    // Si envían año, devolvemos los de ese año
    if (yearParam) {
      const records = await prisma.gastoMensual.findMany({
        where: { year: parseInt(yearParam) },
        orderBy: [{ month: 'asc' }]
      })
      return NextResponse.json({ success: true, data: records })
    }

    // Si no envían nada, devolvemos todo (cuidado con grandes volúmenes, pero por ahora útil)
    const records = await prisma.gastoMensual.findMany()
    return NextResponse.json({ success: true, data: records })
    
  } catch (error) {
    console.error('[GET /api/gastos]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener gastos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, month, grupo, concepto, importe_c, importe_r, importe_dif, importe_total, notas } = body

    if (!year || !month || !grupo || !concepto) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Upsert para crear o actualizar si ya existe
    const record = await prisma.gastoMensual.upsert({
      where: {
        year_month_grupo_concepto: {
          year: parseInt(year),
          month: parseInt(month),
          grupo,
          concepto
        }
      },
      update: {
        importe_c: importe_c !== undefined ? parseFloat(importe_c) : undefined,
        importe_r: importe_r !== undefined ? parseFloat(importe_r) : undefined,
        importe_dif: importe_dif !== undefined ? parseFloat(importe_dif) : undefined,
        importe_total: importe_total !== undefined ? parseFloat(importe_total) : undefined,
        notas: notas !== undefined ? notas : undefined
      },
      create: {
        year: parseInt(year),
        month: parseInt(month),
        grupo,
        concepto,
        importe_c: parseFloat(importe_c || 0),
        importe_r: parseFloat(importe_r || 0),
        importe_dif: parseFloat(importe_dif || 0),
        importe_total: parseFloat(importe_total || 0),
        notas: notas || null
      }
    })

    return NextResponse.json({ success: true, data: record })
  } catch (error) {
    console.error('[POST /api/gastos]', error)
    return NextResponse.json({ success: false, error: 'Error al guardar gasto' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { items } = body // Array of { year, month, grupo, concepto, importe_c, importe_r, importe_dif, importe_total }

    if (!Array.isArray(items)) {
      return NextResponse.json({ success: false, error: 'El cuerpo debe contener un array "items"' }, { status: 400 })
    }

    // Procesamos en paralelo o en transacción (transacción es más seguro)
    const results = await prisma.$transaction(
      items.map((item: any) => 
        prisma.gastoMensual.upsert({
          where: {
            year_month_grupo_concepto: {
              year: parseInt(item.year),
              month: parseInt(item.month),
              grupo: item.grupo,
              concepto: item.concepto
            }
          },
          update: {
            importe_c: parseFloat(item.importe_c || 0),
            importe_r: parseFloat(item.importe_r || 0),
            importe_dif: parseFloat(item.importe_dif || 0),
            importe_total: parseFloat(item.importe_total || 0)
          },
          create: {
            year: parseInt(item.year),
            month: parseInt(item.month),
            grupo: item.grupo,
            concepto: item.concepto,
            importe_c: parseFloat(item.importe_c || 0),
            importe_r: parseFloat(item.importe_r || 0),
            importe_dif: parseFloat(item.importe_dif || 0),
            importe_total: parseFloat(item.importe_total || 0)
          }
        })
      )
    )

    return NextResponse.json({ success: true, count: results.length })
  } catch (error) {
    console.error('[PUT /api/gastos]', error)
    return NextResponse.json({ success: false, error: 'Error al procesar subida masiva' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, concepto, grupo } = body

    if (!year || !concepto || !grupo) {
      return NextResponse.json({ success: false, error: 'Faltan campos' }, { status: 400 })
    }

    // Borramos todos los registros de ese concepto en ese año
    await prisma.gastoMensual.deleteMany({
      where: {
        year: parseInt(year),
        concepto,
        grupo
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/gastos]', error)
    return NextResponse.json({ success: false, error: 'Error al borrar' }, { status: 500 })
  }
}
