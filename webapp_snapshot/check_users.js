const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany().then(users => {
  console.log(JSON.stringify(users.map(u => ({name: u.name, role: u.role, codigo: u.codigoComercial})), null, 2));
  process.exit();
});
