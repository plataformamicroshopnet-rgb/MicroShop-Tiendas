const fs = require('fs');
let perms = fs.readFileSync('src/lib/permissions.ts', 'utf8');

perms = perms.replace(
  "if (permission === 'MODULE_TIENDAS') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('HUB_BACKOFFICE');",
  "if (permission === 'MODULE_TIENDAS') return activePerms.includes('HUB_TIENDAS');"
);

perms = perms.replace(
  "if (moduleName === 'MODULE_TIENDAS') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('HUB_BACKOFFICE');",
  "if (moduleName === 'MODULE_TIENDAS') return activePerms.includes('HUB_TIENDAS');"
);

fs.writeFileSync('src/lib/permissions.ts', perms, 'utf8');
console.log("Updated MODULE_TIENDAS permission");
