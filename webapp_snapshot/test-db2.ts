import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
const prisma = new PrismaClient();
prisma.magazine.findMany().then(mags => {
    fs.writeFileSync('output.json', JSON.stringify(mags, null, 2));
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
