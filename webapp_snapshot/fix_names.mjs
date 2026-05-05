import fs from 'fs';
import path from 'path';

const filesToUpdate = [
  'src/lib/comisiones.ts',
  'src/lib/users.ts',
  'src/app/seguimiento-ventas/productos/page.tsx',
  'src/app/seguimiento-ventas/combos/page.tsx',
  'src/app/cumplimiento-telefonica/page.tsx'
];

const COMERCIAL_CODES_OLD = `const COMERCIAL_CODES: { name: string; code: string }[] = [
          { name: 'Juan Carlos', code: '2FV1WFN7D' },
          { name: 'Elena',       code: '2FV1WF1SK' },
          { name: 'Belén',       code: '2FV1WFK2Z' },
          { name: 'Javier',      code: '2FV1WFNFG' },
          { name: 'Luis',        code: '2FV1WFXCU' },
          { name: 'Maite',       code: '2FV1WFZF7' },
        ]`;

const COMERCIAL_CODES_NEW = `const COMERCIAL_CODES: { name: string; code: string }[] = [
          { name: 'Cristina', code: 'PINDI0023997' },
          { name: 'Elena',    code: 'PINDI0023998' },
          { name: 'Gabriel',  code: 'PINDI0554690' },
          { name: 'Carmen',   code: 'PINDI0023988' },
          { name: 'Carlos',   code: 'PINDI0023996' },
          { name: 'Nuria',    code: 'PINDI0051346' },
          { name: 'Vanesa',   code: 'PINDI0023994' },
          { name: 'Lara',     code: 'PINDI0023995' }
        ]`;

for (const file of filesToUpdate) {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace getProfile logic in comisiones.ts
    if (file.endsWith('comisiones.ts')) {
      content = content.replace(
        /if \(nombre === 'luis'\) return 'Básico'\s*if \(\['elena', 'javier', 'juan carlos', 'belen', 'maite'\]\.includes\(nombre\)\) return 'Plus'/,
        "if (['cristina', 'elena', 'gabriel', 'carmen', 'carlos', 'nuria', 'vanesa', 'lara'].includes(nombre)) return 'Plus'"
      );
      content = content.replace(
        /export const FIXED_SELLERS = \['Luis', 'Javier', 'Elena', 'Maite', 'Belén', 'Juan Carlos'\]/,
        "export const FIXED_SELLERS = ['Cristina', 'Elena', 'Gabriel', 'Carmen', 'Carlos', 'Nuria', 'Vanesa', 'Lara']"
      );
    }

    // Replace old combos logic in products and combos pages
    if (content.includes("name: 'Juan Carlos'") && content.includes("code: '2FV1WFN7D'")) {
      // This is a regex-like replace but safer with exact string if it matches
      // But since indentation might vary, we can use regex
      const regexOld = /const COMERCIAL_CODES[^\]]+\]/g;
      content = content.replace(regexOld, COMERCIAL_CODES_NEW);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated', file);
  } else {
    console.log('File not found:', file);
  }
}
