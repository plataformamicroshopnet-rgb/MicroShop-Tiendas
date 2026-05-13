const fs = require('fs');
console.log(fs.readFileSync('src/app/comisiones/page.tsx', 'utf-8').split('\n').filter(l => l.includes('useGuard')).join('\n'));
