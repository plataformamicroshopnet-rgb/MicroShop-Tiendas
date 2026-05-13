const fs = require('fs');
let content = fs.readFileSync('src/app/tiendas/caja/page.tsx', 'utf8');

content = content.replace(
  "const { authorized, user } = useGuard('MODULE_TIENDAS')",
  "const { authorized, user } = useGuard('CARD_CAJA')"
);

fs.writeFileSync('src/app/tiendas/caja/page.tsx', content, 'utf8');
console.log("Updated Caja guard");
