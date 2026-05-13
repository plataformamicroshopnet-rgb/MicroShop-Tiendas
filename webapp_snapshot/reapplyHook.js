const fs = require('fs');
let hook = fs.readFileSync('src/hooks/useComisionesData.ts', 'utf8');

if (!hook.includes('isRestrictedComercial')) {
    hook = hook.replace(
      "export function useComisionesData() {",
      "export function useComisionesData(user?: any) {"
    );

    hook = hook.replace(
      "const teamTotalComisiones = sellerStats.reduce((acc, s) => acc + s.totalComision, 0);",
      `const isRestrictedComercial = user && typeof user.role === 'string' && user.role.toUpperCase().includes('COMERCIAL');
    const displayedSellerStats = isRestrictedComercial ? sellerStats.filter(s => { const sName = s.name.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim(); const uName = (user?.username || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim(); return sName === uName; }) : sellerStats;
    const teamTotalComisiones = displayedSellerStats.reduce((acc, s) => acc + s.totalComision, 0);`
    );

    hook = hook.replace(
      "const teamTotalSales = sellerStats.reduce((acc, s) => acc + s.totalSales, 0);",
      "const teamTotalSales = displayedSellerStats.reduce((acc, s) => acc + s.totalSales, 0);"
    );

    hook = hook.replace(
      "const orderedDesc = [...sellerStats].sort((a, b) => b.totalComision - a.totalComision);",
      "const orderedDesc = [...displayedSellerStats].sort((a, b) => b.totalComision - a.totalComision);"
    );

    hook = hook.replace(
      "const orderedBySales = [...sellerStats].sort((a, b) => b.totalSales - a.totalSales);",
      "const orderedBySales = [...displayedSellerStats].sort((a, b) => b.totalSales - a.totalSales);"
    );

    hook = hook.replace(
      "selectedSellerFilter,\n        setSelectedSellerFilter,\n        sellerStats,\n        teamTotalComisiones",
      "selectedSellerFilter,\n        setSelectedSellerFilter,\n        sellerStats: displayedSellerStats,\n        teamTotalComisiones"
    );
    
    fs.writeFileSync('src/hooks/useComisionesData.ts', hook, 'utf8');
}
