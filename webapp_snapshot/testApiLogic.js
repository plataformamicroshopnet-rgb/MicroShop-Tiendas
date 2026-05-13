const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function canView(user, moduleName) {
  let parsedPerms = user.permissions;
  if (typeof user.permissions === 'string') {
    try { parsedPerms = JSON.parse(user.permissions); } catch(e) {}
  }
  const activePerms = (parsedPerms !== null && Array.isArray(parsedPerms)) 
    ? parsedPerms 
    : [];

  if (moduleName === 'MODULE_TIENDAS') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('HUB_BACKOFFICE');
  if (moduleName === 'MODULE_BACK_OFFICE') return activePerms.includes('HUB_BACKOFFICE');
  return false;
}

async function main() {
  const dbUser = await prisma.user.findUnique({ where: { username: 'Carmen' } });
  
  const user = { username: dbUser.username, role: dbUser.role, permissions: dbUser.permissions };
  const hasBackofficePerms = canView(user, 'MODULE_BACK_OFFICE');
  
  console.log("hasBackofficePerms:", hasBackofficePerms);
  
  const baseWhereClause = (user.role === 'ADMIN' || user.role === 'JEFE_VENTAS' || user.role === 'BACK_OFFICE' || hasBackofficePerms)
        ? {} 
        : { vendedor: { equals: user.username || 'BLOCK_EMPTY_USER' } };
        
  console.log("baseWhereClause:", baseWhereClause);
  
  const count = await prisma.sale.count({ where: baseWhereClause });
  console.log("Total sales returned:", count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
