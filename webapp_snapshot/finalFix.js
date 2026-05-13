const fs = require('fs');

// Fix api/sales/route.ts
let salesApi = fs.readFileSync('src/app/api/sales/route.ts', 'utf8');
salesApi = salesApi.replace(/const dbUser = await prisma\.user\.findUnique\(\{\s*where: \{ username: user\.username \},\s*select: \{ role: true, permissions: true \}\s*\}\);\s*if \(dbUser\) \{\s*user\.role = dbUser\.role;\s*user\.permissions = dbUser\.permissions;\s*\}/, 
`const dbUser = await prisma.user.findUnique({
      where: { username: session.user.username },
      select: { role: true, permissions: true }
    });
    const safeUser = { ...session.user, role: dbUser ? dbUser.role : session.user.role, permissions: dbUser ? dbUser.permissions : session.user.permissions };`);

salesApi = salesApi.replace(
  "const hasBackofficePerms = canView(user, 'MODULE_BACK_OFFICE');",
  "const hasBackofficePerms = canView(safeUser, 'MODULE_BACK_OFFICE');"
);
salesApi = salesApi.replace(
  "const baseWhereClause: any = (user.role === ROLES.ADMIN || user.role === ROLES.JEFE_VENTAS || user.role === ROLES.BACK_OFFICE || hasBackofficePerms)",
  "const baseWhereClause: any = (safeUser.role === ROLES.ADMIN || safeUser.role === ROLES.JEFE_VENTAS || safeUser.role === ROLES.BACK_OFFICE || hasBackofficePerms)"
);
salesApi = salesApi.replace(
  "vendedor: { equals: user.username || 'BLOCK_EMPTY_USER' }",
  "vendedor: { equals: safeUser.username || 'BLOCK_EMPTY_USER' }"
);

fs.writeFileSync('src/app/api/sales/route.ts', salesApi, 'utf8');

// Fix useComisionesData.ts
let comisionesHook = fs.readFileSync('src/hooks/useComisionesData.ts', 'utf8');
comisionesHook = comisionesHook.replace(
  "sellerStats,\n          teamTotalComisiones",
  "sellerStats: displayedSellerStats,\n          teamTotalComisiones"
);
fs.writeFileSync('src/hooks/useComisionesData.ts', comisionesHook, 'utf8');

console.log("Fixes applied successfully.");
