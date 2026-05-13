const fs = require('fs');
let content = fs.readFileSync('src/app/back-office/page.tsx', 'utf8');

content = content.replace(
  "import { canEdit } from '@/lib/permissions'",
  "import { canEdit, canView } from '@/lib/permissions'"
);

fs.writeFileSync('src/app/back-office/page.tsx', content, 'utf8');
console.log("Updated import in back-office/page.tsx");
