const fs = require('fs');
let perms = fs.readFileSync('src/lib/permissions.ts', 'utf8');

perms = perms.replace(
  "return activePerms.includes(permission);",
  "if (permission === 'CARD_CAJA') return activePerms.includes('CARD_CAJA') || activePerms.includes('HUB_CRISTINA');\n  return activePerms.includes(permission);"
);

perms = perms.replace(
  "return activePerms.includes(moduleName);",
  "if (moduleName === 'CARD_CAJA') return activePerms.includes('CARD_CAJA') || activePerms.includes('HUB_CRISTINA');\n  return activePerms.includes(moduleName);"
);

fs.writeFileSync('src/lib/permissions.ts', perms, 'utf8');
console.log("Updated CARD_CAJA fallback for Cristina");
