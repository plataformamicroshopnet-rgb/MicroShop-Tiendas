const fs = require('fs');

let content = fs.readFileSync('src/app/liquidacion/page.tsx', 'utf8');
content = content.replace(/[ \t]*\{currentView === 'objetivos' && renderObjetivosTab\(\)\}\r?\n/g, '');
fs.writeFileSync('src/app/liquidacion/page.tsx', content, 'utf8');

let catContent = fs.readFileSync('src/app/catalogos/page.tsx', 'utf8');
// Fix the accidental append of " && activeTab !== 'Territorial Tiendas / O2'"
catContent = catContent.replace(/ mapped\[cat\] = \[\] && activeTab !== 'Territorial Tiendas \/ O2';/g, ' mapped[cat] = [];');
fs.writeFileSync('src/app/catalogos/page.tsx', catContent, 'utf8');
console.log("Fixed files");
