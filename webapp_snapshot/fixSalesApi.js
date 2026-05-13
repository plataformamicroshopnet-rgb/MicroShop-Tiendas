const fs = require('fs');
let content = fs.readFileSync('src/app/api/sales/route.ts', 'utf8');

if (!content.includes('canView')) {
  content = content.replace(
    "import { can, canEdit } from '@/lib/permissions'",
    "import { can, canEdit, canView } from '@/lib/permissions'"
  );
}

if (!content.includes('force-dynamic')) {
  content = `export const dynamic = 'force-dynamic';\n` + content;
}

const getSnippet = `
    const dbUser = await prisma.user.findUnique({
      where: { username: session.user.username },
      select: { role: true, permissions: true }
    });
    if (dbUser) {
      session.user.role = dbUser.role;
      session.user.permissions = dbUser.permissions;
    }
`;

content = content.replace(
  "const { searchParams } = new URL(request.url)",
  getSnippet + "\n    const { searchParams } = new URL(request.url)"
);

content = content.replace(
  "const baseWhereClause: any = (user.role === ROLES.ADMIN || user.role === ROLES.JEFE_VENTAS || user.role === ROLES.BACK_OFFICE)",
  "const hasBackofficePerms = canView(user, 'MODULE_BACK_OFFICE');\n    const baseWhereClause: any = (user.role === ROLES.ADMIN || user.role === ROLES.JEFE_VENTAS || user.role === ROLES.BACK_OFFICE || hasBackofficePerms)"
);

fs.writeFileSync('src/app/api/sales/route.ts', content, 'utf8');
