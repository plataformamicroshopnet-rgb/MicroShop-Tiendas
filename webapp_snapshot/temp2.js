const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.appSetting.findMany({where: {key: {startsWith: 'territorial_o2'}}}).then(res => {
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
});
