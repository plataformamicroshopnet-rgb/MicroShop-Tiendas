import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Testing minimum insert...")
    try {
        await prisma.productCatalog.createMany({
            data: [{
                categoria: "Test",
                producto: "Test Product",
                mensual: "5.00",
                anual: "120.00",
                validFrom: "01/04/2026",
                validTo: null,
                periodId: null
            }]
        })
        console.log("Success!")
    } catch(e: any) {
        console.error("Prisma error:", e.message)
    } finally {
        await prisma.productCatalog.deleteMany({where: {categoria: "Test"}})
    }
}
main()
