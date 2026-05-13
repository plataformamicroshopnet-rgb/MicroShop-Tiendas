const fs = require('fs');
let content = fs.readFileSync('src/app/tiendas/caja/page.tsx', 'utf8');

content = content.replace(
  "onClick={() => router.push('/tiendas')}",
  "onClick={() => router.back()}"
);

fs.writeFileSync('src/app/tiendas/caja/page.tsx', content, 'utf8');
console.log("Updated Caja back button");
