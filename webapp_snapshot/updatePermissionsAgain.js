const fs = require('fs');
let content = fs.readFileSync('src/lib/permissions.ts', 'utf-8');

// Add MANAGE_CATALOG and other missing ones to the 'can' translator
content = content.replace(/if \(permission === 'EDIT_SALES' \|\| permission === 'CANCEL_SALES'\) return activePerms\.includes\('CARD_REGISTRO_OPERACIONES'\);/, `if (permission === 'EDIT_SALES' || permission === 'CANCEL_SALES') return activePerms.includes('CARD_REGISTRO_OPERACIONES');
  if (permission === 'MANAGE_CATALOG') return activePerms.includes('CARD_CATALOGOS');
  if (permission === 'CLOSE_MONTH') return activePerms.includes('CLOSE_MONTH'); // Mantenemos el nombre original si hace falta
`);

fs.writeFileSync('src/lib/permissions.ts', content, 'utf-8');
