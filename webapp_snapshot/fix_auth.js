const fs = require('fs');
let content = fs.readFileSync('src/app/api/extras/assignments/route.ts', 'utf8');

// Add import for permissions
if (!content.includes("import { can, canEdit }")) {
  content = content.replace("import { getSession } from '@/lib/auth'", "import { getSession } from '@/lib/auth'\nimport { can, canEdit } from '@/lib/permissions'");
}

const targetAuthCheck = `    // Solo permitimos borrar a usuarios con permisos de edición
    if (session.user.role !== 'CRISTINA' && session.user.role !== 'JEFE_TIENDAS' && session.user.role !== 'SUPERADMIN' && session.user.role !== 'CONTROLLER') {
       return NextResponse.json({ success: false, error: 'No tienes permisos para borrar extras' }, { status: 403 })
    }`;

const newAuthCheck = `    if (!(canEdit(session.user, 'MODULE_TIENDAS') || can(session.user, 'CANCEL_SALES') || can(session.user, 'MODULE_CRISTINA') || can(session.user, 'MODULE_BACK_OFFICE'))) {
       return NextResponse.json({ success: false, error: 'No tienes permisos para borrar extras' }, { status: 403 })
    }`;

content = content.replace(targetAuthCheck, newAuthCheck);

fs.writeFileSync('src/app/api/extras/assignments/route.ts', content, 'utf8');
console.log('Fixed permissions check.');
