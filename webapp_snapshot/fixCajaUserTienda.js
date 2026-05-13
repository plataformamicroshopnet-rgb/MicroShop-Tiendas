const fs = require('fs');
let content = fs.readFileSync('src/app/tiendas/caja/page.tsx', 'utf8');

if (!content.includes('import { canView }')) {
  content = content.replace(
    "import { useGuard } from '@/hooks/useGuard'",
    "import { useGuard } from '@/hooks/useGuard'\nimport { canView } from '@/lib/permissions'"
  );
}

const oldLogic = `  const userTienda = useMemo(() => {
    if (!user) return null
    if (user.role === 'ADMIN') return 'ADMIN'
    
    for (const [store, members] of Object.entries(TIENDAS_COMERCIALES)) {
      if (members.includes(user.username)) {
        return store === 'Auxiliadora 45' ? 'Auxiliadora' : store
      }
    }
    return null
  }, [user])`;

const newLogic = `  const userTienda = useMemo(() => {
    if (!user) return null
    if (user.role === 'ADMIN' || canView(user, 'HUB_CRISTINA')) return 'ADMIN'
    
    for (const [store, members] of Object.entries(TIENDAS_COMERCIALES)) {
      if (members.includes(user.username)) {
        return store === 'Auxiliadora 45' ? 'Auxiliadora' : store
      }
    }
    
    if (canView(user, 'CARD_CAJA') || canView(user, 'HUB_BACKOFFICE')) return 'ADMIN'
    return null
  }, [user])`;

content = content.replace(oldLogic, newLogic);

fs.writeFileSync('src/app/tiendas/caja/page.tsx', content, 'utf8');
console.log("Updated userTienda logic for Caja");
