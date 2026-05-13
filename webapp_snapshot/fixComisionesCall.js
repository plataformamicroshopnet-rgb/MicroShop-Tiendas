const fs = require('fs');
let content = fs.readFileSync('src/app/comisiones/page.tsx', 'utf8');

content = content.replace(
  "} = useComisionesData()",
  "} = useComisionesData(user)"
);

fs.writeFileSync('src/app/comisiones/page.tsx', content, 'utf8');
