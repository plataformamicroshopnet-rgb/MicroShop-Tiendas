const fs = require('fs');
let content = fs.readFileSync('src/app/comisiones/page.tsx', 'utf8');

if (!content.includes('import { canView }')) {
  content = content.replace(
    "import { can } from '@/lib/permissions'",
    "import { can, canView } from '@/lib/permissions'"
  );
}

const replacement = `
    const isRestrictedComercial = user && normalizeRole(user.role) === 'COMERCIAL' && !canView(user, 'MODULE_BACK_OFFICE');
    
    const displayedSellerStats = isRestrictedComercial 
      ? sellerStats.filter(s => {
          const sName = s.name.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
          const uName = user.username ? user.username.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim() : '';
          return sName === uName;
        })
      : sellerStats;
`;

if (!content.includes('displayedSellerStats')) {
  content = content.replace(
    "const { authorized, user } = useGuard('MODULE_COMISIONES')",
    "const { authorized, user } = useGuard('MODULE_COMISIONES')" + replacement
  );
  
  content = content.replace(
    "{sellerStats.map(s => {",
    "{displayedSellerStats.map(s => {"
  );
  
  fs.writeFileSync('src/app/comisiones/page.tsx', content, 'utf8');
}
