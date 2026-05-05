import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const usersRaw = fs.readFileSync('./users_dump.json', 'utf8');
  const users = JSON.parse(usersRaw);
  
  console.log('Restaurando usuarios base...');
  for (const u of users) {
    try {
      await prisma.user.create({
        data: {
          id: u.id,
          username: u.username,
          password: u.password,
          role: u.role,
          permissions: u.permissions,
          codigoComercial: u.codigoComercial
        }
      });
      console.log(`Usuario restaurado: ${u.username}`);
    } catch (e) {
      console.log(`Error restaurando ${u.username}:`, e.message);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
