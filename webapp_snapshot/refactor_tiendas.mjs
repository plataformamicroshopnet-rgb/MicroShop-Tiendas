import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DIR_SRC = path.join(process.cwd(), 'src');

const renames = [
  { from: 'src/app/ffvv', to: 'src/app/tiendas' },
  { from: 'src/app/direccion-ffvv', to: 'src/app/direccion-tiendas' },
  { from: 'src/app/ventas-ffvv', to: 'src/app/ventas-tiendas' },
  { from: 'src/app/visitas-ffvv', to: 'src/app/visitas-tiendas' }
];

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  });
}

async function main() {
  console.log('Replacing strings in files...');
  let filesModified = 0;
  walkDir(DIR_SRC, (filePath) => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.css')) {
      let content = fs.readFileSync(filePath, 'utf8');
      const original = content;

      // Especial cases for database modules so they stay uppercase
      content = content.replace(/MODULE_FFVV/g, 'MODULE_TIENDAS');
      content = content.replace(/MODULE_JEFE_FFVV/g, 'MODULE_JEFE_TIENDAS');
      content = content.replace(/MODULE_DIRECCION_FFVV/g, 'MODULE_DIRECCION_TIENDAS');

      // URLs and lowercase paths
      content = content.replace(/\/ffvv/g, '/tiendas');
      content = content.replace(/-ffvv/g, '-tiendas');

      // General Visual Replacements
      content = content.replace(/FFVV/g, 'Tiendas');
      
      // Some variables might have been `ffvv`
      content = content.replace(/ffvv/g, 'tiendas');

      if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        filesModified++;
      }
    }
  });
  console.log(`Updated content in ${filesModified} files.`);

  console.log('Updating database permissions...');
  const users = await prisma.user.findMany();
  for (const user of users) {
    if (user.permissions) {
      let newPerms = user.permissions;
      newPerms = newPerms.replace(/MODULE_FFVV/g, 'MODULE_TIENDAS');
      newPerms = newPerms.replace(/MODULE_JEFE_FFVV/g, 'MODULE_JEFE_TIENDAS');
      newPerms = newPerms.replace(/MODULE_DIRECCION_FFVV/g, 'MODULE_DIRECCION_TIENDAS');
      
      if (newPerms !== user.permissions) {
        await prisma.user.update({
          where: { id: user.id },
          data: { permissions: newPerms }
        });
      }
    }
  }
  console.log('Database updated.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
