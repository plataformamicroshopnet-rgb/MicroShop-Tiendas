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
// Este endpoint solo AÑADE: nunca borra ni pisa una fila existente, así que es
// seguro en un mes cerrado. Dos pasadas: `aplicar: false` enseña lo que haría,
// `true` lo hace. Y una fila solo entra si no está ya (misma categoría, producto,
// gama y subcategoría), así que repetir la operación no duplica nada.
//
// Dos formas de decirle qué añadir:
//   · `desde`  → copia esas filas de otro mes.
//   · `filas`  → tarifas tecleadas a mano, para cuando el mes cerrado necesita
//     algo que no existe en ningún otro mes. Fue el caso de las PROMO DIGI y
//     VODAFONE de junio y julio: cada mes tenía las suyas, distintas de agosto.
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
    const filas: any[] = Array.isArray(body?.filas) ? body.filas : []

    if (!hacia) {
      return NextResponse.json({ success: false, error: 'Falta el mes de destino.' }, { status: 400 })
    }
    if (filas.length === 0 && (!desde || desde === hacia)) {
      return NextResponse.json({ success: false, error: 'Indica el mes de origen y el de destino (distintos), o pasa las filas a añadir.' }, { status: 400 })
    }

    // ── MODO «FILAS TECLEADAS» ────────────────────────────────────────────────
    if (filas.length > 0) {
      const wpH = await prisma.workPeriod.findUnique({ where: { period_key: hacia } })
      if (!wpH) {
        return NextResponse.json({ success: false, error: `El mes ${hacia} no existe.` }, { status: 404 })
      }
      const limpias = filas
        .map(f => ({
          categoria: norm(f.categoria),
          producto: norm(f.producto),
          subcategoria: norm(f.subcategoria) || null,
          gama: norm(f.gama) || null,
          fabricante: norm(f.fabricante) || null,
          mensual: norm(f.mensual),
          anual: norm(f.anual),
          comision: norm(f.comision) || null,
          comisionConCoste: norm(f.comisionConCoste) || null,
          validFrom: norm(f.validFrom) || null,
          validTo: norm(f.validTo) || null,
        }))
        .filter(f => f.categoria && f.producto)
      if (limpias.length === 0) {
        return NextResponse.json({ success: false, error: 'Ninguna de las filas trae categoría y producto.' }, { status: 400 })
      }
      const yaHay = await prisma.productCatalog.findMany({ where: { periodId: wpH.id } })
      const puestas = new Set(yaHay.map(llave))
      // Y sin repetidas dentro de la propia lista pegada.
      const vistas = new Set<string>()
      const aInsertar = limpias.filter(f => {
        const k = llave(f)
        if (puestas.has(k) || vistas.has(k)) return false
        vistas.add(k)
        return true
      })
      const detalleF = limpias.map(f => ({
        categoria: f.categoria, subcategoria: f.subcategoria, gama: f.gama, producto: f.producto,
        comision: f.comision, comisionConCoste: f.comisionConCoste,
        nueva: !puestas.has(llave(f)),
      }))
      if (!aplicar) {
        return NextResponse.json({
          success: true, previsualizacion: true, desde: '(tecleadas)', hacia,
          copiaria: aInsertar.length, yaExistian: limpias.length - aInsertar.length, detalle: detalleF,
        })
      }
      if (aInsertar.length > 0) {
        await prisma.productCatalog.createMany({
          data: aInsertar.map(f => ({ ...f, periodId: wpH.id })),
        })
      }
      return NextResponse.json({
        success: true, previsualizacion: false, desde: '(tecleadas)', hacia,
        copiadas: aInsertar.length, yaExistian: limpias.length - aInsertar.length, detalle: detalleF,
      })
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
