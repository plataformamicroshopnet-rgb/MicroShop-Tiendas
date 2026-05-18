const { PrismaClient } = require('@prisma/client')
const xlsx = require('xlsx')
const fs = require('fs')

const prisma = new PrismaClient()
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

async function main() {
  const files = fs.readdirSync('.').filter(f => f.startsWith('Informe ') && f.endsWith('.xlsx'))

  for (const file of files) {
    const yearMatch = file.match(/Informe (\d{4})\.xlsx/)
    if (!yearMatch) continue
    const year = parseInt(yearMatch[1])
    console.log(`Procesando ${file} (Año ${year})...`)

    const wb = xlsx.readFile(file)
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 })

    const comprasRow = json.find(r => r.some(c => typeof c === 'string' && c.toLowerCase().includes('compras mercaderias')))
    const ventasRow = json.find(r => r.some(c => typeof c === 'string' && c.toLowerCase() === 'ventas mercaderias'))

    const extract12Months = (row) => {
      if (!row) return null
      const nums = row.filter(c => typeof c === 'number')
      if (nums.length === 12) return nums
      if (nums.length === 13) return nums.slice(1)
      if (nums.length > 13) return nums.slice(-12)
      return null
    }

    const compras = extract12Months(comprasRow)
    const ventas = extract12Months(ventasRow)

    if (compras) {
      for (let i = 0; i < 12; i++) {
        const importe = compras[i]
        const month = i + 1

        const existing = await prisma.gastoMensual.findFirst({
          where: { year, month, grupo: 'MERCADERIAS', concepto: 'Compras Mercaderías' }
        })

        if (existing) {
          await prisma.gastoMensual.update({
            where: { id: existing.id },
            data: { importe_r: importe }
          })
        } else {
          await prisma.gastoMensual.create({
            data: { year, month, grupo: 'MERCADERIAS', concepto: 'Compras Mercaderías', importe_r: importe }
          })
        }
      }
      console.log(`  - Compras importadas (${compras.length} meses)`)
    } else {
      console.log(`  - No se encontraron Compras`)
    }

    if (ventas) {
      for (let i = 0; i < 12; i++) {
        const importe = ventas[i]
        const month = i + 1

        const existing = await prisma.gastoMensual.findFirst({
          where: { year, month, grupo: 'MERCADERIAS', concepto: 'Ventas Mercaderías' }
        })

        if (existing) {
          await prisma.gastoMensual.update({
            where: { id: existing.id },
            data: { importe_r: importe }
          })
        } else {
          await prisma.gastoMensual.create({
            data: { year, month, grupo: 'MERCADERIAS', concepto: 'Ventas Mercaderías', importe_r: importe }
          })
        }
      }
      console.log(`  - Ventas importadas (${ventas.length} meses)`)
    } else {
      console.log(`  - No se encontraron Ventas`)
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
