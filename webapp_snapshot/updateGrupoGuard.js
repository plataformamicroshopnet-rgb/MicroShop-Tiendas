const fs = require('fs');

let content = fs.readFileSync('src/app/operaciones-grupo-cliente/page.tsx', 'utf8');
content = content.replace(
  "const { authorized } = useGuard('MODULE_TIENDAS')",
  "const { authorized } = useGuard('VIEW_OPERACIONES_GRUPO')"
);
fs.writeFileSync('src/app/operaciones-grupo-cliente/page.tsx', content, 'utf8');

console.log("Updated guard in operaciones-grupo-cliente");
