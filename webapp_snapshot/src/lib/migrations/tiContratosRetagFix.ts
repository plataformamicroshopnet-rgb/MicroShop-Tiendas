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


// TANDA 2 (30-ago, aprobada por el dueño: «el 1 ok» — modelo ALTA POR LÍNEA):
// Telefónica paga los 10 € del ALTA CLIENTE (NC13D7/D8) por CADA línea que el
// cliente nuevo contrata el primer día — también las tecleadas como «Líneas
// extras adicionales» (la capa por gama es la misma: AV 15/MV 10/BV 5, así que
// adicional→Cliente NUEVO da capa+10 exacto). Junio: 28 líneas calibradas
// contra la pantalla de Liquidaciones (residuo +50 = BAF SA + pendientes).
// Julio: 33 líneas por el fichero spxd 2026-07 (sus capas llegan en la remesa
// de septiembre). La adicional BAF SA queda FUERA (punto 2, pendiente).
const RETAG2: { id: string; de: string; a: string }[] = [
  {
    "id": "8797edf2-4151-4a2c-bf69-9b41185a10b0",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "7b2f49c0-2de3-45dd-8f08-9a44405623ed",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "b396b65c-fdca-449d-8e85-b0adc8ec691b",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "71308717-bd4c-48b1-88b8-b00068eaa8be",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "b697c8a0-2387-4df3-b81b-37bf5354ad14",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "890d3af6-99cb-46bd-b56d-7cc50405f8f4",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "c597871d-0315-4adb-9c00-9137b3f1fdad",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "fa92c898-11b9-452b-85e3-97ed8e1101a0",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "d6415ad5-48f5-4fd0-9238-775e5a8069e5",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "1b28759e-33bd-4746-8a04-12eb45751d46",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "348a26f7-afdb-44e7-b8b2-0a539acb0d19",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "c05b1ad1-500f-43b9-9e62-ed9c6ea61e44",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "d19897b6-faee-46ea-830f-72764d92f034",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "77157962-5540-4dad-a000-66792f26668d",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "bb0b1f89-2646-4032-9c99-ea7aacecdb86",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "0a0f23c1-34b8-4a2b-a73f-2387510aa302",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "9655e7e0-4d03-45a3-9b8c-41a53a544ccc",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "57ef76b3-75fa-4212-bb04-b2c006795f1e",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "f4f27a85-f5be-4fdf-9b86-107e17eb1749",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "26de015c-cc50-4eef-be25-428c8712a4f1",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "c44a4b8a-4108-43cc-903e-5eae35d02d09",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "72f9ac5b-d211-4451-a6ba-e70809dc7bce",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "518cd632-e7c8-4c3b-bfe2-c909e6980034",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "105f155f-4249-43d9-ab86-6065861c7e5c",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "d5551e0c-9f71-4e9f-ae59-c0f5f3870a8f",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "fec9bdcd-911f-4a3a-a61b-876327094df3",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "c8f75066-397c-48eb-a919-ca82fd4e3bec",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "2d0bf83d-11a5-4e13-b1df-12fe1b988491",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "e6bb59a8-c7eb-47d7-a180-1e707ff3a902",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "467b9633-dbde-4605-ae49-3e1bab6c7601",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "e9e3dc7f-2f54-4ebe-8946-d91d976834c1",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "f7aaee18-a1f2-4b2c-aa35-0cfa22d7d56e",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "0ddec742-7e63-49ed-aaa1-5a6642c77b50",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "8b2ccc39-77ba-484d-8dca-5cf55b74cc51",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "6ca2ce1d-87bc-4714-926c-57d4390b7203",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "ab2886e0-2d39-4011-852b-0c1057aaf0ce",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "c8eff641-e08b-4f38-a7b9-a6f64c2dbc8b",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "5acf92fb-e5ac-4ada-a8b3-9718aa3fe2d6",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "1dda6606-af25-42e1-8435-216426473bc7",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "61b67563-17f4-4dc6-9714-aaec2212cbd6",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "b70fe4a6-f12d-4629-840f-98bc77b8940f",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "6b4a32e0-ed87-46b3-b3c5-d4524ca43214",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración",
    "a": "Contrato Móvil AV - Cliente NUEVO"
  },
  {
    "id": "bab94a32-1c62-4da0-ad28-d6e6bd5cf990",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "a2059983-6967-4b64-8202-e17f168b6d30",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración contrato móvil",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "d803e1ec-dc63-4704-9fe1-dbb4ef66bf17",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "6d66bf87-3ecb-4283-90cd-0a10c99a8aeb",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "a6132023-53d1-4c8b-ab87-6d357f328003",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "2600e5ce-1187-48b3-b9b6-19cd077fb2d9",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "831295e2-a3dd-483e-a993-bbf586d59179",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "4f6b6494-edf6-48b1-a1f8-4fca19b28c43",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "1b254161-a9d0-4dbf-9392-e57d13662c94",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "6f4a20af-54b4-409f-8ef6-fbe03906730b",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "98e0bcdf-dd50-4597-aeeb-9d636e02ef33",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "927ce199-2ddf-4785-9842-c7153b43cb45",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "bfa197b9-2973-48c1-ae1f-960c7ab0d93d",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "ade1855b-a9c2-4727-a49f-262365a9d5d3",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "b470b224-a9a4-48db-9e5c-56592513bd4c",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "118e00fa-6873-473e-b571-02d662276fa2",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "e5af415e-44bc-43eb-8f2f-9a8498de62da",
    "de": "Contrato Móvil MV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil MV - Cliente NUEVO"
  },
  {
    "id": "812bd773-c039-4411-864b-0af31fe70ea1",
    "de": "Contrato Móvil BV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil BV - Cliente NUEVO"
  },
  {
    "id": "040f5c9d-c151-46b4-b7e2-03b59ab93f28",
    "de": "Contrato Móvil AV - Alta, portabilidad y migración Líneas extras adicionales",
    "a": "Contrato Móvil AV - Cliente NUEVO"
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

    // (3) el re-etiquetado, venta a venta con guarda exacta (tandas 1 y 2)
    let retag = 0
    for (const r of [...RETAG, ...RETAG2]) {
      const res = await prisma.sale.updateMany({
        where: { id: r.id, producto: r.de },
        data: { producto: r.a } })
      retag += res.count
    }
    console.log(`[tiRetag] planos cerrados asegurados · ${retag}/${RETAG.length + RETAG2.length} ventas re-etiquetadas a Cliente NUEVO`)
  } catch (e) {
    console.error('[tiRetag] error (no bloquea el arranque):', e)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
