const fs = require('fs');
let content = fs.readFileSync('src/app/cristina-admin/page.tsx', 'utf8');

content = content.replace(
  "import { Calendar, Package, Receipt } from 'lucide-react'",
  "import { Calendar, Package, Receipt, Calculator } from 'lucide-react'"
);

const newCard = `      {
        title: 'Caja',
        description: 'Gestión de entradas, salidas y trazabilidad de efectivo entre tiendas y Central.',
        icon: Calculator,
        action: () => router.push('/tiendas/caja'),
        bgIcon: 'linear-gradient(135deg, rgba(0, 173, 239, 0.15) 0%, rgba(0, 150, 200, 0.2) 100%)',
        colorIcon: 'var(--mercedes-cyan)'
      },`;

content = content.replace(
  "const cards = [",
  "const cards = [\n" + newCard
);

fs.writeFileSync('src/app/cristina-admin/page.tsx', content, 'utf8');
console.log("Added Caja to Cristina Admin hub");
