import type { DatosParte, Diseno, AyudasParte } from '@/lib/partes/tipos'
import type { ParteDiarioPalanca } from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// DISEÑO 2 · MARCADOR DEPORTIVO
//
// El parte leído como el resultado de un partido: césped verde, el número del
// día enorme en amarillo de estadio, medallas, barras de estadísticas y un plan
// de partido para hoy. Para tiendas con pique sano.
//
// Aquí no hay ranking con los nombres de los compañeros: el comercial ve su
// puesto («2.º del equipo»), no las cifras de los demás.
// ─────────────────────────────────────────────────────────────────────────────

const V = {
  fondo: '#0C1410',
  cesped1: '#123020',
  cesped2: '#0F2A1B',
  cal: '#16A34A',        // la línea de cal: bordes y numeritos del plan
  menta: '#8FE3AE',
  tinta: '#E8F5EC',
  suave: '#CFEBDA',
  panel: '#10231A',
  borde: '#1F4630',
  bordeSuave: '#1B3B29',
  medalla: '#16341F',
  medallaBorde: '#2C6B41',
  oro: '#FFE04D',
  verde: '#22C55E',
  gris: '#4B5563',
  grisTinta: '#94A3B8',
  epigrafe: '#5FCB8A',
  negroCampo: '#04150B',
}

const PAD = 24            // margen lateral del cuerpo
const HUECO = 16          // separación entre las dos columnas de tarjetas
const FRANJA = 14         // alto de las bandas de césped del marcador
const BARRA_STAT = 120    // ancho fijo del carril de cada estadística
const VALOR_STAT = 64

// ── Medidas de bloque ────────────────────────────────────────────────────────
// Satori no mide nada por su cuenta: el alto se cuenta a mano bloque a bloque y
// tiene que cuadrar con lo que dibuja `render`. Por eso cada trozo vive en una
// función que usan las dos.

/** Ancho aproximado de una medalla, para saber cuándo salta de línea. */
const anchoMedalla = (texto: string) => 46 + texto.length * 10.5

const altoMedallas = (medallas: string[], ancho: number) => {
  if (!medallas.length) return 0
  const util = ancho - 60
  let filas = 1
  let usado = 0
  for (const m of medallas) {
    const w = anchoMedalla(m) + 10
    if (usado + w > util && usado > 0) { filas++; usado = w } else { usado += w }
  }
  return filas * 52 // 42 de medalla + 10 de aire por debajo
}

const medallasDe = (d: DatosParte): string[] => {
  const m: string[] = []
  if (d.c.ayer.ops > 0 && d.c.posicionDia > 0) {
    const medalla = d.c.posicionDia === 1 ? '🥇' : d.c.posicionDia === 2 ? '🥈' : d.c.posicionDia === 3 ? '🥉' : '📊'
    m.push(`${medalla} ${d.c.posicionDia}.º de ${d.c.totalComerciales} del equipo`)
  }
  if (d.data.equipo.media > 0 && d.c.ayer.ops > 0) {
    m.push(`📈 ${d.pctMedia >= 0 ? '+' : '-'}${d.a.num(Math.abs(d.pctMedia))} % sobre la media`)
  }
  if ((d.c.rachaDias || 0) >= 2) m.push(`🔥 ${d.c.rachaDias} días marcando`)
  m.push(`💶 ${d.a.eur2(d.c.mes.comisionTotal)} este mes`)
  return m
}

const altoMarcador = (d: DatosParte) =>
  FRANJA + 20 + 24 + 6 + 58 + 12 + 122 + 16 + altoMedallas(medallasDe(d), d.ancho) + 22 + FRANJA + 4

/** Epígrafe con la barra de cal a la izquierda. Alto fijo, márgenes incluidos. */
const ALTO_EPIGRAFE = 26 + 26 + 12

/** Filas del marcador del mes. */
const filasMes = (d: DatosParte): { et: string; valor: string; color?: string }[] => [
  { et: 'Ventas del mes', valor: `${d.c.mes.ops}` },
  { et: 'Facturado', valor: d.a.eur0(d.c.mes.importe) },
  { et: 'Comisión acumulada', valor: d.a.eur2(d.c.mes.comisionTotal), color: V.oro },
  { et: 'Ya consolidada', valor: d.a.eur2(d.c.mes.consolidada), color: V.verde },
  { et: 'Por consolidar', valor: d.a.eur2(d.c.mes.pendiente), color: V.grisTinta },
]

// Satori mide con «border-box»: el relleno y el borde comen del ancho declarado,
// así que lo que queda para el nombre hay que descontarlo entero o la fila se sale.
const ANCHO_NOMBRE_STAT = (ancho: number) => ancho - 46 - BARRA_STAT - 12 - VALOR_STAT - 12

const altoStat = (d: DatosParte, p: ParteDiarioPalanca, ancho: number) =>
  Math.max(52, 13 + d.a.lineas(p.nombre, ANCHO_NOMBRE_STAT(ancho), 18) * 24 + 13)

const altoStats = (d: DatosParte, anchoStat: number) => {
  let alto = 0
  for (let i = 0; i < d.palancas.length; i += 2) {
    alto += Math.max(
      altoStat(d, d.palancas[i], anchoStat),
      d.palancas[i + 1] ? altoStat(d, d.palancas[i + 1], anchoStat) : 0) + 10
  }
  return alto
}

const DENTRO_TARJETA = (ancho: number) => ancho - 36

/** Tarjeta de palanca: título, lo de ayer, lo que falta y el entrenador. */
const altoTarjeta = (d: DatosParte, p: ParteDiarioPalanca, ancho: number) => {
  const dentro = DENTRO_TARJETA(ancho)
  return 14 + 34
    + 10 + d.a.lineas(d.a.textoAyer(p), dentro, 19) * 26
    + 12 + d.a.lineas(d.a.textoFalta(p), dentro - 28, 19) * 26 + 18
    + 10 + d.a.lineas(`Entrenador: ${d.a.textoAnimo(p)}`, dentro, 18) * 25
    + 16 + 10
}

/** Frase del reto del mes: sale del ritmo, no de números inventados. */
const textoReto = (d: DatosParte): { titulo: string; frase: string } => {
  const r = d.c.ritmo
  const p = r.palanca ? d.palancas.find(x => x.nombre === r.palanca) : undefined
  const titulo = `Reto del mes${p ? ` · ${p.nombre}` : ''}`
  if (!p) return { titulo, frase: d.veredicto.cierre }
  const cifra = (v: number) => (p.esImporte ? d.a.eur0(v) : `${d.a.num(v)} ${d.a.unidad(p.nombre, v)}`)
  // Lo que decide si está cubierto es lo que FALTA, no el ritmo necesario. El
  // ritmo sale 0 también cuando no quedan días laborables —un mes ya cerrado—,
  // y entonces esto felicitaba por un objetivo al 14 %: «ya vas por encima de
  // lo que hacía falta» junto a «te faltan 11.630 €» en la misma imagen.
  if (p.falta <= 0) {
    return { titulo, frase: `Ya vas por encima de lo que hacía falta. Todo lo que caiga de aquí al cierre es extra para tu comisión.` }
  }
  if (r.diasLaborablesRestantes <= 0) {
    return { titulo, frase: `El mes ya está cerrado: te quedaste a ${cifra(p.falta)} del objetivo.` }
  }
  const dias = r.diasLaborablesRestantes
  const cola = dias > 0
    ? ` Quedan ${dias} ${dias === 1 ? 'día laborable' : 'días laborables'}: hacen falta ${cifra(r.ritmoNecesario)} al día.`
    : ''
  return {
    titulo,
    frase: `Al ritmo de ahora cierras el mes en ${cifra(r.proyeccionMes)}, un ${d.a.num(r.pctProyeccion)} % del objetivo.${cola}`,
  }
}

/** Plan de partido: las palancas donde queda dinero suelto, con su traducción. */
const planDeHoy = (d: DatosParte): string[] => {
  const abiertas = d.palancas.filter(p => p.falta > 0).slice(0, 3)
  if (!abiertas.length) return ['Todo cubierto: cada venta de hoy es propina limpia. Aguanta el ritmo hasta el cierre.']
  return abiertas.map(p => `${p.nombre} — ${d.a.textoFalta(p)}`)
}

const calcularAlto = (d: DatosParte): number => {
  const A = d.ancho
  const anchoUtil = A - PAD * 2
  const anchoStat = (anchoUtil - 12) / 2
  const anchoMitad = (anchoUtil - HUECO) / 2

  let alto = altoMarcador(d)

  // Marcador del mes
  alto += ALTO_EPIGRAFE + filasMes(d).length * 46 + 2
  if (d.destacada) alto += 10 + 56

  // Estadísticas
  alto += ALTO_EPIGRAFE + altoStats(d, anchoStat)

  // Jugada a jugada
  alto += ALTO_EPIGRAFE
  if (d.destacada) alto += altoTarjeta(d, d.destacada, anchoUtil)
  for (let i = 0; i < d.resto.length; i += 2) {
    alto += Math.max(
      altoTarjeta(d, d.resto[i], anchoMitad),
      d.resto[i + 1] ? altoTarjeta(d, d.resto[i + 1], anchoMitad) : 0)
  }

  // Reto del mes
  const reto = textoReto(d)
  alto += 22 + 18 + 22 + 6 + d.a.lineas(reto.frase, anchoUtil - 40, 26) * 34 + 18

  // Plan de partido
  alto += ALTO_EPIGRAFE
  for (const item of planDeHoy(d)) {
    alto += 12 + d.a.lineas(item, anchoUtil - 46, 19) * 26 + 12 + 1
  }

  return Math.round(alto + 30)
}

// ── Dibujo ───────────────────────────────────────────────────────────────────

type Trozo = { t: string; b?: boolean }

/**
 * Los trozos normales se parten POR PALABRAS: en Satori cada trozo es una pieza
 * suelta que se coloca entera o salta de línea, y un trozo largo se llevaba el
 * punto final a la línea siguiente.
 */
const porPalabras = (partes: (Trozo | null)[]): Trozo[] => {
  const fuera: Trozo[] = []
  for (const p of partes.filter(Boolean) as Trozo[]) {
    if (!p.t) continue
    if (p.b) { fuera.push(p); continue }
    for (const trozo of (String(p.t).match(/\S+\s*|\s+/g) || [])) fuera.push({ t: trozo })
  }
  return fuera
}

const Frase = ({ partes, tam, color, colorFuerte, ancho }: any) => (
  <div style={{
    display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
    width: ancho, fontSize: tam, color, lineHeight: 1.35,
  }}>
    {porPalabras(partes).map((p: Trozo, i: number) => (
      <div key={i} style={{
        display: 'flex', fontSize: tam, fontWeight: p.b ? 700 : 400,
        color: p.b ? (colorFuerte || color) : color, whiteSpace: 'pre-wrap',
      }}>{p.t}</div>
    ))}
  </div>
)

/**
 * Las franjas del césped se dibujan con divisiones de verdad, una al lado de
 * otra. Un `repeating-linear-gradient` sería lo natural, pero Satori no lo
 * entiende y se lleva por delante la imagen entera.
 */
const Cesped = ({ ancho }: { ancho: number }) => (
  <div style={{ display: 'flex', width: ancho, height: FRANJA, overflow: 'hidden' }}>
    {Array.from({ length: Math.ceil(ancho / 34) }).map((_, i) => (
      <div key={i} style={{
        display: 'flex', width: 34, height: FRANJA, flexShrink: 0,
        backgroundColor: i % 2 ? V.cesped2 : V.cesped1,
      }} />
    ))}
  </div>
)

const Epigrafe = ({ texto }: { texto: string }) => (
  <div style={{
    display: 'flex', alignItems: 'center', height: 26, marginTop: 26, marginBottom: 12,
    borderLeft: `4px solid ${V.cal}`, paddingLeft: 12,
    fontSize: 19, fontWeight: 700, letterSpacing: 3, color: V.epigrafe,
  }}>{texto.toUpperCase()}</div>
)

const Barra = ({ pct, color, ancho, alto }: any) => (
  <div style={{
    display: 'flex', width: ancho, height: alto, backgroundColor: V.bordeSuave,
    borderRadius: alto / 2, overflow: 'hidden',
  }}>
    <div style={{
      display: 'flex', width: `${Math.min(100, Math.max(2, pct))}%`, height: alto,
      borderRadius: alto / 2, backgroundColor: color,
    }} />
  </div>
)

/** Valor de la estadística: %, ✔ o el cero pelado, según cómo esté la palanca. */
const valorStat = (p: ParteDiarioPalanca, est: string) => {
  if (est === 'cero') return '0'
  if (p.objetivo > 0) return `${Math.round(p.pct)} %`
  return '✔'
}

const diseno: Diseno = {
  clave: 'marcador',
  nombre: 'Marcador deportivo',
  alto: calcularAlto,
  render: (d: DatosParte) => {
    const A = d.ancho
    const a: AyudasParte = d.a
    const anchoUtil = A - PAD * 2
    const anchoStat = (anchoUtil - 12) / 2
    const anchoMitad = (anchoUtil - HUECO) / 2
    const medallas = medallasDe(d)
    const reto = textoReto(d)

    const colorDe = (est: string) => (est === 'cubierto' ? V.verde : est === 'cero' ? V.gris : V.oro)
    const tintaDe = (est: string) => (est === 'cubierto' ? V.verde : est === 'cero' ? V.grisTinta : V.oro)

    const Stat = ({ p }: { p: ParteDiarioPalanca }) => {
      const est = a.estado(p)
      return (
        <div style={{
          display: 'flex', alignItems: 'center', width: anchoStat, minHeight: 52,
          backgroundColor: V.panel, border: `1px solid ${V.borde}`, borderRadius: 9,
          padding: '13px 22px', marginBottom: 10,
        }}>
          <div style={{
            display: 'flex', width: ANCHO_NOMBRE_STAT(anchoStat), fontSize: 18,
            fontWeight: 700, color: V.tinta, lineHeight: 1.3,
          }}>{p.nombre}</div>
          <div style={{ display: 'flex', marginLeft: 12 }}>
            <Barra pct={p.pct} color={colorDe(est)} ancho={BARRA_STAT} alto={8} />
          </div>
          <div style={{
            display: 'flex', width: VALOR_STAT, marginLeft: 12, justifyContent: 'flex-end',
            fontSize: 18, fontWeight: 700, color: tintaDe(est),
          }}>{valorStat(p, est)}</div>
        </div>
      )
    }

    const Tarjeta = ({ p, ancho }: { p: ParteDiarioPalanca; ancho: number }) => {
      const est = a.estado(p)
      const delDia = d.c.ayer.porPalanca.find(x => x.palanca === p.nombre)
      const dentro = DENTRO_TARJETA(ancho)
      const etiqueta = est === 'cubierto'
        ? '✔ Cubierto'
        : est === 'cero'
          ? (p.objetivo > 0 ? `0 de ${p.esImporte ? a.eur0(p.objetivo) : a.num(p.objetivo)}` : 'Sin estrenar')
          : `${Math.round(p.pct)} %`
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', width: ancho, backgroundColor: V.panel,
          border: `1px solid ${V.borde}`, borderRadius: 11, padding: '14px 16px 16px 16px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 34, overflow: 'hidden' }}>
            <div style={{ display: 'flex', fontSize: 23, fontWeight: 700, color: V.tinta }}>
              {`${a.iconoDe(p.nombre)} ${p.nombre}`}
            </div>
            <div style={{
              display: 'flex', fontSize: 16, fontWeight: 700, borderRadius: 5, padding: '4px 9px',
              backgroundColor: est === 'cubierto' ? V.verde : est === 'cero' ? V.gris : V.oro,
              color: est === 'cero' ? V.tinta : V.negroCampo,
            }}>{etiqueta}</div>
          </div>

          {/* En las palancas que se miden en euros lo que cuenta es el importe,
              no el número de líneas. */}
          <div style={{ display: 'flex', marginTop: 10 }}>
            <Frase
              ancho={dentro} tam={19} color={V.suave} colorFuerte="#FFFFFF"
              partes={[
                ...(delDia && delDia.uds > 0
                  ? [{ t: 'Ayer ' },
                     { t: p.esImporte ? a.eur0(delDia.importe) : `${delDia.uds} ${a.unidad(p.nombre, delDia.uds)}`, b: true },
                     { t: '. ' }]
                  : [{ t: 'Ayer, ' }, { t: 'ninguna', b: true }, { t: '. ' }]),
                { t: 'Llevas ' },
                { t: p.esImporte ? a.eur2(p.llevamos) : a.num(p.llevamos), b: true },
                ...(p.objetivo > 0
                  ? [{ t: ' de ' }, { t: p.esImporte ? a.eur0(p.objetivo) : a.num(p.objetivo) }]
                  : []),
                { t: '.' },
              ]}
            />
          </div>

          <div style={{
            display: 'flex', marginTop: 12, borderLeft: `4px solid ${tintaDe(est)}`,
            backgroundColor: V.medalla, borderRadius: 6, padding: '9px 12px',
          }}>
            <div style={{
              display: 'flex', width: dentro - 28, fontSize: 19, fontWeight: 700,
              color: est === 'cubierto' ? V.menta : V.tinta, lineHeight: 1.35,
            }}>{a.textoFalta(p)}</div>
          </div>

          <div style={{
            display: 'flex', width: dentro, marginTop: 10, fontSize: 18, fontWeight: 700,
            color: V.oro, lineHeight: 1.35,
          }}>{`Entrenador: ${a.textoAnimo(p)}`}</div>
        </div>
      )
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', width: A, height: calcularAlto(d),
        backgroundColor: V.fondo, fontFamily: 'Liberation Sans',
      }}>
        {/* ── EL MARCADOR ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', width: A,
          borderBottom: `4px solid ${V.cal}`,
          backgroundImage: `linear-gradient(180deg, ${V.cesped1} 0%, ${V.fondo} 100%)`,
        }}>
          <Cesped ancho={A} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 30px 22px 30px' }}>
            <div style={{ display: 'flex', height: 24, fontSize: 17, fontWeight: 700, letterSpacing: 5, color: V.menta }}>
              {`LIGA MICROSHOP · ${a.fechaLarga(d.data.fecha).toUpperCase()}`}
            </div>
            <div style={{ display: 'flex', height: 58, marginTop: 6, fontSize: 46, fontWeight: 700, color: V.tinta }}>
              {`Hola ${d.c.nombre}`}
            </div>

            {/* Ops · importe gigante · comisión, como el luminoso de un estadio */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 122, marginTop: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', width: 190, flexShrink: 0, alignItems: 'flex-end', paddingBottom: 26 }}>
                <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, letterSpacing: 3, color: V.menta }}>OPS</div>
                <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, color: V.tinta }}>{`${d.c.ayer.ops}`}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, alignItems: 'center', marginLeft: 30, marginRight: 30 }}>
                <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, color: V.oro, lineHeight: 1 }}>
                  {a.eur0(d.c.ayer.importe).replace(' €', '')}
                </div>
                <div style={{ display: 'flex', marginTop: 6, fontSize: 16, fontWeight: 700, letterSpacing: 3, color: V.menta }}>
                  EUROS DE AYER
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', width: 190, flexShrink: 0, paddingBottom: 26 }}>
                <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, letterSpacing: 3, color: V.menta }}>COMISIÓN</div>
                <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, color: V.verde }}>{a.eur2(d.c.ayer.comision)}</div>
              </div>
            </div>

            <div style={{
              display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
              width: A - 60, marginTop: 16,
            }}>
              {medallas.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', height: 42, marginRight: 10, marginBottom: 10,
                  backgroundColor: V.medalla, border: `1px solid ${V.medallaBorde}`, borderRadius: 8,
                  padding: '0 14px', fontSize: 19, fontWeight: 700, color: V.tinta,
                }}>{m}</div>
              ))}
            </div>
          </div>
          <Cesped ancho={A} />
        </div>

        {/* ── CUERPO ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: `0 ${PAD}px` }}>

          <Epigrafe texto="Marcador del mes" />
          <div style={{
            display: 'flex', flexDirection: 'column', width: anchoUtil,
            border: `1px solid ${V.borde}`, borderRadius: 10, overflow: 'hidden',
          }}>
            {filasMes(d).map((f, i, arr) => (
              <div key={f.et} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 46,
                padding: '0 16px', backgroundColor: V.panel,
                // «0px solid» y no «none»: el atajo con palabra suelta es el que
                // más papeletas tiene de que Satori no lo entienda.
                borderBottom: `${i === arr.length - 1 ? 0 : 1}px solid ${V.bordeSuave}`,
              }}>
                <div style={{ display: 'flex', fontSize: 19, fontWeight: 700, color: V.suave }}>{f.et}</div>
                <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: f.color || V.tinta }}>{f.valor}</div>
              </div>
            ))}
          </div>

          {d.destacada && (
            <div style={{
              display: 'flex', alignItems: 'center', width: anchoUtil, height: 56, marginTop: 10,
              backgroundColor: V.panel, border: `1px solid ${V.borde}`, borderRadius: 9, padding: '0 16px',
            }}>
              <div style={{ display: 'flex', width: anchoUtil - 376, fontSize: 18, fontWeight: 700, color: V.tinta }}>
                {`Objetivo del mes · ${d.destacada.nombre}`}
              </div>
              <div style={{ display: 'flex', marginLeft: 12 }}>
                <Barra pct={d.destacada.pct} color={colorDe(a.estado(d.destacada))} ancho={240} alto={12} />
              </div>
              <div style={{
                display: 'flex', width: 78, marginLeft: 12, justifyContent: 'flex-end',
                fontSize: 22, fontWeight: 700, color: tintaDe(a.estado(d.destacada)),
              }}>{`${Math.round(d.destacada.pct)} %`}</div>
            </div>
          )}

          <Epigrafe texto="Tus estadísticas" />
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', width: anchoUtil }}>
            {d.palancas.map(p => <Stat key={p.nombre} p={p} />)}
          </div>

          <Epigrafe texto="El mes, jugada a jugada" />
          {d.destacada && <Tarjeta p={d.destacada} ancho={anchoUtil} />}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', width: anchoUtil }}>
            {d.resto.map(p => <Tarjeta key={p.nombre} p={p} ancho={anchoMitad} />)}
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', width: anchoUtil, marginTop: 22,
            backgroundColor: V.cal, borderRadius: 12, padding: '18px 20px',
          }}>
            <div style={{
              display: 'flex', height: 22, fontSize: 17, fontWeight: 700, letterSpacing: 3,
              color: 'rgba(4,21,11,0.75)',
            }}>{reto.titulo.toUpperCase()}</div>
            <div style={{
              display: 'flex', width: anchoUtil - 40, marginTop: 6, fontSize: 26, fontWeight: 700,
              color: V.negroCampo, lineHeight: 1.3,
            }}>{reto.frase}</div>
          </div>

          <Epigrafe texto="Plan de partido de hoy" />
          {planDeHoy(d).map((item, i, arr) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', width: anchoUtil, padding: '12px 0',
              borderBottom: `${i === arr.length - 1 ? 0 : 1}px solid ${V.borde}`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: 12, marginTop: 2, marginRight: 12,
                backgroundColor: V.cal, color: V.negroCampo, fontSize: 16, fontWeight: 700,
              }}>{`${i + 1}`}</div>
              <div style={{
                display: 'flex', width: anchoUtil - 46, fontSize: 19, color: V.suave, lineHeight: 1.35,
              }}>{item}</div>
            </div>
          ))}
        </div>
      </div>
    )
  },
}

export default diseno
