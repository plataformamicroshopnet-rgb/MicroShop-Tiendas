const fs = require('fs');
let content = fs.readFileSync('src/app/comisiones/page.tsx', 'utf8');

content = content.replace(
  "const data = useComisionesData()",
  "const data = useComisionesData(user)"
);

// Remove the filtering logic I added earlier in page.tsx
content = content.replace(/const isRestrictedComercial = user && normalizeRole\(user\.role\) === 'COMERCIAL';\s*const displayedSellerStats = isRestrictedComercial\s*\?\s*sellerStats\.filter\(s => \{[\s\S]*?\}\)\s*:\s*sellerStats;/g, "");

content = content.replace(
  "{displayedSellerStats.map(s => {",
  "{sellerStats.map(s => {"
);

fs.writeFileSync('src/app/comisiones/page.tsx', content, 'utf8');
