const fs = require('fs');
const files = [
  'src/app/movilfree/page.tsx',
  'src/app/direccion-tiendas/page.tsx',
  'src/app/seguimiento-ventas/page.tsx',
  'src/app/liquidacion/page.tsx'
];
files.forEach(f => {
  if(fs.existsSync(f)) {
    console.log(`\n--- ${f} ---`);
    const content = fs.readFileSync(f, 'utf8');
    const matches = content.match(/title={?(["'`].*?["'`])}?/g);
    if(matches) {
       console.log(matches.map(m => m.replace(/title={?['"`]/g,'').replace(/['"`]}?/g,'')).join(', '));
    } else {
       const titles = content.match(/<h[23].*?>(.*?)<\/h[23]>/g);
       if (titles) console.log(titles.join(', '));
    }
  }
});
