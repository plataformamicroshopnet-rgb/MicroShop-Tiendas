const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.appSetting.findMany({where: {key: {startsWith: 'o2_rules_v2'}}}).then(res => {
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
});
