const fs = require('fs');
let content = fs.readFileSync('src/app/api/sales/route.ts', 'utf-8');

if (!content.includes('canView(user, \\'MODULE_BACK_OFFICE\\')')) {
  content = content.replace(
    "import { can, canEdit } from '@/lib/permissions'",
    "import { can, canEdit, canView } from '@/lib/permissions'"
  );
  
  content = content.replace(
    "const baseWhereClause: any = (user.role === ROLES.ADMIN || user.role === ROLES.JEFE_VENTAS || user.role === ROLES.BACK_OFFICE)",
    "const hasBackofficePerms = canView(user, 'MODULE_BACK_OFFICE');\n    const baseWhereClause: any = (user.role === ROLES.ADMIN || user.role === ROLES.JEFE_VENTAS || user.role === ROLES.BACK_OFFICE || hasBackofficePerms)"
  );
  
  fs.writeFileSync('src/app/api/sales/route.ts', content, 'utf-8');
}
