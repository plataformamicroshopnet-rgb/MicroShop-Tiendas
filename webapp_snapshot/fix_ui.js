const fs = require('fs');
const p = 'c:\\Proyecto Tiendas\\MicroShop Tiendas\\webapp_snapshot\\src\\app\\liquidacion\\rentabilidad-tiendas\\page.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  /<div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>[\s\S]*?<PageHeader \s*title="Rentabilidad por Tiendas" \s*subtitle="Métricas globales de ventas y comisiones por sede."\s*\/>/,
  `<div style={{ padding: 20 }}>
      <PageHeader 
        title="Rentabilidad por Tiendas" 
        subtitle="Métricas globales de ventas y comisiones por sede."
        showBack={true}
        backFallback="/liquidacion"
      />`
);

fs.writeFileSync(p, c);
console.log('done');
