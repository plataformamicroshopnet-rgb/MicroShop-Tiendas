const fs = require('fs');

let nvContent = fs.readFileSync('src/app/nueva-venta/page.tsx', 'utf8');
nvContent = nvContent.replace(
  "const { authorized } = useGuard('MODULE_TIENDAS', 'CREATE_SALES')",
  "const { authorized } = useGuard('VIEW_NUEVA_VENTA', 'CREATE_SALES')"
);
fs.writeFileSync('src/app/nueva-venta/page.tsx', nvContent, 'utf8');

let opContent = fs.readFileSync('src/app/operaciones/page.tsx', 'utf8');
opContent = opContent.replace(
  "const { authorized } = useGuard('MODULE_TIENDAS')",
  "const { authorized } = useGuard('VIEW_OPERACIONES')"
);
fs.writeFileSync('src/app/operaciones/page.tsx', opContent, 'utf8');

console.log("Updated guards in pages");
