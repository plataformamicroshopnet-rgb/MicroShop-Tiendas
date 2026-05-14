const fs = require('fs');

function fixFetch(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/await fetch\('\/api\/gastos\?grupo=IVA'\)/, "await fetch('/api/gastos?grupo=IVA', { cache: 'no-store' })");
  code = code.replace(/await fetch\('\/api\/gastos'\)/, "await fetch('/api/gastos', { cache: 'no-store' })");
  fs.writeFileSync(file, code, 'utf8');
}

fixFetch('src/app/cristina-admin/iva/page.tsx');
fixFetch('src/app/cristina-admin/gastos/page.tsx');
