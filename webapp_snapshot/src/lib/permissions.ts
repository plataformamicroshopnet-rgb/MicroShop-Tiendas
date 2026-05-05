import { ROLES } from './appConfig'

export function getDefaultPermissions(role: string): string[] {
  switch (role) {
    case 'ADMIN':
      return [
        'MODULE_FFVV', 'MODULE_JEFE_FFVV', 'MODULE_BACK_OFFICE', 'MODULE_CUMPLIMIENTO',
        'MODULE_COMISIONES', 'MODULE_LIQUIDACION', 'MODULE_DIRECCION', 'MODULE_ADMIN',
        'CREATE_SALES', 'EDIT_SALES', 'CANCEL_SALES', 'PRINT', 'EXPORT_EXCEL', 'SEND_EMAIL', 'MANAGE_CATALOG', 'CLOSE_MONTH', 'MANAGE_MAGAZINES'
      ]
    case 'JEFE DE VENTAS':
      return [
        'MODULE_FFVV', 'MODULE_JEFE_FFVV', 'MODULE_CUMPLIMIENTO', 'MODULE_COMISIONES',
        'MODULE_LIQUIDACION', 'MODULE_DIRECCION',
        'PRINT', 'EXPORT_EXCEL', 'SEND_EMAIL'
      ]
    case 'BACK OFFICE':
      return [
        'MODULE_FFVV', 'MODULE_BACK_OFFICE', 'MODULE_CUMPLIMIENTO',
        'CREATE_SALES', 'EDIT_SALES', 'CANCEL_SALES', 'PRINT', 'EXPORT_EXCEL', 'SEND_EMAIL'
      ]
    case 'COMERCIAL':
    default:
      return [
        'MODULE_FFVV', 'MODULE_CUMPLIMIENTO',
        'PRINT'
      ]
  }
}

/**
 * Lógica híbrida:
 * - Si permissions es explícito (incluso []), manda eso.
 * - Si permissions es null (no migrado), hereda la plantilla por defecto.
 */
export function can(user: any, permission: string): boolean {
  if (!user || !user.role) return false;
  
  if (user.role === 'ADMIN') return true; // Admin maestro siempre puede
  
  const activePerms = (user.permissions !== null && Array.isArray(user.permissions)) 
    ? user.permissions 
    : getDefaultPermissions(user.role);
    
  return activePerms.includes(permission);
}

/**
 * Nueva Lógica Granular: LECTURA
 * Permite navegar a un módulo si tiene el token :view, :edit, o el permiso clásico heredado
 */
export function canView(user: any, moduleName: string): boolean {
  if (!user || !user.role) return false;
  if (user.role === 'ADMIN') return true;
  
  const activePerms = (user.permissions !== null && Array.isArray(user.permissions)) 
    ? user.permissions 
    : getDefaultPermissions(user.role);

  if (activePerms.includes(`${moduleName}:view`)) return true;
  if (activePerms.includes(`${moduleName}:edit`)) return true;
  
  // Legacy fallback: si tiene en bruto MODULE_FFVV, puede verlo
  return activePerms.includes(moduleName);
}

/**
 * Nueva Lógica Granular: ESCRITURA
 * Oculta/Muestra botones de Nueva Venta, Editar, Borrar.
 */
export function canEdit(user: any, moduleName: string): boolean {
  if (!user || !user.role) return false;
  if (user.role === 'ADMIN') return true;

  const activePerms = (user.permissions !== null && Array.isArray(user.permissions)) 
    ? user.permissions 
    : getDefaultPermissions(user.role);

  // Tiene token directo de edición
  if (activePerms.includes(`${moduleName}:edit`)) return true;

  // Traductores Legacy para mantener vivos a los usuarios no migrados
  if (moduleName === 'MODULE_FFVV') return activePerms.includes('EDIT_SALES') || activePerms.includes('CREATE_SALES');
  if (moduleName === 'MANAGE_MAGAZINES') return activePerms.includes('MANAGE_MAGAZINES');
  if (moduleName === 'MODULE_ADMIN') return activePerms.includes('MODULE_ADMIN');
  if (moduleName === 'MANAGE_CATALOG') return activePerms.includes('MANAGE_CATALOG');
  if (moduleName === 'MODULE_JEFE_FFVV') return activePerms.includes('MODULE_JEFE_FFVV');

  return false;
}
