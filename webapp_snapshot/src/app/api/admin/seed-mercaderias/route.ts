import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { SEED_DATA } from './data'

const prisma = new PrismaClient()

export async function GET() {
  try {
    let count = 0
    for (const item of SEED_DATA) {
      await prisma.gastoMensual.upsert({
        where: {
          year_month_grupo_concepto: {
            year: item.year,
            month: item.month,
            grupo: item.grupo,
            concepto: item.concepto
          }
        },
        update: {
          importe_r: item.importe_r
        },
        create: {
          year: item.year,
          month: item.month,
          grupo: item.grupo,
          concepto: item.concepto,
          importe_r: item.importe_r
        }
      })
      count++
    }
    
    return NextResponse.json({ success: true, count, message: 'Semilla ejecutada con éxito' })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
