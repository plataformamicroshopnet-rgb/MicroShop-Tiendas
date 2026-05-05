const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
prisma.user.findMany().then(users => {
  fs.writeFileSync('users.json', JSON.stringify(users.map(u => ({username: u.username, role: u.role, codigo: u.codigoComercial})), null, 2));
  process.exit();
});
