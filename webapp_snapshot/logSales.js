const fs = require('fs');
let content = fs.readFileSync('src/app/api/sales/route.ts', 'utf8');

content = content.replace(
  "const hasBackofficePerms = canView(user, 'MODULE_BACK_OFFICE');",
  "const hasBackofficePerms = canView(user, 'MODULE_BACK_OFFICE');\n    console.log('SALES API: user.username:', user.username, 'hasBackofficePerms:', hasBackofficePerms, 'user.permissions:', user.permissions);"
);

fs.writeFileSync('src/app/api/sales/route.ts', content, 'utf8');
