import { PrismaClient } from '@prisma/client'

// ENDEREZAR EL CATÁLOGO DE RENT (31-ago-2026, el dueño: «comprueba que tengo
// mal… hay algo que no cuadra»).
//
// QUÉ PASA. El Excel que se pega trae la cabecera «Fabricante | Categoría» pero
// DEBAJO pone el TIPO en la primera columna y la MARCA en la segunda
// (ACCESORIO | INNOVA). El importador las metía a ciegas, así que el programa
// guardó «fabricante = ACCESORIO» y «subcategoria = INNOVA» — al revés de lo
// que dicen sus propios nombres. Por eso Catálogos enseñaba «Fabricante:
// ACCESORIO» y Nueva Venta (que ya deduce los rótulos) enseñaba lo contrario:
// las dos pantallas se contradecían.
//
// Medido en la copia de producción: mayo y junio están BIEN (marca en
// `fabricante`); julio, agosto y septiembre al revés, 637 de 637 filas. Se
// torció en julio, al cambiar el orden de las dos primeras columnas del Excel.
//
// QUÉ HACE ESTO. Gira las dos columnas SOLO en las filas de Rent que están al
// revés, mes a mes, con guarda por fila: solo si `fabricante` es un TIPO
// conocido y `subcategoria` NO lo es. Las filas que ya están bien no se tocan,
// y mayo y junio se quedan como están.
//
// POR QUÉ HAY QUE ARREGLAR LOS DATOS Y NO SOLO LOS RÓTULOS: al re-pegar el
// Excel, el importador decide si una fila «ya estaba» comparando
// fabricante + subcategoria + gama (catalogos/page.tsx). Con el importador ya
// arreglado —que coloca cada valor en su sitio— las filas viejas torcidas NO
// casarían con las nuevas: las 637 se marcarían obsoletas y el Guardar LAS
// BORRARÍA, perdiendo las vigencias. Enderezar lo guardado cierra ese agujero.
//
// ⚠️ ESTO NO TOCA NINGÚN EURO: la venta guardada no lleva estas dos casillas y
// la comisión de un Rent se busca por NOMBRE de producto y fecha
// (lib/saleCommission). Es para que cada cosa se llame por su nombre.

// ⚠️ LA LISTA DE TIPOS SE IMPORTA, NO SE COPIA. El importador de Catálogos y
// esta migración TIENEN que estar de acuerdo sobre qué es un tipo: si cada uno
// llevara su lista y un día se separaran, al re-pegar el Excel las filas viejas
// no casarían y el Guardar las borraría con sus vigencias.
import { TIPOS_RENT } from '../rentColumnas'

const norm = (v: any) => String(v ?? '').trim().toUpperCase()
const TIPOS = TIPOS_RENT

export async function fixRentColumnas() {
  const prisma = new PrismaClient()
  try {
    const filas = await prisma.productCatalog.findMany({
      where: { categoria: 'Rent' },
      select: { id: true, fabricante: true, subcategoria: true },
    })
    let giradas = 0
    for (const f of filas) {
      // Guarda por fila: solo se gira si la de «fabricante» es un TIPO y la de
      // «subcategoria» no lo es. Si las dos lo son, o ninguna, se deja quieta.
      if (TIPOS.has(norm(f.fabricante)) && !TIPOS.has(norm(f.subcategoria))) {
        await prisma.productCatalog.update({
          where: { id: f.id },
          data: { fabricante: f.subcategoria, subcategoria: f.fabricante },
        })
        giradas++
      }
    }
    if (giradas) console.log(`[rentColumnas] ${giradas} filas de Rent enderezadas (marca a Fabricante, tipo a Categoría)`)
    else console.log('[rentColumnas] el catálogo de Rent ya está en su sitio')
  } catch (e) {
    console.error('[rentColumnas] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
