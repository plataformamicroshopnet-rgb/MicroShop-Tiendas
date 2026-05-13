const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { username: { contains: 'Carmen' } } });
  console.log("Carmen's Role:", user.role);
  console.log("Carmen's Permissions:", user.permissions);
  
  // Test parsing
  try {
    const parsed = JSON.parse(user.permissions);
    console.log("Parsed is array?", Array.isArray(parsed));
  } catch(e) {
    console.log("Error parsing:", e.message);
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
