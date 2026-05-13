const fs = require('fs');
let content = fs.readFileSync('src/lib/permissions.ts', 'utf-8');

content = content.replace(
  /if \(moduleName === 'MODULE_TIENDAS'\) return activePerms\.includes\('HUB_TIENDAS'\);/,
  "if (moduleName === 'MODULE_TIENDAS') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('HUB_BACKOFFICE');"
);

fs.writeFileSync('src/lib/permissions.ts', content, 'utf-8');
