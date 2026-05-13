const fs = require('fs');
let content = fs.readFileSync('src/hooks/useComisionesData.ts', 'utf8');

// Update signature
if (!content.includes('export function useComisionesData(user?: any)')) {
  content = content.replace(
    "export function useComisionesData() {",
    "export function useComisionesData(user?: any) {\n    const isRestrictedComercial = user && typeof user.role === 'string' && user.role.toUpperCase().includes('COMERCIAL');"
  );
}

// Add filter before team totals
const replaceTotalComisiones = "const teamTotalComisiones = sellerStats.reduce";
if (content.includes(replaceTotalComisiones)) {
  content = content.replace(
    "const teamTotalComisiones = sellerStats.reduce",
    "const displayedSellerStats = isRestrictedComercial ? sellerStats.filter(s => { const sName = s.name.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim(); const uName = (user?.username || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim(); return sName === uName; }) : sellerStats;\n    const teamTotalComisiones = displayedSellerStats.reduce"
  );
  
  content = content.replace(
    "const teamTotalSales = sellerStats.reduce",
    "const teamTotalSales = displayedSellerStats.reduce"
  );
  
  content = content.replace(
    "const orderedDesc = [...sellerStats].sort",
    "const orderedDesc = [...displayedSellerStats].sort"
  );
  
  content = content.replace(
    "const orderedBySales = [...sellerStats].sort",
    "const orderedBySales = [...displayedSellerStats].sort"
  );
  
  content = content.replace(
    "sellerStats,\n          teamTotalComisiones",
    "sellerStats: displayedSellerStats,\n          teamTotalComisiones"
  );

  fs.writeFileSync('src/hooks/useComisionesData.ts', content, 'utf8');
  console.log("Updated useComisionesData.ts");
} else {
  console.log("Already updated or replace pattern not found");
}
