const fs = require('fs');
let hook = fs.readFileSync('src/hooks/useComisionesData.ts', 'utf8');

hook = hook.replace(/sellerStats,\s+teamTotalComisiones,/, 'sellerStats: displayedSellerStats,\n          teamTotalComisiones,');

fs.writeFileSync('src/hooks/useComisionesData.ts', hook, 'utf8');
console.log("Regex replaced.");
