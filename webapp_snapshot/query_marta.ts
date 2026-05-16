import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.sale.findMany({ 
    where: { vendedor: 'Marta' }, 
    select: { producto: true, anotaciones: true }, 
    distinct: ['producto'] 
}).then(res => { 
    console.log(JSON.stringify(res, null, 2)); 
    p.$disconnect(); 
});
