const fs = require('fs');
let content = fs.readFileSync('src/app/back-office/page.tsx', 'utf8');

content = content.replace(
  "const hasEditAccess = canEdit(user, 'MODULE_TIENDAS')",
  "const hasEditAccess = canView(user, 'CARD_NUEVA_VENTA') || canEdit(user, 'MODULE_TIENDAS')"
);

fs.writeFileSync('src/app/back-office/page.tsx', content, 'utf8');
console.log("Updated Back Office Nueva Venta card logic");
