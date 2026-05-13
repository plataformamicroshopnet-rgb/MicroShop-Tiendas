const fs = require('fs');
let content = fs.readFileSync('src/app/api/tiendas-comisiones/route.ts', 'utf8');
if (!content.includes('force-dynamic')) {
  content = `export const dynamic = 'force-dynamic';\n` + content;
  fs.writeFileSync('src/app/api/tiendas-comisiones/route.ts', content, 'utf8');
  console.log("Added force-dynamic to API");
} else {
  console.log("force-dynamic already present");
}
