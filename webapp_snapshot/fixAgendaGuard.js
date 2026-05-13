const fs = require('fs');
let content = fs.readFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', 'utf8');

content = content.replace(
  "const { authorized, user } = useGuard('MODULE_JEFE_TIENDAS')",
  "const { authorized, user } = useGuard('CARD_AGENDA_CRISTINA')"
);

fs.writeFileSync('src/app/seguimiento-ventas/agenda-cristina/page.tsx', content, 'utf8');
console.log("Updated Agenda Cristina guard");
