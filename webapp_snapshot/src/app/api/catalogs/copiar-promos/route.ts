import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// TRAER PRODUCTOS DE OTRO MES, SIN BORRAR NADA (dueño, 26-ago-2026).
//
// El caso: las «PROMO VODAFONE» y «PROMO DIGI» se dieron de alta en agosto, pero
// las ventas mal tipificadas son de junio y julio — y esos meses están HISTORIC,
// así que el guardado normal del catálogo (POST /api/catalogs) los rechaza… y
// además ese guardado es un BORRAR-Y-ESCRIBIR de la parrilla entera del mes, que
// aquí sería jugarse el catálogo completo por añadir 19 filas.
//
// Este endpoint solo AÑADE: copia del mes origen las filas que se le pidan y las
// inserta en el destino SOLO si no están ya (misma categoría, producto, gama y
// subcategoría). Nunca borra ni pisa una fila existente, así que es seguro en un
// mes cerrado. Dos pasadas: `aplicar: false` enseña lo que haría, `true` lo hace.
// ─────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient()

const norm = (v: any) => String(v ?? '').trim()
const llave = (f: any) => [norm(f.categoria), norm(f.producto), norm(f.gama), norm(f.subcategoria)].join('||').toLowerCase()

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !['ADMIN', 'JEFE DE VENTAS'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const desde = norm(body?.desde)
    const hacia = norm(body?.hacia)
    const categoria = norm(body?.categoria)          // p.ej. 'miMovistar' (vacío = todas)
    const contiene = norm(body?.contiene).toLowerCase()  // p.ej. 'promo' (busca en subcategoría/gama/producto)
    const aplicar = body?.aplicar === true

    if (!desde || !hacia || desde === hacia) {
      return NextResponse.json({ success: false, error: 'Indica el mes de origen y el de destino (distintos).' }, { status: 400 })
    }
    const [wpDesde, wpHacia] = await Promise.all([
      prisma.workPeriod.findUnique({ where: { period_key: desde } }),
      prisma.workPeriod.findUnique({ where: { period_key: hacia } }),
    ])
    if (!wpDesde || !wpHacia) {
      return NextResponse.json({ success: false, error: 'Alguno de los dos meses no existe.' }, { status: 404 })
    }

    const origen = await prisma.productCatalog.findMany({
      where: { periodId: wpDesde.id, ...(categoria ? { categoria } : {}) },
    })
    const candidatas = origen.filter(f => {
      if (!contiene) return true
      const texto = `${norm(f.subcategoria)} ${norm(f.gama)} ${norm(f.producto)}`.toLowerCase()
      return texto.includes(contiene)
    })
    if (candidatas.length === 0) {
      return NextResponse.json({ success: false, error: `En ${desde} no hay ninguna fila que encaje con ese filtro.` }, { status: 404 })
    }

    const destino = await prisma.productCatalog.findMany({ where: { periodId: wpHacia.id } })
    const yaEstan = new Set(destino.map(llave))
    const nuevas = candidatas.filter(f => !yaEstan.has(llave(f)))

    const detalle = candidatas.map(f => ({
      categoria: f.categoria,
      subcategoria: f.subcategoria,
      gama: f.gama,
      producto: f.producto,
      comision: f.comision,
      comisionConCoste: f.comisionConCoste,
      nueva: !yaEstan.has(llave(f)),
    }))

    if (!aplicar) {
      return NextResponse.json({
        success: true, previsualizacion: true, desde, hacia,
        copiaria: nuevas.length, yaExistian: candidatas.length - nuevas.length, detalle,
      })
    }

    if (nuevas.length > 0) {
      await prisma.productCatalog.createMany({
        data: nuevas.map(f => ({
          categoria: f.categoria,
          producto: f.producto,
          mensual: f.mensual,
          anual: f.anual,
          subcategoria: f.subcategoria,
          fabricante: f.fabricante,
          gama: f.gama,
          validFrom: f.validFrom,
          validTo: f.validTo,
          comision: f.comision,
          comisionConCoste: f.comisionConCoste,
          periodId: wpHacia.id,
        })),
      })
    }

    return NextResponse.json({
      success: true, previsualizacion: false, desde, hacia,
      copiadas: nuevas.length, yaExistian: candidatas.length - nuevas.length, detalle,
    })
  } catch (e: any) {
    console.error('Error copiando promociones de catálogo:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Error del servidor' }, { status: 500 })
  }
}
