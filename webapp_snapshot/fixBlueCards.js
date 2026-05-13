const fs = require('fs');

let content = fs.readFileSync('src/app/liquidacion/page.tsx', 'utf8');

// Replace remaining instances
content = content.replace(/ \|\| c\.title === 'Territorial Tiendas \/ O2'/g, '');

fs.writeFileSync('src/app/liquidacion/page.tsx', content, 'utf8');
console.log("Fixed blueCards array in liquidacion/page.tsx");
