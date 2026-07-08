// Genera el siguiente identificador correlativo de accesorio: AL5000, AL5001, ...
// La serie es UNICA en todo el sistema (comparte cuenta MicroShop + MovilFree), de
// modo que el mismo codigo nunca se repite. El identificador vive en el PRODUCTO,
// asi que automaticamente es el mismo en todas las tiendas.

const PREFIJO = 'AL'
const INICIO = 5000

// Extrae el numero de un identificador con formato AL#### (case-insensitive). null si no cuadra.
export function parseIdentificador(id: string | null | undefined): number | null {
  if (!id) return null
  const m = String(id).trim().match(/^AL(\d+)$/i)
  return m ? parseInt(m[1], 10) : null
}

// Devuelve el siguiente identificador libre mirando TODOS los productos de ambos
// catalogos (MicroShopProduct + MovilFreeProduct). `prisma` es un PrismaClient ya creado.
export async function nextIdentificador(prisma: any): Promise<string> {
  const [ms, mf] = await Promise.all([
    prisma.microShopProduct.findMany({
      where: { identificador: { not: null } },
      select: { identificador: true },
    }),
    prisma.movilFreeProduct.findMany({
      where: { identificador: { not: null } },
      select: { identificador: true },
    }),
  ])
  let max = INICIO - 1
  for (const r of [...ms, ...mf]) {
    const n = parseIdentificador(r.identificador)
    if (n !== null && n > max) max = n
  }
  return `${PREFIJO}${max + 1}`
}

// Comprueba si un identificador ya lo usa OTRO producto (para avisar en ediciones a mano).
// Devuelve el nombre del producto que lo tiene, o null si esta libre.
export async function identificadorEnUso(
  prisma: any,
  identificador: string,
  excluirId?: string
): Promise<string | null> {
  const code = String(identificador || '').trim()
  if (!code) return null
  const [ms, mf] = await Promise.all([
    prisma.microShopProduct.findMany({ where: { identificador: code }, select: { id: true, nombre: true } }),
    prisma.movilFreeProduct.findMany({ where: { identificador: code }, select: { id: true, nombre: true } }),
  ])
  const hit = [...ms, ...mf].find((p: any) => p.id !== excluirId)
  return hit ? hit.nombre : null
}
