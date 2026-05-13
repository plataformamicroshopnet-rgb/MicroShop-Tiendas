const fs = require('fs');
const files = [
  'src/app/tiendas/page.tsx',
  'src/app/movilfree/page.tsx',
  'src/app/jefe-tiendas/page.tsx',
  'src/app/back-office/page.tsx',
  'src/app/liquidaciones/page.tsx',
  'src/app/cristina-admin/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/direccion-tiendas/page.tsx'
];
files.forEach(f => {
  if(fs.existsSync(f)) {
    console.log(`\n--- ${f} ---`);
    const content = fs.readFileSync(f, 'utf8');
    const matches = content.match(/title:\s*['"](.*?)['"]/g);
    if(matches) {
       console.log(matches.map(m => m.replace(/title:\s*['"]/g,'').replace(/['"]/g,'')).join(', '));
    }
  }
});
