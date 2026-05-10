const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.magazine.findMany().then(mags => { console.log(mags.map(m => m.coverUrl)); prisma.$disconnect() });
