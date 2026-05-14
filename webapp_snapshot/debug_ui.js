const fs = require('fs');
let code = fs.readFileSync('src/app/cristina-admin/iva/page.tsx', 'utf8');
code = code.replace(
  /const historicoAños = useMemo\(\(\) => \{/,
  "const historicoAños = useMemo(() => {\n    console.log('DEBUG: historico length:', historico.length, 'selected:', selectedConceptos);\n"
);
fs.writeFileSync('src/app/cristina-admin/iva/page.tsx', code, 'utf8');
