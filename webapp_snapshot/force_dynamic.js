const fs = require('fs');
let code = fs.readFileSync('src/app/api/gastos/route.ts', 'utf8');
if (!code.includes('export const dynamic')) {
  code = "export const dynamic = 'force-dynamic'\n" + code;
  fs.writeFileSync('src/app/api/gastos/route.ts', code, 'utf8');
}
