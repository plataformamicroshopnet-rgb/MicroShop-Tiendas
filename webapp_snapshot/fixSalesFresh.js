const fs = require('fs');
let content = fs.readFileSync('src/app/api/sales/route.ts', 'utf8');

const freshUserSnippet = `
    const dbUser = await prisma.user.findUnique({
      where: { username: session.user.username },
      select: { role: true, permissions: true }
    });
    if (dbUser) {
      session.user.role = dbUser.role;
      session.user.permissions = dbUser.permissions;
    }
`;

// Update GET
content = content.replace(
  "const { user } = session\n\n    const { searchParams }",
  "const { user } = session\n" + freshUserSnippet + "\n    const { searchParams }"
);

// Update PATCH
content = content.replace(
  "if (!session || !canEdit(session.user, 'MODULE_TIENDAS')) {",
  freshUserSnippet + "\n    if (!session || !canEdit(session.user, 'MODULE_TIENDAS')) {"
);

// Update DELETE
content = content.replace(
  "if (!session || !(canEdit(session.user, 'MODULE_TIENDAS') || can(session.user, 'CANCEL_SALES'))) {",
  freshUserSnippet + "\n    if (!session || !(canEdit(session.user, 'MODULE_TIENDAS') || can(session.user, 'CANCEL_SALES'))) {"
);

fs.writeFileSync('src/app/api/sales/route.ts', content, 'utf8');
