const fs = require('fs');

let content = fs.readFileSync('src/app/liquidacion/page.tsx', 'utf8');

// The card looks like:
// { title: 'Territorial Tiendas / O2', description: 'Configuracin y cǭlculo de tramos territoriales por tienda y O2 MovilFree.', icon: Map, href: '/liquidacion/territorial' },
content = content.replace(/{[\s]*title: 'Territorial Tiendas \/ O2'[\s\S]*?},/, '');

// Remove from the blueCards array
content = content.replace("c.title === 'Territorial Tiendas / O2' || ", "");

fs.writeFileSync('src/app/liquidacion/page.tsx', content, 'utf8');
console.log("Removed Territorial card from liquidacion/page.tsx");
