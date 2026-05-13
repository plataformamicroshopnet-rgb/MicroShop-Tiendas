const fs = require('fs');
let perms = fs.readFileSync('src/lib/permissions.ts', 'utf8');

perms = perms.replace(
  "if (moduleName === 'VIEW_OPERACIONES')",
  "if (moduleName === 'VIEW_OPERACIONES_GRUPO') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('HUB_LIQUIDACIONES') || activePerms.includes('CARD_LIQUIDACION_TELEFONICA') || activePerms.includes('HUB_BACKOFFICE');\n  if (moduleName === 'VIEW_OPERACIONES')"
);

perms = perms.replace(
  "if (permission === 'VIEW_OPERACIONES')",
  "if (permission === 'VIEW_OPERACIONES_GRUPO') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('HUB_LIQUIDACIONES') || activePerms.includes('CARD_LIQUIDACION_TELEFONICA') || activePerms.includes('HUB_BACKOFFICE');\n  if (permission === 'VIEW_OPERACIONES')"
);

fs.writeFileSync('src/lib/permissions.ts', perms, 'utf8');
console.log("Added VIEW_OPERACIONES_GRUPO virtual permission");
