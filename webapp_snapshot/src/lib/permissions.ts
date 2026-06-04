import { ROLES } from './appConfig'

export function getDefaultPermissions(role: string): string[] {
  switch (role) {
    case 'ADMIN':
      return [
        'HUB_TIENDAS', 'CARD_VENTAS_TIENDAS', 'CARD_COMISIONES_TIENDAS', 'CARD_CAJA', 'CARD_OFERTAS', 'CARD_CONDICIONES_TIENDAS', 'CARD_EXTRAS_TIENDAS',
        'HUB_MOVILFREE', 'CARD_TPV_MOVILFREE',
        'HUB_SEGUIMIENTO', 'CARD_AVANCE_PALANCAS', 'CARD_AGENDA_DIARIO', 'CARD_COMISIONES_COMPLETAS', 'CARD_COMISIONES_EQUIPO', 'CARD_CONDICIONES_EXTRAS', 'CARD_COMBOS', 'CARD_COMISIONES_JEFE',
        'HUB_BACKOFFICE', 'CARD_NUEVA_VENTA', 'CARD_REGISTRO_OPERACIONES', 'CARD_OPERACIONES_PENDIENTES',
        'HUB_LIQUIDACIONES', 'CARD_LIQUIDACION_TELEFONICA', 'CARD_RENTABILIDAD_TIENDAS', 'CARD_IMPORTES_PLUS', 'CARD_IMPORTES_PYME',
        'HUB_CRISTINA', 'CARD_AGENDA_CRISTINA', 'CARD_CONTROL_STOCK', 'CARD_INFORMES_GASTOS', 'CARD_CONTROL_VENCIMIENTOS',
        'HUB_ADMINISTRADOR', 'CARD_PERIODOS_OPERATIVOS', 'CARD_GESTION_USUARIOS', 'CARD_CATALOGOS', 'CARD_BACKUPS', 'CARD_TRAZABILIDAD',
        'MODULE_DIRECCION', 'CARD_DIR_MOD', 'CARD_DIR_COMBOS', 'CARD_DIR_PRODUCTOS', 'CARD_DIR_TRAMITACION', 'CARD_DIR_RENTABILIDAD',
        'PRINT', 'EXPORT_EXCEL', 'CLOSE_MONTH'
      ]
    case 'JEFE DE VENTAS':
      return [
        'HUB_TIENDAS', 'CARD_VENTAS_TIENDAS', 'CARD_COMISIONES_TIENDAS', 'CARD_CAJA',
        'HUB_SEGUIMIENTO', 'CARD_AVANCE_PALANCAS', 'CARD_AGENDA_DIARIO', 'CARD_COMISIONES_COMPLETAS', 'CARD_COMISIONES_EQUIPO', 'CARD_CONDICIONES_EXTRAS', 'CARD_COMBOS', 'CARD_COMISIONES_JEFE',
        'HUB_LIQUIDACIONES', 'CARD_RENTABILIDAD_TIENDAS',
        'MODULE_DIRECCION', 'CARD_DIR_COMBOS', 'CARD_DIR_PRODUCTOS', 'CARD_DIR_TRAMITACION', 'CARD_DIR_RENTABILIDAD',
        'PRINT', 'EXPORT_EXCEL'
      ]
    case 'BACK OFFICE':
      return [
        'HUB_BACKOFFICE', 'CARD_NUEVA_VENTA', 'CARD_REGISTRO_OPERACIONES', 'CARD_OPERACIONES_PENDIENTES',
        'HUB_TIENDAS', 'CARD_VENTAS_TIENDAS',
        'PRINT', 'EXPORT_EXCEL'
      ]
    case 'GESTORA':
      return [
        'HUB_LIQUIDACIONES', 'CARD_RENTABILIDAD_TIENDAS',
        'HUB_CRISTINA', 'CARD_AGENDA_CRISTINA', 'CARD_CONTROL_STOCK', 'CARD_INFORMES_GASTOS', 'CARD_CONTROL_VENCIMIENTOS',
        'HUB_MOVILFREE', 'CARD_TPV_MOVILFREE',
        'HUB_BACKOFFICE', 'CARD_NUEVA_VENTA', 'CARD_REGISTRO_OPERACIONES', 'CARD_OPERACIONES_PENDIENTES',
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
  
  let parsedPerms = user.permissions;
  if (typeof user.permissions === 'string') {
    try { parsedPerms = JSON.parse(user.permissions); } catch(e) {}
  }
  const activePerms = (parsedPerms !== null && Array.isArray(parsedPerms)) 
    ? parsedPerms 
    : getDefaultPermissions(user.role);
    
  // Traductores de acciones heredadas
  if (permission === 'VIEW_DASHBOARD') return true;
  if (permission === 'SEND_EMAIL') return activePerms.includes('PRINT') || activePerms.includes('EXPORT_EXCEL');
  if (permission === 'CREATE_SALES') return activePerms.includes('CARD_NUEVA_VENTA');
  if (permission === 'EDIT_SALES' || permission === 'CANCEL_SALES') return activePerms.includes('CARD_REGISTRO_OPERACIONES');
  if (permission === 'MANAGE_CATALOG') return activePerms.includes('CARD_CATALOGOS');
  if (permission === 'CLOSE_MONTH') return activePerms.includes('CLOSE_MONTH'); // Mantenemos el nombre original si hace falta

  // Mapeos temporales de retrocompatibilidad unificados en can()
  if (permission === 'MODULE_TIENDAS') return activePerms.includes('HUB_TIENDAS');
  if (permission === 'MODULE_MOVILFREE') return activePerms.includes('HUB_MOVILFREE');
  if (permission === 'MODULE_JEFE_TIENDAS') return activePerms.includes('HUB_SEGUIMIENTO');
  if (permission === 'MODULE_BACK_OFFICE') return activePerms.includes('HUB_BACKOFFICE');
  if (permission === 'MODULE_LIQUIDACION') return activePerms.includes('HUB_LIQUIDACIONES');
  if (permission === 'MODULE_CRISTINA') return activePerms.includes('HUB_CRISTINA');
  if (permission === 'MODULE_ADMIN') return activePerms.includes('HUB_ADMINISTRADOR');
  if (permission === 'MODULE_DIRECCION') return activePerms.includes('MODULE_DIRECCION');

  if (permission === 'CARD_CAJA') return activePerms.includes('CARD_CAJA') || activePerms.includes('HUB_CRISTINA');
  if (permission === 'VIEW_NUEVA_VENTA') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('CARD_NUEVA_VENTA') || activePerms.includes('HUB_BACKOFFICE');
  if (permission === 'VIEW_OPERACIONES_GRUPO') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('HUB_LIQUIDACIONES') || activePerms.includes('CARD_LIQUIDACION_TELEFONICA') || activePerms.includes('HUB_BACKOFFICE');
  if (permission === 'VIEW_OPERACIONES') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('CARD_REGISTRO_OPERACIONES') || activePerms.includes('CARD_OPERACIONES_PENDIENTES') || activePerms.includes('HUB_BACKOFFICE');
  return activePerms.includes(permission);
}

// Para retrocompatibilidad temporal, redirigimos las llamadas a canView y canEdit a 'can'
// (Hasta que adaptes todos los botones del HUB)
export function canView(user: any, moduleName: string): boolean {
  if (!user || !user.role) return false;
  if (user.role === 'ADMIN') return true;
  
  let parsedPerms = user.permissions;
  if (typeof user.permissions === 'string') {
    try { parsedPerms = JSON.parse(user.permissions); } catch(e) {}
  }
  const activePerms = (parsedPerms !== null && Array.isArray(parsedPerms)) 
    ? parsedPerms 
    : getDefaultPermissions(user.role);

  // Mapeos temporales de retrocompatibilidad
  if (moduleName === 'VIEW_DASHBOARD') return true;
  if (moduleName === 'MODULE_TIENDAS') return activePerms.includes('HUB_TIENDAS');
  if (moduleName === 'MODULE_MOVILFREE') return activePerms.includes('HUB_MOVILFREE');
  if (moduleName === 'MODULE_JEFE_TIENDAS') return activePerms.includes('HUB_SEGUIMIENTO') || activePerms.includes('MODULE_DIRECCION');
  if (moduleName === 'MODULE_BACK_OFFICE') return activePerms.includes('HUB_BACKOFFICE');
  if (moduleName === 'MODULE_LIQUIDACION') return activePerms.includes('HUB_LIQUIDACIONES');
  if (moduleName === 'MODULE_CRISTINA') return activePerms.includes('HUB_CRISTINA');
  if (moduleName === 'MODULE_ADMIN') return activePerms.includes('HUB_ADMINISTRADOR');
  if (moduleName === 'MODULE_COMISIONES') return activePerms.includes('CARD_COMISIONES_TIENDAS');
  if (moduleName === 'MODULE_CUMPLIMIENTO') return activePerms.includes('HUB_TIENDAS'); // O lo que sea más lógico
  if (moduleName === 'MODULE_DIRECCION') return activePerms.includes('MODULE_DIRECCION');
  if (moduleName === 'CREATE_SALES') return activePerms.includes('CARD_NUEVA_VENTA');
  if (moduleName === 'EDIT_SALES') return activePerms.includes('CARD_REGISTRO_OPERACIONES');

  if (moduleName === 'CARD_CAJA') return activePerms.includes('CARD_CAJA') || activePerms.includes('HUB_CRISTINA');
  if (moduleName === 'VIEW_NUEVA_VENTA') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('CARD_NUEVA_VENTA') || activePerms.includes('HUB_BACKOFFICE');
  if (moduleName === 'VIEW_OPERACIONES_GRUPO') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('HUB_LIQUIDACIONES') || activePerms.includes('CARD_LIQUIDACION_TELEFONICA') || activePerms.includes('HUB_BACKOFFICE');
  if (moduleName === 'VIEW_OPERACIONES') return activePerms.includes('HUB_TIENDAS') || activePerms.includes('CARD_REGISTRO_OPERACIONES') || activePerms.includes('CARD_OPERACIONES_PENDIENTES') || activePerms.includes('HUB_BACKOFFICE');
  return activePerms.includes(moduleName);
}

export function canEdit(user: any, moduleName: string): boolean {
  return canView(user, moduleName); // Por defecto mismo permiso de lectura temporalmente
}
