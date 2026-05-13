const fs = require('fs');
let content = fs.readFileSync('src/app/api/sales/route.ts', 'utf8');

content = content.replace(
  "if (user.role === ROLES.COMERCIAL || user.role.includes('COMERCIAL')) {",
  "if ((user.role === ROLES.COMERCIAL || user.role.includes('COMERCIAL')) && !hasBackofficePerms) {"
);

fs.writeFileSync('src/app/api/sales/route.ts', content, 'utf8');
console.log("Fixed hardcoded Javascript filter in sales API");
