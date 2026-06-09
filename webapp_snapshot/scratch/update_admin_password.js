const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const username = 'Admin';
  const password = '103admin@=password_M77';
  
  const user = await prisma.user.upsert({
    where: { username: username },
    update: {
      password: password,
      role: 'ADMIN' // Ensure it has ADMIN role
    },
    create: {
      username: username,
      password: password,
      role: 'ADMIN',
      permissions: 'null'
    }
  });
  console.log('User Admin configured successfully:', user);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
