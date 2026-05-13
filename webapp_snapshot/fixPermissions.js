const fs = require('fs');
let content = fs.readFileSync('src/lib/permissions.ts', 'utf-8');

// Replace can implementation to include translation layer
content = content.replace(/export function can\(user: any, permission: string\): boolean \{[\s\S]*?return activePerms\.includes\(permission\);\n\}/, `export function can(user: any, permission: string): boolean {
  if (!user || !user.role) return false;
  if (user.role === 'ADMIN') return true;
  
  const activePerms = (user.permissions !== null && Array.isArray(user.permissions)) 
    ? user.permissions 
    : getDefaultPermissions(user.role);
    
  // Traductores de acciones heredadas
  if (permission === 'CREATE_SALES') return activePerms.includes('CARD_NUEVA_VENTA');
  if (permission === 'EDIT_SALES' || permission === 'CANCEL_SALES') return activePerms.includes('CARD_REGISTRO_OPERACIONES');
  
  return activePerms.includes(permission);
}`);

// Replace canView implementation to add missing modules
content = content.replace(/if \(moduleName === 'MODULE_ADMIN'\) return activePerms\.includes\('HUB_ADMINISTRADOR'\);/, `if (moduleName === 'MODULE_ADMIN') return activePerms.includes('HUB_ADMINISTRADOR');
  if (moduleName === 'MODULE_COMISIONES') return activePerms.includes('CARD_COMISIONES_TIENDAS');
  if (moduleName === 'MODULE_CUMPLIMIENTO') return activePerms.includes('HUB_TIENDAS'); // O lo que sea más lógico
  if (moduleName === 'MODULE_DIRECCION') return activePerms.includes('HUB_SEGUIMIENTO');
  if (moduleName === 'CREATE_SALES') return activePerms.includes('CARD_NUEVA_VENTA');
  if (moduleName === 'EDIT_SALES') return activePerms.includes('CARD_REGISTRO_OPERACIONES');`);

fs.writeFileSync('src/lib/permissions.ts', content, 'utf-8');
