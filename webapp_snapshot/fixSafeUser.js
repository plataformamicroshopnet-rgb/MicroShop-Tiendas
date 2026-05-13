const fs = require('fs');
let content = fs.readFileSync('src/app/api/sales/route.ts', 'utf8');

content = content.replace(
  "if (dbUser) {",
  "const safeUser = { ...session.user, role: dbUser?.role || session.user.role, permissions: dbUser?.permissions || session.user.permissions };\n      if (dbUser) {"
);

fs.writeFileSync('src/app/api/sales/route.ts', content, 'utf8');
