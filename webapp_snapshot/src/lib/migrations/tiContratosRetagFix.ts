import { PrismaClient } from '@prisma/client'

// Rectificación de Contratos Móvil hacia atrás (30-ago-2026, orden del dueño:
// «rectifica junio, julio y agosto de todas las tuberías») + el salvavidas de
// las vigencias que la hizo obligatoria:
//
// 1) La comisión de un contrato (Ti) se resuelve contra el catálogo del mes
//    ACTIVO por VIGENCIAS (findCatalogVigente con la fecha de la venta). La
//    «lista limpia» de septiembre retiró los 3 productos planos: el 1-sep los
//    contratos de jun/jul/ago se habrían quedado sin producto → comisión 0.
//    Aquí vuelven a septiembre CON VIGENCIA CERRADA (30/06→31/08): valoran lo
//    viejo y no se pueden teclear en septiembre.
// 2) Los «Cliente NUEVO» pasan a vigencia desde 01/06/2026 para que las ventas
//    re-etiquetadas de jun/jul los resuelvan (25/20/15).
// 3) Se re-etiquetan las ventas de clientes cuyo ALTA CLIENTE (NC13D7/D8) pagó
//    Telefónica — cruzado NIF a NIF con sus ficheros spxd de junio y julio
//    (22 + 26 ventas; una por cliente, la principal más antigua). AGOSTO se
//    rectificará igual cuando llegue su fichero spx.
// Todo con guardas exactas e idempotente. Las tuberías (ERP, Liquidaciones,
// informes) recalculan solas en el siguiente pull.

const PLANOS_CERRADOS = [
  { producto: 'Contrato Móvil AV - Alta, portabilidad y migración', anual: '15',
    sub: 'Altas, portabilidades y migraciones desde Prepago a Tarifa Móvil Ilimitada/Tarifa Móvil Ilimitada x2 · CERRADO 31/08: desde septiembre usa Cliente NUEVO/EXISTENTE' },
  { producto: 'Contrato Móvil MV - Alta, portabilidad y migración contrato móvil', anual: '10',
    sub: 'Altas, portabilidades y migraciones desde Prepago a Tarifa Móvil Max · CERRADO 31/08: desde septiembre usa Cliente NUEVO/EXISTENTE' },
  { producto: 'Contrato Móvil BV - Alta, portabilidad y migración contrato móvil', anual: '5',
    sub: 'Altas, portabilidades y migraciones desde Prepago a Tarifa Móvil Base · CERRADO 31/08: desde septiembre usa Cliente NUEVO/EXISTENTE' },
]
const NUEVOS_RETRO = ['Contrato Móvil AV - Cliente NUEVO', 'Contrato Móvil MV - Cliente NUEVO', 'Contrato Móvil BV - Cliente NUEVO']

// Los «Cliente NUEVO» también en los catálogos de jun/jul/ago: la tubería del
// ERP (ventas-export) y el panel valoran cada venta contra el catálogo de SU
// mes, no el activo — sin esta fila, las re-etiquetadas valdrían 0.
const NUEVOS_PASADO = [
  { producto: 'Contrato Móvil AV - Cliente NUEVO', anual: '25',
    sub: 'Altas, portabilidades y migraciones desde Prepago a Tarifa Móvil Ilimitada/Tarifa Móvil Ilimitada x2 · Cliente NUEVO en Movistar: lleva incluidos los 10 € del Alta Cliente Contrato (NC13D7)' },
  { producto: 'Contrato Móvil MV - Cliente NUEVO', anual: '20',
    sub: 'Altas, portabilidades y migraciones desde Prepago a Tarifa Móvil Max · Cliente NUEVO en Movistar: lleva incluidos los 10 € del Alta Cliente Contrato (NC13D7)' },
  { producto: 'Contrato Móvil BV - Cliente NUEVO', anual: '15',
    sub: 'Altas, portabilidades y migraciones desde Prepago a Tarifa Móvil Base · Cliente NUEVO en Movistar: lleva incluidos los 10 € del Alta Cliente Contrato (NC13D7)' },
]

const RETAG: { id: string; de: string; a: string }[] = [
  {
    "id": "d135c9eb-4486-4790-b135-d4bb8c6453ff",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "7bf06a59-fb2d-499d-a721-6c61087d0bcb",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "7d0a0b0e-fed1-433a-b753-7c334efd86e7",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "800a5128-8b53-4b83-9e66-37cddd2c39d5",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "6255f996-3cc5-45dc-bd10-29ac68beb5bd",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "e4b22ef3-e64d-4abf-95fe-98ae5d16c141",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "4a067b6c-d19c-4792-8833-581a1dd4dd76",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "34207758-fa80-4642-8d16-bede43ab467d",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "a54aa250-4ea4-4fea-a78b-4a40ce186ab4",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "7ea1fd37-e592-4601-9b9c-8ec3af9b1feb",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "0ad5f7c8-4375-47bc-8549-4235eb557eaa",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "a94b2a99-5ce8-4816-9f00-99a1d13546fb",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "9c561a9b-5789-44de-8f41-0b38694326f4",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "a031e63b-04b3-4318-97f3-998d8d112ee4",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "3191b057-015b-4353-8392-6eecdbbed8da",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "7f3dd3c7-4660-4d9d-a9ba-35cddc00ba66",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "05aab468-64a5-478b-aff9-757a7bfa84e8",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "3106ce6a-41f0-4a97-ac0b-b9d0985da6aa",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "b875edc0-e610-4982-a5a7-7130a12e2458",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "70405652-a360-44ee-9cf6-d37a42b2588e",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "6e49a37f-5f1b-429e-ab1b-34176a531e36",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "0729990a-3a78-42f8-ad83-24b9bde874ed",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "7d01a9b5-e39a-4409-afb6-a802d1be074c",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "5405054e-f96e-468c-b63e-6eee2fb61f71",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "641dd6aa-7235-4e11-9fb5-218aca81d69c",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "a109a1bf-d78c-46e8-9a9e-a57f7f31a8c5",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "4bd0e86a-d7fe-49e9-86a6-cd2e2345fb92",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "65bc59e5-2ca8-4921-9313-22a02dc653de",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "24f7cdc3-bbdc-4339-9b84-2fb94a2fee07",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "507e535d-a9de-4474-b1d7-9425d3332331",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "2fce1008-8e80-4adb-b7eb-1f198749b23e",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "3724b9bd-62f2-44e1-8078-7403351ed7c8",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "ebb2cc47-e07a-4f05-947a-82253ba69480",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "b41dbe23-cc08-420b-81c5-7a3037b1c951",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "2e957d29-4798-4679-9814-3fc645e9bfb2",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "4924ef2e-457b-4a7f-9799-0f79793c02cd",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "08ec9d29-6666-4bfd-befd-b8e0e9d326ae",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "2a7873c5-5de0-4a7a-8a0c-29f9d79a9c28",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "8390b512-50cb-4f6e-b8cb-ed63c6fbac47",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "f9251601-66ad-4ffc-a6d8-97886030885f",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "f09b4d1d-4415-4cf6-8195-9adabd42f91d",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "17be6afa-1197-4ece-b253-85a84a9b828f",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "d11e96d2-3ae9-4553-a096-33754154a3b4",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "1c2417e3-3fa7-4326-b127-4c9ec8a33a90",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "b7b98cc0-1f55-4b35-bdd5-9399a90f6fd7",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "935a2314-2747-4e64-9f33-220ccc8865f5",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "c9d6e0b5-d411-4274-b03c-315c60c1c7cd",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "a2222b85-7df6-427f-bb78-8df910cf8eab",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  }
]

export async function fixTiContratosRetag() {
  const prisma = new PrismaClient()
  try {
    const wp9 = await prisma.workPeriod.findUnique({ where: { period_key: '2026_09' } })
    if (wp9) {
      // (1) los planos, de vuelta con vigencia cerrada
      for (const p of PLANOS_CERRADOS) {
        const ya = await prisma.productCatalog.findFirst({
          where: { periodId: wp9.id, categoria: 'Ti', producto: p.producto } })
        if (!ya) {
          await prisma.productCatalog.create({ data: {
            periodId: wp9.id, categoria: 'Ti', producto: p.producto,
            mensual: 'NaN', anual: p.anual, validFrom: '30/06/2026', validTo: '31/08/2026',
            subcategoria: p.sub, fabricante: null, gama: null, comision: null, comisionConCoste: null } })
        } else if (!ya.validTo) {
          await prisma.productCatalog.update({ where: { id: ya.id }, data: { validTo: '31/08/2026' } })
        }
      }
      // (2) los NUEVO, con vigencia retro para las re-etiquetadas
      await prisma.productCatalog.updateMany({
        where: { periodId: wp9.id, categoria: 'Ti', producto: { in: NUEVOS_RETRO }, validFrom: '01/09/2026' },
        data: { validFrom: '01/06/2026' } })
    }
    // (2b) los «Cliente NUEVO» en los catálogos de jun/jul/ago
    for (const pkey of ['2026_06', '2026_07', '2026_08']) {
      const wp = await prisma.workPeriod.findUnique({ where: { period_key: pkey } })
      if (!wp) continue
      for (const n of NUEVOS_PASADO) {
        const ya = await prisma.productCatalog.findFirst({
          where: { periodId: wp.id, categoria: 'Ti', producto: n.producto } })
        if (ya) continue
        await prisma.productCatalog.create({ data: {
          periodId: wp.id, categoria: 'Ti', producto: n.producto,
          mensual: 'NaN', anual: n.anual, validFrom: '01/06/2026', validTo: null,
          subcategoria: n.sub, fabricante: null, gama: null, comision: null, comisionConCoste: null } })
      }
    }

    // (3) el re-etiquetado, venta a venta con guarda exacta
    let retag = 0
    for (const r of RETAG) {
      const res = await prisma.sale.updateMany({
        where: { id: r.id, producto: r.de },
        data: { producto: r.a } })
      retag += res.count
    }
    console.log(`[tiRetag] planos cerrados asegurados · ${retag}/${RETAG.length} ventas re-etiquetadas a Cliente NUEVO`)
  } catch (e) {
    console.error('[tiRetag] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
