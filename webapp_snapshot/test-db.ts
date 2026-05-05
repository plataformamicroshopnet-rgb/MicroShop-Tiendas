import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.magazine.findMany().then(mags => {
    console.log(JSON.stringify(mags, null, 2));
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
