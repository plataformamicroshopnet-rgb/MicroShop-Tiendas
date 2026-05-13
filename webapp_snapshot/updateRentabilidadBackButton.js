const fs = require('fs');

let content = fs.readFileSync('src/app/liquidacion/rentabilidad-tiendas/page.tsx', 'utf8');

const backButtonHTML = `      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'var(--medium-gray)', cursor: 'pointer', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
        <ArrowLeft size={16} /> Volver
      </button>
      <PageHeader`;

content = content.replace("<PageHeader", backButtonHTML);

fs.writeFileSync('src/app/liquidacion/rentabilidad-tiendas/page.tsx', content, 'utf8');

console.log("Added back button to rentabilidad-tiendas");
