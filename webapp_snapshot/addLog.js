const fs = require('fs');
let content = fs.readFileSync('src/app/api/tiendas-comisiones/route.ts', 'utf-8');

content = content.replace(
  "const isComercial = session && normalizeRole(session.user.role) === 'COMERCIAL';",
  "const isComercial = session && normalizeRole(session.user?.role) === 'COMERCIAL';\n    console.log('Tiendas-comisiones API - user role:', session?.user?.role, 'isComercial:', isComercial);"
);

fs.writeFileSync('src/app/api/tiendas-comisiones/route.ts', content, 'utf-8');
