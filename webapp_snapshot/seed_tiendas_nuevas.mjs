import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Eliminando comerciales antiguos...');
  await prisma.user.deleteMany({
    where: {
      role: {
        in: ['COMERCIAL PYME', 'COMERCIAL CAPTADOR', 'COMERCIAL']
      }
    }
  });

  const nuevosComerciales = [
    { name: 'Cristina', pindi: 'PINDI0023997', tienda: 'Auxiliadora 45' },
    { name: 'Elena', pindi: 'PINDI0023998', tienda: 'Auxiliadora 45' },
    { name: 'Gabriel', pindi: 'PINDI0554690', tienda: 'Auxiliadora 45' },
    { name: 'Carmen', pindi: 'PINDI0023988', tienda: 'Correhuela' },
    { name: 'Carlos', pindi: 'PINDI0023996', tienda: 'Villamayor' },
    { name: 'Nuria', pindi: 'PINDI0051346', tienda: 'Villamayor' },
    { name: 'Vanesa', pindi: 'PINDI0023994', tienda: 'Béjar' },
    { name: 'Lara', pindi: 'PINDI0023995', tienda: 'Béjar' },
    { name: 'Marta', pindi: 'PINDI_MARTA', tienda: 'O2' }
  ];

  const defaultPermissions = JSON.stringify([
    "MODULE_FFVV",
    "MODULE_CUMPLIMIENTO",
    "PRINT",
    "MODULE_COMISIONES",
    "MANAGE_MAGAZINES"
  ]);

  console.log('Añadiendo comerciales de Tiendas...');
  for (const c of nuevosComerciales) {
    try {
      await prisma.user.create({
        data: {
          username: c.name,
          password: 'password123',
          role: 'COMERCIAL TIENDA',
          permissions: defaultPermissions,
          codigoComercial: c.pindi
        }
      });
      console.log(`✅ Usuario creado: ${c.name} (${c.tienda})`);
    } catch (e) {
      console.log(`❌ Error al crear ${c.name}: ${e.message}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
