const fs = require('fs');
let content = fs.readFileSync('src/app/operaciones/page.tsx', 'utf8');
content = content.replace(
  "import { can, canEdit as canEditMacro } from '@/lib/permissions'",
  "import { can, canEdit as canEditMacro, canView } from '@/lib/permissions'"
);
content = content.replace(
  "const isComercial = user && normalizeRole(user.role) === 'COMERCIAL';",
  "const isComercial = user && normalizeRole(user.role) === 'COMERCIAL' && !canView(user, 'MODULE_BACK_OFFICE');"
);
fs.writeFileSync('src/app/operaciones/page.tsx', content, 'utf8');
