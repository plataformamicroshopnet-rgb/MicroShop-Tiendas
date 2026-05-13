const fs = require('fs');
let content = fs.readFileSync('src/app/api/auth/me/route.ts', 'utf8');
if (!content.includes('force-dynamic')) {
  content = `export const dynamic = 'force-dynamic';\n` + content;
  fs.writeFileSync('src/app/api/auth/me/route.ts', content, 'utf8');
}
