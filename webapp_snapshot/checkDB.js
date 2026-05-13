const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    // get all active O2 records
    const records = await prisma.productCatalog.findMany({
        where: { categoria: 'O2' }
    });
    
    // Check if there are any products that might have been rejected
    // For example, products with no subcategoria? No, they have 'Alta/Porta'
    // Let's check what is in the Excel file by writing a dummy script that the AI can run later if the user provides the raw text
    console.log("DB count: " + records.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
