const fs = require('fs');

let content = fs.readFileSync('src/app/api/admin/ftp-backup/route.ts', 'utf8');
content = content.replace('cleanupOldBackups(30)', 'cleanupOldBackups(14)');
content = content.replace('Rutina Mantenimiento a 30 días', 'Rutina Mantenimiento a 14 días');
fs.writeFileSync('src/app/api/admin/ftp-backup/route.ts', content, 'utf8');

console.log('Fixed retention');
