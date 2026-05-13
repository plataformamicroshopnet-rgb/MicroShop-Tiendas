const fs = require('fs');
let content = fs.readFileSync('src/app/api/tiendas-comisiones/route.ts', 'utf-8');

if (!content.includes('import { getSession }')) {
  content = content.replace("import { PrismaClient } from '@prisma/client'", "import { PrismaClient } from '@prisma/client'\nimport { getSession } from '@/lib/auth'\nimport { ROLES, normalizeRole } from '@/lib/appConfig'");
  
  content = content.replace(
    "const hours = await prisma.tiendaComercialHour.findMany({",
    `const session = await getSession();
    const isComercial = session && normalizeRole(session.user.role) === 'COMERCIAL';
    
    const hours = await prisma.tiendaComercialHour.findMany({`
  );
  
  content = content.replace(
    "return NextResponse.json({ success: true, rules, hours })",
    `const filteredHours = isComercial ? hours.filter(h => h.comercial.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim() === session.user.username.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim()) : hours;
    return NextResponse.json({ success: true, rules, hours: filteredHours })`
  );
  
  fs.writeFileSync('src/app/api/tiendas-comisiones/route.ts', content, 'utf-8');
}
