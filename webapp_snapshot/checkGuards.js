const fs = require('fs');
console.log('--- comisiones page ---');
console.log(fs.readFileSync('src/app/tiendas/comisiones/page.tsx', 'utf-8').split('\n').filter(l => l.includes('useGuard')).join('\n'));
console.log('--- back-office operaciones page ---');
console.log(fs.readFileSync('src/app/operaciones/page.tsx', 'utf-8').split('\n').filter(l => l.includes('useGuard')).join('\n'));
