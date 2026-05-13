const fs = require('fs');
let perms = fs.readFileSync('src/lib/permissions.ts', 'utf8');

perms = perms.replace(
  "return activePerms.includes(moduleName);",
  "if (moduleName === 'VIEW_NUEVA_VENTA') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('CARD_NUEVA_VENTA') || activePerms.includes('HUB_BACKOFFICE');\n  if (moduleName === 'VIEW_OPERACIONES') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('CARD_REGISTRO_OPERACIONES') || activePerms.includes('CARD_OPERACIONES_PENDIENTES') || activePerms.includes('HUB_BACKOFFICE');\n  return activePerms.includes(moduleName);"
);

perms = perms.replace(
  "return activePerms.includes(permission);",
  "if (permission === 'VIEW_NUEVA_VENTA') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('CARD_NUEVA_VENTA') || activePerms.includes('HUB_BACKOFFICE');\n  if (permission === 'VIEW_OPERACIONES') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('CARD_REGISTRO_OPERACIONES') || activePerms.includes('CARD_OPERACIONES_PENDIENTES') || activePerms.includes('HUB_BACKOFFICE');\n  return activePerms.includes(permission);"
);

fs.writeFileSync('src/lib/permissions.ts', perms, 'utf8');
console.log("Updated virtual permissions for pages");
