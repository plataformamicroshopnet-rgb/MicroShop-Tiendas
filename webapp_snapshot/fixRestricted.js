const fs = require('fs');
let content = fs.readFileSync('src/app/comisiones/page.tsx', 'utf8');

content = content.replace(
  "const isRestrictedComercial = user && normalizeRole(user.role) === 'COMERCIAL' && !canView(user, 'MODULE_BACK_OFFICE');",
  "const isRestrictedComercial = user && normalizeRole(user.role) === 'COMERCIAL';"
);

fs.writeFileSync('src/app/comisiones/page.tsx', content, 'utf8');
