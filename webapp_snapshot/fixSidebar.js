const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');
content = content.replace(
  "{ name: 'Cristina Admin', href: '/cristina-admin', icon: BookOpen, permission: 'MODULE_TIENDAS' }",
  "{ name: 'Cristina Admin', href: '/cristina-admin', icon: BookOpen, permission: 'MODULE_CRISTINA' }"
);
fs.writeFileSync('src/components/Sidebar.tsx', content, 'utf-8');
