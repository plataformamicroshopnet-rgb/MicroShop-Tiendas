// ─────────────────────────────────────────────────────────────────────────────
// POLÍTICA ANTIFRAUDE DE VENTAS (dueño, 27-ago-2026)
//
// Nace de la auditoría de junio-agosto: 12 operaciones confirmadas cobrando dos
// veces el mismo servicio (608 €) que NINGUNA de las 19 reglas de entonces vio.
// El aviso de duplicado de siempre no podía verlas —exigía que el producto se
// llamara EXACTAMENTE igual («Movistar+» no casa con «Movistar+ / Fútbol
// Total»), solo consultaba la base de datos y nunca las líneas de la propia
// venta, y 9 de las 12 entraron en la misma pulsación de Guardar.
//
// LAS REGLAS DE AQUÍ SE MIDIERON CONTRA LOS DATOS REALES antes de escribirlas:
//   · «ya va dentro del alta» → 31 avisos en 3 meses, caza 10 de 12, 0 molestias
//   · «duplicado por servicio» → 4 avisos, 4 aciertos, 0 molestias
//   · «pedido de dos clientes» → 11 avisos, 0 molestias (higiene, no dinero)
// Y se DESCARTÓ la regla que parecía obvia («alta + repo en el mismo pedido»):
// habría saltado 32 veces molestando a 23 operaciones correctas.
//
// Todas AVISAN, ninguna bloquea: siempre hay un caso legítimo raro, y bloquear
// empuja a teclear mal para esquivar el aviso. El candado es el rastro: quién
// aceptó, cuándo y sobre qué.
// ─────────────────────────────────────────────────────────────────────────────

export const norm = (v: any) =>
  String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim()

/** Los SERVICIOS que puede llevar una venta, se llamen como se llamen. Es la
 *  pieza clave: «Futbol Total PROMO Repo Up Destino Fútbol», «Futbol Total
 *  PROMO» y «Repo Up Destino Fútbol» son el MISMO servicio con tres nombres. */
export const SERVICIOS: { clave: string; etiqueta: string; pistas: string[] }[] = [
  { clave: 'futbol', etiqueta: 'Fútbol', pistas: ['futbol', 'laliga', 'la liga'] },
  { clave: 'movistarplus', etiqueta: 'Movistar+', pistas: ['movistar+', 'movistar +', 'movistar plus'] },
  { clave: 'netflix', etiqueta: 'Netflix', pistas: ['netflix', 'netfilx'] },
  { clave: 'ficcion', etiqueta: 'Ficción Total', pistas: ['ficcion'] },
  { clave: 'champions', etiqueta: 'Champions', pistas: ['champion'] },
  { clave: 'disney', etiqueta: 'Disney+', pistas: ['disney'] },
  { clave: 'motor', etiqueta: 'Motor', pistas: ['motor'] },
  { clave: 'deportes', etiqueta: 'Deportes', pistas: ['deportes'] },
]

/** Qué servicios nombra un texto (el producto de una venta, normalmente). */
export function serviciosDe(texto: any): string[] {
  const t = norm(texto)
  if (!t) return []
  return SERVICIOS.filter(s => s.pistas.some(p => t.includes(p))).map(s => s.clave)
}

export const etiquetaServicio = (clave: string) =>
  SERVICIOS.find(s => s.clave === clave)?.etiqueta || clave

/** Palancas donde un servicio se vende SUELTO (repos y suscripciones). */
export const esPalancaSuelta = (categoria: any) => {
  const c = norm(categoria)
  return c === 'repos up' || c === 'repos' || c === 'suscripciones tv' || c === 'repo futbol'
}

/** Palancas de ALTA: lo que se contrata de nuevo, con sus paquetes dentro. */
export const esPalancaAlta = (categoria: any) => {
  const c = norm(categoria)
  return c === 'mimovistar' || c === 'traslado mimovistar' || c === 'resto baf'
}

/** El extra de 10 € del fútbol cuelga del repo con `sustituyeA`: es la MISMA
 *  operación, no una segunda. Se ignora al comparar para no contarla dos veces.
 *  OJO — no confundir con la HIJA de una corrección de precio, que también lleva
 *  `sustituyeA` pero SÍ es una operación real y cobrada: esconderla dejaba en
 *  blanco a 88 clientes (lo cazó la revisión). */
export const esHermanaDelRepo = (v: any) =>
  norm(v?.detalle || v?.sheet) === 'repo futbol' && !!String(v?.sustituyeA || '').trim()

/** Ya no existe: solo lo ANULADO y las madres que otra línea sustituyó (su
 *  importe bueno lo aporta la hija). */
export const estaViva = (v: any) =>
  !(norm(v?.anulado) === 'si' || norm(v?.pendiente) === 'anulado' || v?.sustituida)

/** ¿Miramos esta línea al comparar? */
export const cuentaParaComparar = (v: any) => estaViva(v) && !esHermanaDelRepo(v)

/** Fecha de una venta ('dd/mm/aaaa'), o null si no se entiende. */
export const fechaDe = (f: any): Date | null => {
  const p = String(f || '').split('/')
  if (p.length !== 3) return null
  const d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]))
  return isNaN(d.getTime()) ? null : d
}

export interface AvisoAntifraude {
  clave: string        // para la confirmación (confirmarX)
  titulo: string
  texto: string
}

// ── REGLA 1 — «ESO YA VA DENTRO DEL ALTA» ───────────────────────────────────
// El alta ya nombra ese paquete y encima se graba suelto. OJO: NO dice
// «alta + repo = sospechoso» (eso molestaba a 23 operaciones correctas), dice
// «el alta YA nombra este servicio».
export function reglaYaVaDentro(
  lineas: { categoria: any; producto: any; sinPaquetePlus?: any }[],
  previas: { producto: any; detalle?: any; sheet?: any; fecha?: any; anulado?: any;
             pendiente?: any; sustituida?: any; sustituyeA?: any }[] = [],
  fechaVenta?: Date,
  dias = 30,
): AvisoAntifraude | null {
  // El alta puede venir en esta pulsación… o estar grabada de otra anterior. Sin
  // mirar la base de datos, partir la venta en dos guardados apagaba la regla —
  // y eso pasa en el 13 % de las ventas.
  const altasBD = previas
    .filter(p => cuentaParaComparar(p) && esPalancaAlta(p.detalle || p.sheet))
    .filter(p => {
      if (!fechaVenta) return true
      const f = fechaDe(p.fecha)
      return !!f && Math.abs(f.getTime() - fechaVenta.getTime()) <= dias * 86400000
    })
    .map(p => ({ categoria: p.detalle || p.sheet, producto: p.producto, fecha: p.fecha, sinPaquetePlus: false }))
  const altas = [
    ...lineas.filter(l => esPalancaAlta(l.categoria) && String(l.producto || '').trim()),
    ...altasBD,
  ]
  const sueltas = lineas.filter(l => esPalancaSuelta(l.categoria) && String(l.producto || '').trim())
  if (altas.length === 0 || sueltas.length === 0) return null
  for (const alta of altas) {
    let dentro = serviciosDe(alta.producto)
    // Con la promo «sin el Paquete Movistar Plus» el alta se llama «Movistar+…»
    // pero ese paquete NO va dentro: ahí el Movistar+ suelto es correcto.
    if ((alta as any).sinPaquetePlus) dentro = dentro.filter(x => x !== 'movistarplus')
    if (dentro.length === 0) continue
    for (const suelta of sueltas) {
      const repetidos = serviciosDe(suelta.producto).filter(s => dentro.includes(s))
      if (repetidos.length > 0) {
        const que = repetidos.map(etiquetaServicio).join(' y ')
        return {
          clave: 'confirmarYaVaDentro',
          titulo: 'Eso ya va dentro del alta',
          texto: `El alta de este cliente ya lleva ${que} dentro («${String(alta.producto).split('\n').join(' · ')}»`
               + ((alta as any).fecha ? `, del ${(alta as any).fecha}` : '') + `), `
               + `y además estás grabando «${String(suelta.producto).replace(/\n/g, ' · ')}» por separado. `
               + `Así se cobra dos veces lo mismo.\n\n`
               + `Si el cliente YA tenía su fibra de antes y ahora le subes el servicio, esto es correcto: sigue adelante.`,
        }
      }
    }
  }
  return null
}

// ── REGLA 2 — DUPLICADO POR SERVICIO ────────────────────────────────────────
// El mismo cliente y el mismo SERVICIO otra vez, en 30 días, MIRE QUIEN LO MIRE:
// también si lo hizo otra tienda, y también dentro de la propia venta.
export function reglaMismoServicio(
  lineas: { categoria: any; producto: any }[],
  previas: { producto: any; detalle?: any; sheet?: any; fecha?: any; codigo?: any; vendedor?: any;
             anulado?: any; pendiente?: any; sustituida?: any; sustituyeA?: any; anotaciones?: any }[],
  fechaVenta: Date,
  dias = 30,
): AvisoAntifraude | null {
  const sueltas = lineas.filter(l => esPalancaSuelta(l.categoria) && String(l.producto || '').trim())
  if (sueltas.length === 0) return null

  // (a) dentro de la propia venta: el mismo servicio dos veces
  const vistos = new Map<string, string>()
  for (const l of sueltas) {
    for (const s of serviciosDe(l.producto)) {
      if (vistos.has(s)) {
        return {
          clave: 'confirmarMismoServicioVenta',
          titulo: 'Dos veces el mismo servicio',
          texto: `En esta misma venta estás grabando ${etiquetaServicio(s)} dos veces `
               + `(«${vistos.get(s)}» y «${String(l.producto).replace(/\n/g, ' · ')}»).`,
        }
      }
      vistos.set(s, String(l.producto).replace(/\n/g, ' · '))
    }
  }

  // (b) contra lo ya grabado de ese cliente, venga de donde venga
  for (const l of sueltas) {
    const servicios = serviciosDe(l.producto)
    if (servicios.length === 0) continue
    for (const p of previas) {
      if (!cuentaParaComparar(p)) continue
      if (!esPalancaSuelta(p.detalle || p.sheet)) continue
      const f = fechaDe(p.fecha)
      if (!f || Math.abs(f.getTime() - fechaVenta.getTime()) > dias * 86400000) continue
      const repetidos = serviciosDe(p.producto).filter(s => servicios.includes(s))
      if (repetidos.length > 0) {
        const donde = [p.codigo, p.vendedor].filter(Boolean).join(' · ')
        return {
          clave: 'confirmarMismoServicioHistorico',
          titulo: 'Este cliente ya lo tiene',
          texto: `A este cliente ya se le hizo ${repetidos.map(etiquetaServicio).join(' y ')} el ${p.fecha}`
               + (donde ? ` en ${donde}` : '') + ` («${String(p.producto).replace(/\n/g, ' · ')}»).\n\n`
               + `Un cliente no se reposiciona dos veces al mismo servicio.`,
        }
      }
    }
  }
  return null
}

// ── REGLA 3 — UN NÚMERO DE PEDIDO, UN CLIENTE ───────────────────────────────
// No es dinero de más: es higiene. Un pedido usado por dos clientes rompe el
// cruce con la liquidación de Telefónica, y el semáforo lo pinta verde igual.
export function reglaPedidoDeOtroCliente(
  lineas: { numeroPedido?: any }[],
  nifActual: any,
  previasPorPedido: { numeroPedido?: any; nif?: any; nombreCliente?: any; fecha?: any;
                      anulado?: any; pendiente?: any; sustituida?: any }[],
): AvisoAntifraude | null {
  const basura = (v: string) => v.length < 6 || /^(.)\1+$/.test(v)
  const mios = new Set(lineas.map(l => String(l.numeroPedido || '').trim())
    .filter(v => v && !basura(v)))
  if (mios.size === 0) return null
  const yo = norm(nifActual)
  for (const p of previasPorPedido) {
    if (!estaViva(p)) continue
    const ped = String(p.numeroPedido || '').trim()
    if (!ped || !mios.has(ped)) continue
    if (norm(p.nif) === yo) continue
    return {
      clave: 'confirmarPedido',
      titulo: 'Ese número de pedido ya es de otro cliente',
      texto: `El pedido ${ped} está usado por ${p.nombreCliente || 'otro cliente'} (${p.nif}) del ${p.fecha}.\n\n`
           + `Cada operación lleva su propio número de pedido de Telefónica: con el de otro, esta venta no cruzará con la liquidación.`,
    }
  }
  return null
}

// ── REGLA 4 — LA MISMA LÍNEA, OTRA VEZ, CON EL MISMO PEDIDO ─────────────────
// El caso más tonto y más caro: el mismo producto, del mismo cliente y con el
// MISMO número de pedido, grabado en dos envíos distintos (una vez a las 16:39
// y otra a las 17:54). Se exige que sea OTRO envío a propósito: repetir línea
// DENTRO de una venta es la única forma de grabar dos unidades iguales.
export function reglaLineaRepetida(
  lineas: { producto: any; numeroPedido?: any; categoria?: any }[],
  previas: { producto: any; numeroPedido?: any; fecha?: any; vendedor?: any; codigo?: any;
             detalle?: any; sheet?: any;
             anulado?: any; pendiente?: any; sustituida?: any; sustituyeA?: any; anotaciones?: any }[],
): AvisoAntifraude | null {
  for (const l of lineas) {
    const ped = String(l.numeroPedido || '').trim()
    const prod = norm(l.producto)
    // Solo en repos y suscripciones: en Contratos Móvil o Rent, dos líneas
    // iguales del mismo pedido son dos unidades de verdad (dos líneas móviles,
    // dos terminales), y avisar ahí molesta a ventas correctas.
    if (!ped || !prod || !esPalancaSuelta((l as any).categoria)) continue
    const gemela = previas.find(p => cuentaParaComparar(p)
      && esPalancaSuelta(p.detalle || p.sheet)
      && String(p.numeroPedido || '').trim() === ped && norm(p.producto) === prod)
    if (gemela) {
      const donde = [gemela.codigo, gemela.vendedor].filter(Boolean).join(' · ')
      return {
        clave: 'confirmarLineaRepetida',
        titulo: 'Esto ya está grabado',
        texto: `Esta misma línea ya existe con el mismo número de pedido (${ped}): `
             + `«${String(gemela.producto).split('\n').join(' · ')}» del ${gemela.fecha}`
             + (donde ? ` (${donde})` : '')
             + `.\n\nParece la misma operación grabada dos veces.`,
      }
    }
  }
  return null
}
