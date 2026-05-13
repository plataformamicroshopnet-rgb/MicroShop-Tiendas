const fs = require('fs');
const content = `
import { ROLES } from './appConfig'

export function getDefaultPermissions(role: string): string[] {
  switch (role) {
    case 'ADMIN':
      return [
        'HUB_TIENDAS', 'CARD_VENTAS_TIENDAS', 'CARD_COMISIONES_TIENDAS', 'CARD_CAJA', 'CARD_OFERTAS', 'CARD_CONDICIONES_TIENDAS', 'CARD_EXTRAS_TIENDAS',
        'HUB_MOVILFREE', 'CARD_TPV_MOVILFREE',
        'HUB_SEGUIMIENTO', 'CARD_AGENDA_DIARIO', 'CARD_COMBOS', 'CARD_COMISIONES_EQUIPO',
        'HUB_BACKOFFICE', 'CARD_NUEVA_VENTA', 'CARD_REGISTRO_OPERACIONES', 'CARD_OPERACIONES_PENDIENTES',
        'HUB_LIQUIDACIONES', 'CARD_LIQUIDACION_TELEFONICA', 'CARD_RENTABILIDAD_TIENDAS', 'CARD_IMPORTES_PLUS', 'CARD_IMPORTES_PYME',
        'HUB_CRISTINA', 'CARD_AGENDA_CRISTINA', 'CARD_CONTROL_STOCK', 'CARD_INFORMES_GASTOS', 'CARD_CONTROL_VENCIMIENTOS',
        'HUB_ADMINISTRADOR', 'CARD_PERIODOS_OPERATIVOS', 'CARD_GESTION_USUARIOS', 'CARD_CATALOGOS', 'CARD_BACKUPS', 'CARD_TRAZABILIDAD',
        'PRINT', 'EXPORT_EXCEL', 'CLOSE_MONTH'
      ]
    case 'JEFE DE VENTAS':
      return [
        'HUB_TIENDAS', 'CARD_VENTAS_TIENDAS', 'CARD_COMISIONES_TIENDAS', 'CARD_CAJA',
        'HUB_SEGUIMIENTO', 'CARD_AGENDA_DIARIO', 'CARD_COMBOS', 'CARD_COMISIONES_EQUIPO',
        'HUB_LIQUIDACIONES', 'CARD_RENTABILIDAD_TIENDAS',
        'PRINT', 'EXPORT_EXCEL'
      ]
    case 'BACK OFFICE':
      return [
        'HUB_BACKOFFICE', 'CARD_NUEVA_VENTA', 'CARD_REGISTRO_OPERACIONES', 'CARD_OPERACIONES_PENDIENTES',
        'HUB_TIENDAS', 'CARD_VENTAS_TIENDAS',
        'PRINT', 'EXPORT_EXCEL'
      ]
    case 'COMERCIAL':
    default:
      return [
        'HUB_TIENDAS', 'CARD_VENTAS_TIENDAS', 'CARD_COMISIONES_TIENDAS',
        'PRINT'
      ]
  }
}

export function can(user: any, permission: string): boolean {
  if (!user || !user.role) return false;
  if (user.role === 'ADMIN') return true;
  
  const activePerms = (user.permissions !== null && Array.isArray(user.permissions)) 
    ? user.permissions 
    : getDefaultPermissions(user.role);
    
  return activePerms.includes(permission);
}

// Para retrocompatibilidad temporal, redirigimos las llamadas a canView y canEdit a 'can'
// (Hasta que adaptes todos los botones del HUB)
export function canView(user: any, moduleName: string): boolean {
  if (!user || !user.role) return false;
  if (user.role === 'ADMIN') return true;
  
  const activePerms = (user.permissions !== null && Array.isArray(user.permissions)) 
    ? user.permissions 
    : getDefaultPermissions(user.role);

  // Mapeos temporales de retrocompatibilidad
  if (moduleName === 'MODULE_TIENDAS') return activePerms.includes('HUB_TIENDAS');
  if (moduleName === 'MODULE_MOVILFREE') return activePerms.includes('HUB_MOVILFREE');
  if (moduleName === 'MODULE_JEFE_TIENDAS') return activePerms.includes('HUB_SEGUIMIENTO');
  if (moduleName === 'MODULE_BACK_OFFICE') return activePerms.includes('HUB_BACKOFFICE');
  if (moduleName === 'MODULE_LIQUIDACION') return activePerms.includes('HUB_LIQUIDACIONES');
  if (moduleName === 'MODULE_CRISTINA') return activePerms.includes('HUB_CRISTINA');
  if (moduleName === 'MODULE_ADMIN') return activePerms.includes('HUB_ADMINISTRADOR');

  return activePerms.includes(moduleName);
}

export function canEdit(user: any, moduleName: string): boolean {
  return canView(user, moduleName); // Por defecto mismo permiso de lectura temporalmente
}
`;
fs.writeFileSync('src/lib/permissions.ts', content, 'utf-8');
