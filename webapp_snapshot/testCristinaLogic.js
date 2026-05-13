const fs = require('fs');
const content = fs.readFileSync('src/lib/permissions.ts', 'utf8');

// Simulate the logic in permissions.ts
const user = {
  role: 'ADMIN',
  permissions: '["HUB_LIQUIDACIONES","CARD_RENTABILIDAD_TIENDAS","PRINT","EXPORT_EXCEL","HUB_CRISTINA","CARD_AGENDA_CRISTINA","CARD_CONTROL_STOCK","CARD_INFORMES_GASTOS","CARD_CONTROL_VENCIMIENTOS","HUB_MOVILFREE","CARD_TPV_MOVILFREE","HUB_BACKOFFICE","CARD_NUEVA_VENTA","CARD_REGISTRO_OPERACIONES","CARD_OPERACIONES_PENDIENTES"]'
};

const activePerms = JSON.parse(user.permissions);

console.log("canView CARD_CAJA:", activePerms.includes('CARD_CAJA') || activePerms.includes('HUB_CRISTINA'));
console.log("canView CARD_AGENDA_CRISTINA:", activePerms.includes('CARD_AGENDA_CRISTINA'));

