import type { DatosParte, Diseno } from '@/lib/partes/tipos'
import type { ParteDiarioPalanca } from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// DISEÑO «APPLE GLASS».
//
// Malla de color sobre fondo casi negro y capas de cristal encima: fondos
// blancos muy translúcidos, bordes de 1px, letra fina y muy espaciada, y los
// números grandes y ligeros. Es el que mejor «vende» la marca por dentro.
//
// Tres cosas del original no se pueden copiar tal cual y se imitan:
//  · No hay desenfoque (backdrop-filter no existe en Satori): el cristal se
//    finge con blanco al 10 % y un borde al 20 %, que es lo que de verdad se
//    lee como cristal cuando debajo hay color.
//  · No hay pesos 200/300/500/600: solo 400 y 700. La sensación de letra fina
//    se consigue con el 400 en tamaños grandes y espaciado negativo, y la de
//    etiqueta con el 400 muy espaciado en mayúsculas.
//  · No hay sombras de brillo (box-shadow): los puntos de color de las píldoras
//    van planos.
// Tampoco lleva emojis: el original no tiene ninguno y son el ruido que más
// rompe esta estética.
// ─────────────────────────────────────────────────────────────────────────────

// ── Medidas del lienzo ───────────────────────────────────────────────────────
const PAD = 40 // margen exterior
const GLASS_PV = 22 // relleno vertical de cada cristal
const GLASS_PH = 26 // relleno horizontal de cada cristal
const BORDE = 1
const SEP = 18 // aire entre cristales
const ANCHO_LEDE = 900 // la entradilla no ocupa todo el ancho: se lee mejor corta

// Alto real de un cristal = contenido + relleno + los dos bordes.
const cristal = (contenido: number) => contenido + GLASS_PV * 2 + BORDE * 2

// ── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  fondo: '#0A0A12',
  cristal: 'rgba(255,255,255,0.10)',
  cristalBorde: 'rgba(255,255,255,0.20)',
  velo: 'rgba(255,255,255,0.08)', // capa interior (tiras, listas)
  veloBorde: 'rgba(255,255,255,0.18)',
  tinta: '#FFFFFF',
  texto: 'rgba(255,255,255,0.86)',
  suave: 'rgba(255,255,255,0.72)',
  tenue: 'rgba(255,255,255,0.58)',
  linea: 'rgba(255,255,255,0.13)',
  ok: '#5BE49B',
  med: '#FFD666',
  no: 'rgba(255,255,255,0.45)',
}

// La malla de color del original va en hsla; aquí en rgba y con la opacidad ya
// rebajada, porque el velo oscuro que el original pone encima (::before) no se
// puede apilar: se descuenta a mano de cada capa.
const MALLA = [
  'radial-gradient(ellipse at 12% 4%, rgba(153,76,240,0.40) 0%, rgba(153,76,240,0) 55%)',
  'radial-gradient(ellipse at 88% 0%, rgba(49,194,246,0.33) 0%, rgba(49,194,246,0) 50%)',
  'radial-gradient(ellipse at 78% 58%, rgba(243,63,153,0.30) 0%, rgba(243,63,153,0) 50%)',
  'radial-gradient(ellipse at 4% 74%, rgba(26,230,155,0.25) 0%, rgba(26,230,155,0) 48%)',
  'radial-gradient(ellipse at 50% 100%, rgba(247,147,59,0.22) 0%, rgba(247,147,59,0) 55%)',
].join(', ')

// ── Frases con negritas (patrón heredado del diseño original) ────────────────
type Trozo = { t: string; b?: boolean }

/** Los trozos normales se parten por palabras para que la frase fluya al saltar
 *  de línea; las negritas se dejan enteras (son importes, no interesa partirlos). */
const porPalabras = (partes: Trozo[]): Trozo[] => {
  const fuera: Trozo[] = []
  for (const p of partes.filter(Boolean) as Trozo[]) {
    if (!p.t) continue
    if (p.b) { fuera.push(p); continue }
    for (const trozo of (String(p.t).match(/\S+\s*|\s+/g) || [])) fuera.push({ t: trozo })
  }
  return fuera
}

/** El texto plano de una frase, para poder medirla con d.a.lineas y que el alto
 *  calculado y el dibujado no puedan discrepar. */
const plano = (partes: (Trozo | null)[]) =>
  (partes.filter(Boolean) as Trozo[]).map(p => p.t).join('')

const Frase = ({ partes, tam, color, colorFuerte, ancho, altura }: any) => (
  <div style={{
    display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
    width: ancho, fontSize: tam, color, lineHeight: altura || 1.4,
  }}>
    {porPalabras(partes.filter(Boolean)).map((p: Trozo, i: number) => (
      <div key={i} style={{
        display: 'flex',
        fontSize: tam,
        fontWeight: p.b ? 700 : 400,
        color: p.b ? (colorFuerte || color) : color,
        whiteSpace: 'pre-wrap',
      }}>{p.t}</div>
    ))}
  </div>
)

// ── Textos que se usan dos veces (medir y dibujar) ───────────────────────────

const partesLede = (d: DatosParte): Trozo[] => {
  const { c, data, veredicto } = d
  const partes: Trozo[] = []
  if (c.ayer.ops > 0) {
    partes.push({ t: `${c.ayer.ops} ${c.ayer.ops === 1 ? 'operación' : 'operaciones'}`, b: true })
    if (c.ayer.importe > 0) {
      partes.push({ t: ' por ' }, { t: d.a.eur0(c.ayer.importe), b: true })
    }
    partes.push({ t: '. ' })
    if (c.posicionDia > 0) {
      partes.push({ t: `${c.posicionDia}.º del equipo`, b: true })
      partes.push({ t: data.equipo.media > 0 ? ' y un ' : '. ' })
    }
    if (data.equipo.media > 0) {
      partes.push({ t: `${d.a.num(Math.abs(d.pctMedia))} %`, b: true })
      partes.push({ t: ` ${d.pctMedia >= 0 ? 'por encima' : 'por debajo'} de la media. ` })
    }
  } else {
    partes.push({ t: 'Ni una operación', b: true }, { t: '. ' })
  }
  if ((c.rachaDias || 0) >= 2) {
    partes.push({ t: `${c.rachaDias} días seguidos vendiendo`, b: true }, { t: '. ' })
  }
  partes.push({ t: veredicto.cierre })
  return partes
}

const partesTitular = (d: DatosParte): Trozo[] => [
  { t: `${d.a.dia.el} fue ` },
  { t: d.veredicto.calificacion, b: true },
]

const partesAyerPalanca = (d: DatosParte, p: ParteDiarioPalanca): Trozo[] => {
  const del = d.c.ayer.porPalanca.find(x => x.palanca === p.nombre)
  return [
    ...(del && del.uds > 0
      ? [{ t: `${d.a.dia.El} sumaste ` },
         { t: p.esImporte ? d.a.eur0(del.importe) : `${del.uds} ${d.a.unidad(p.nombre, del.uds)}`, b: true },
         { t: '. ' }]
      : [{ t: `${d.a.dia.El}, ` }, { t: 'ninguna', b: true }, { t: '. ' }]),
    { t: 'Llevas ' },
    { t: p.esImporte ? d.a.eur2(p.llevamos) : d.a.num(p.llevamos), b: true },
    ...(p.objetivo > 0
      ? [{ t: ' de ' }, { t: p.esImporte ? d.a.eur0(p.objetivo) : d.a.num(p.objetivo) }]
      : []),
    { t: '.' },
  ]
}

/** Cifra de una palanca con su unidad: en € o en cosas, según cómo se mida. */
const cifra = (d: DatosParte, p: ParteDiarioPalanca, v: number) =>
  p.esImporte ? d.a.eur0(v) : `${d.a.num(v)} ${d.a.unidad(p.nombre, v)}`

/** Etiqueta corta del estado, la que va a la derecha del nombre y en la píldora. */
const etiquetaEstado = (d: DatosParte, p: ParteDiarioPalanca) => {
  const est = d.a.estado(p)
  return est === 'cubierto' ? 'Objetivo cubierto'
    : est === 'cero' ? 'Sin estrenar'
    : `${Math.round(p.pct)} %`
}

const colorEstado = (est: string) => est === 'cubierto' ? C.ok : est === 'cero' ? C.no : C.med

// ── El reto del mes ──────────────────────────────────────────────────────────
// El original enseña un número grande y una explicación de dos líneas. Aquí ese
// número es el ritmo diario que pide la palanca principal; si ya no queda nada
// que pedirle, se enseña la comisión del mes.
const reto = (d: DatosParte) => {
  const { c } = d
  const pr = c.ritmo.palanca ? c.palancas.find(p => p.nombre === c.ritmo.palanca) : undefined
  if (pr && pr.falta > 0 && c.ritmo.diasLaborablesRestantes > 0 && c.ritmo.ritmoNecesario > 0) {
    const linea1 = `${pr.nombre}: te faltan ${cifra(d, pr, pr.falta)} y quedan ${c.ritmo.diasLaborablesRestantes} `
      + `${c.ritmo.diasLaborablesRestantes === 1 ? 'día laborable' : 'días laborables'}.`
    const linea2 = c.ritmo.pctProyeccion > 0
      ? `Al ritmo de ahora (${cifra(d, pr, c.ritmo.ritmoDiarioActual)} al día) cerrarías el mes en `
        + `${cifra(d, pr, c.ritmo.proyeccionMes)}: el ${d.a.num(c.ritmo.pctProyeccion)} % del objetivo.`
      : `Ahora mismo vas a ${cifra(d, pr, c.ritmo.ritmoDiarioActual)} al día.`
    return { etiqueta: 'El reto del mes', grande: cifra(d, pr, c.ritmo.ritmoNecesario), pie: 'AL DÍA', linea1, linea2 }
  }
  return {
    etiqueta: 'Lo que llevas ganado',
    grande: d.a.eur2(c.mes.comisionTotal),
    pie: 'ESTE MES',
    linea1: `${d.a.eur2(c.mes.consolidada)} ya consolidados y ${d.a.eur2(c.mes.pendiente)} pendientes de activar.`,
    linea2: `${c.mes.ops} ${c.mes.ops === 1 ? 'venta' : 'ventas'} por ${d.a.eur0(c.mes.importe)} en lo que va de mes.`,
  }
}

// ── Las tres cosas de hoy ────────────────────────────────────────────────────
// Solo lo que sigue abierto y ordenado por dinero en juego (d.palancas ya viene
// ordenado así). Se queda en tres para que sea una lista y no otro inventario.
const tresCosas = (d: DatosParte) =>
  d.palancas.filter(p => d.a.estado(p) !== 'cubierto').slice(0, 3).map(p => {
    const est = d.a.estado(p)
    const partes: Trozo[] = p.falta > 0
      ? [{ t: est === 'cero' ? 'Estrena ' : 'Empuja ' }, { t: p.nombre, b: true },
         { t: ': te faltan ' }, { t: cifra(d, p, p.falta), b: true }, { t: '.' }]
      : [{ t: 'Estrena ' }, { t: p.nombre, b: true }, { t: ': sigue en cero y es dinero sobre la mesa.' }]
    return { p, partes }
  })

// ── Alturas ──────────────────────────────────────────────────────────────────
// Satori no mide solo: hay que darle el alto hecho. Cada bloque se calcula con
// las mismas frases que luego se dibujan, contando en cuántas líneas parten.

const altoPalanca = (d: DatosParte, p: ParteDiarioPalanca, ancho: number) => {
  const dentro = ancho - GLASS_PH * 2 - BORDE * 2
  const lAyer = d.a.lineas(plano(partesAyerPalanca(d, p)), dentro, 21)
  const lFalta = d.a.lineas(d.a.textoFalta(p), dentro - 32, 21)
  const lAnimo = d.a.lineas(d.a.textoAnimo(p), dentro, 19)
  return cristal(
    34            // cabecera (nombre + estado)
    + 16 + 4 + 14 // el pelo de progreso, con su aire arriba y abajo
    + lAyer * 30
    + 14 + 26 + lFalta * 30 // tira de «lo que falta» (relleno 12+12 + borde)
    + 12 + lAnimo * 27,
  )
}

/** Filas que ocupan las píldoras al envolverse. Se estima el ancho de cada una
 *  por lo largo del texto, tirando por lo alto: sobrar alto no rompe nada. */
const filasPildoras = (d: DatosParte, dentro: number) => {
  let filas = 1
  let usado = 0
  for (const p of d.palancas) {
    const texto = `${p.nombre} · ${etiquetaEstado(d, p)}`
    const ancho = 26 + 2 + 8 + 9 + texto.length * 19 * 0.55 + 10
    if (usado + ancho > dentro && usado > 0) { filas++; usado = ancho } else { usado += ancho }
  }
  return filas
}

const alto = (d: DatosParte) => {
  const inner = d.ancho - PAD * 2
  const dentroCristal = inner - GLASS_PH * 2 - BORDE * 2
  const anchoMitad = (inner - SEP) / 2

  // Cabecera: antetítulo + titular en dos líneas + entradilla.
  const lTitular = d.a.lineas(plano(partesTitular(d)), inner, 56)
  const lLede = d.a.lineas(plano(partesLede(d)), ANCHO_LEDE, 24)
  const altoCabecera = 22 + 12 + 61 + lTitular * 61 + 18 + lLede * 35

  const altoTrio = 46 + 8 + 19 // número grande + su etiqueta
  const altoAyer = cristal(19 + 16 + altoTrio)
  const altoMes = cristal(19 + 16 + altoTrio + 20 + 4 + 10 + 22)
  // 50 por fila = píldora de 40 + su separación; la última también la arrastra.
  const altoPildoras = cristal(19 + 16 + filasPildoras(d, dentroCristal) * 50)

  const altoDestacada = d.destacada ? altoPalanca(d, d.destacada, inner) + SEP : 0
  let altoResto = 0
  for (let i = 0; i < d.resto.length; i += 2) {
    altoResto += Math.max(
      altoPalanca(d, d.resto[i], anchoMitad),
      d.resto[i + 1] ? altoPalanca(d, d.resto[i + 1], anchoMitad) : 0) + SEP
  }

  const r = reto(d)
  const lR1 = d.a.lineas(r.linea1, dentroCristal, 20)
  const lR2 = d.a.lineas(r.linea2, dentroCristal, 20)
  const altoReto = cristal(19 + 12 + 64 + 8 + 18 + 14 + (lR1 + lR2) * 28)

  const cosas = tresCosas(d)
  const altoCosas = cosas.length
    ? cristal(19 + 16 + cosas.reduce((acc, c) =>
        acc + 24 + Math.max(26, d.a.lineas(plano(c.partes), dentroCristal - 34, 21) * 30) + 1, 0))
    : 0

  return Math.round(
    PAD + altoCabecera
    + SEP + altoAyer + SEP + altoMes + SEP + altoPildoras + SEP
    + altoDestacada + altoResto
    + altoReto + SEP + altoCosas
    + PAD + 48, // colchón: más vale sobrar que cortar la imagen por abajo
  )
}

// ── Piezas ───────────────────────────────────────────────────────────────────

const Cristal = ({ hijos, ancho, margen }: any) => (
  <div style={{
    display: 'flex', flexDirection: 'column', width: ancho,
    backgroundColor: C.cristal, border: `${BORDE}px solid ${C.cristalBorde}`,
    borderRadius: 26, padding: `${GLASS_PV}px ${GLASS_PH}px`, marginTop: margen === undefined ? SEP : margen,
  }}>{hijos}</div>
)

const Etiqueta = ({ texto }: { texto: string }) => (
  <div style={{
    fontSize: 15, fontWeight: 400, letterSpacing: 5, color: C.tenue, height: 19,
  }}>{texto.toUpperCase()}</div>
)

/** Una de las tres cifras de un cristal, con la rayita vertical de separación. */
const Cifra = ({ valor, clave, ancho, ultima }: any) => (
  <div style={{
    display: 'flex', flexDirection: 'column', width: ancho,
    paddingRight: ultima ? 0 : 22,
    borderRight: ultima ? '0px solid transparent' : `1px solid ${C.linea}`,
  }}>
    <div style={{ fontSize: 46, fontWeight: 400, letterSpacing: -1.6, color: C.tinta, lineHeight: 1 }}>{valor}</div>
    <div style={{ fontSize: 15, fontWeight: 400, letterSpacing: 2.4, color: C.tenue, marginTop: 8 }}>
      {String(clave).toUpperCase()}
    </div>
  </div>
)

const Pelo = ({ pct, margenArriba }: any) => (
  <div style={{
    display: 'flex', width: '100%', height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)', marginTop: margenArriba, marginBottom: 14,
  }}>
    <div style={{
      display: 'flex', width: `${Math.min(100, Math.max(2, pct))}%`, height: 4, borderRadius: 2,
      backgroundImage: 'linear-gradient(90deg, #FFFFFF, rgba(255,255,255,0.55))',
    }} />
  </div>
)

const diseno: Diseno = {
  clave: 'appleglass',
  nombre: 'Apple Glass',
  alto,
  render: (d: DatosParte) => {
    const { c, data } = d
    const inner = d.ancho - PAD * 2
    const dentroCristal = inner - GLASS_PH * 2 - BORDE * 2
    const anchoMitad = (inner - SEP) / 2
    const anchoTercio = dentroCristal / 3
    const r = reto(d)
    const cosas = tresCosas(d)

    const Palanca = ({ p, ancho }: any) => {
      const est = d.a.estado(p)
      const dentro = ancho - GLASS_PH * 2 - BORDE * 2
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', width: ancho,
          backgroundColor: C.cristal, border: `${BORDE}px solid ${C.cristalBorde}`,
          borderRadius: 26, padding: `${GLASS_PV}px ${GLASS_PH}px`, marginBottom: SEP,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 34 }}>
            <div style={{ fontSize: 26, fontWeight: 400, letterSpacing: -0.4, color: C.tinta }}>{p.nombre}</div>
            <div style={{ fontSize: 18, fontWeight: 400, letterSpacing: 0.3, color: colorEstado(est) }}>
              {etiquetaEstado(d, p)}
            </div>
          </div>
          <Pelo pct={p.pct} margenArriba={16} />
          <Frase
            ancho={dentro} tam={21} altura={1.42} color={C.texto} colorFuerte={C.tinta}
            partes={partesAyerPalanca(d, p)}
          />
          {/* La frase de «lo que falta» va sobre otra capa de cristal: es la que
              tiene que saltar a la vista sin recurrir a un color chillón. */}
          <div style={{
            display: 'flex', width: dentro, marginTop: 14, padding: '12px 16px',
            backgroundColor: C.velo, border: `1px solid ${C.veloBorde}`, borderRadius: 14,
            fontSize: 21, fontWeight: 400, lineHeight: 1.42, color: C.tinta,
          }}>{d.a.textoFalta(p)}</div>
          <div style={{ fontSize: 19, fontWeight: 400, lineHeight: 1.42, color: C.tenue, marginTop: 12 }}>
            {d.a.textoAnimo(p)}
          </div>
        </div>
      )
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', width: d.ancho, height: alto(d),
        backgroundColor: C.fondo, backgroundImage: MALLA,
        padding: PAD, fontFamily: 'Liberation Sans',
      }}>
        {/* Cabecera: fecha, titular a dos líneas y entradilla */}
        <div style={{ fontSize: 17, fontWeight: 400, letterSpacing: 7, color: C.tenue, height: 22 }}>
          {d.a.fechaLarga(data.fecha).toUpperCase()}
        </div>
        <div style={{
          fontSize: 56, fontWeight: 400, letterSpacing: -2, color: C.tinta, lineHeight: 1.09, marginTop: 12,
        }}>{`Hola ${c.nombre},`}</div>
        <Frase
          ancho={inner} tam={56} altura={1.09} color={C.tinta} colorFuerte={C.tinta}
          partes={partesTitular(d)}
        />
        <div style={{ display: 'flex', marginTop: 18 }}>
          <Frase
            ancho={ANCHO_LEDE} tam={24} altura={1.45} color={C.texto} colorFuerte={C.tinta}
            partes={partesLede(d)}
          />
        </div>

        {/* El día del que habla el parte */}
        <Cristal ancho={inner} hijos={[
          <Etiqueta key="e" texto={d.a.dia.El} />,
          <div key="t" style={{ display: 'flex', marginTop: 16 }}>
            <Cifra ancho={anchoTercio} valor={String(c.ayer.ops)} clave="Operaciones" />
            <Cifra ancho={anchoTercio} valor={d.a.eur0(c.ayer.importe)} clave="Facturado" />
            <Cifra ancho={anchoTercio} valor={d.a.eur2(c.ayer.comision)} clave="Comisión" ultima />
          </div>,
        ]} />

        {/* El mes */}
        <Cristal ancho={inner} hijos={[
          <Etiqueta key="e" texto="El mes" />,
          <div key="t" style={{ display: 'flex', marginTop: 16 }}>
            <Cifra ancho={anchoTercio} valor={String(c.mes.ops)} clave="Ventas" />
            <Cifra ancho={anchoTercio} valor={d.a.eur0(c.mes.importe)} clave="Facturado" />
            <Cifra ancho={anchoTercio} valor={d.a.eur2(c.mes.comisionTotal)} clave="Comisión" ultima />
          </div>,
          <Pelo key="p" pct={c.ritmo.pctProyeccion || 0} margenArriba={20} />,
          <div key="s" style={{ fontSize: 18, fontWeight: 400, color: C.tenue, height: 22, marginTop: -4 }}>
            {c.ritmo.pctProyeccion > 0 && c.ritmo.palanca
              ? `Proyección de ${c.ritmo.palanca} a fin de mes: ${d.a.num(c.ritmo.pctProyeccion)} % del objetivo`
              : `${d.a.eur2(c.mes.consolidada)} consolidados · ${d.a.eur2(c.mes.pendiente)} pendientes de activar`}
          </div>,
        ]} />

        {/* Las palancas de un vistazo */}
        <Cristal ancho={inner} hijos={[
          <Etiqueta key="e" texto="Tus palancas" />,
          <div key="p" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 16 }}>
            {d.palancas.map(p => (
              <div key={p.nombre} style={{
                display: 'flex', alignItems: 'center', height: 40, marginRight: 10, marginBottom: 10,
                padding: '0 13px', borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 999, marginRight: 9,
                  backgroundColor: colorEstado(d.a.estado(p)),
                }} />
                <div style={{ fontSize: 19, fontWeight: 400, color: C.texto }}>
                  {`${p.nombre} · ${etiquetaEstado(d, p)}`}
                </div>
              </div>
            ))}
          </div>,
        ]} />

        {/* Palanca destacada a todo lo ancho y el resto a dos columnas: Satori no
            tiene rejilla, así que las dos columnas van con anchos calculados. */}
        <div style={{ display: 'flex', marginTop: SEP }}>
          {d.destacada && <Palanca p={d.destacada} ancho={inner} />}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {d.resto.map(p => <Palanca key={p.nombre} p={p} ancho={anchoMitad} />)}
        </div>

        {/* El reto del mes */}
        <Cristal ancho={inner} margen={0} hijos={[
          <div key="e" style={{
            display: 'flex', justifyContent: 'center',
            fontSize: 15, fontWeight: 400, letterSpacing: 5, color: C.tenue, height: 19,
          }}>{r.etiqueta.toUpperCase()}</div>,
          <div key="g" style={{
            display: 'flex', justifyContent: 'center',
            fontSize: 64, fontWeight: 400, letterSpacing: -2.4, color: C.tinta, lineHeight: 1, marginTop: 12,
          }}>{r.grande}</div>,
          <div key="u" style={{
            display: 'flex', justifyContent: 'center',
            fontSize: 15, fontWeight: 400, letterSpacing: 4, color: C.tenue, height: 18, marginTop: 8,
          }}>{r.pie}</div>,
          <div key="1" style={{
            display: 'flex', justifyContent: 'center', width: dentroCristal,
            fontSize: 20, fontWeight: 400, lineHeight: 1.4, color: C.suave, marginTop: 14, textAlign: 'center',
          }}>{r.linea1}</div>,
          <div key="2" style={{
            display: 'flex', justifyContent: 'center', width: dentroCristal,
            fontSize: 20, fontWeight: 400, lineHeight: 1.4, color: C.suave, textAlign: 'center',
          }}>{r.linea2}</div>,
        ]} />

        {/* Si hoy solo haces tres cosas */}
        {cosas.length > 0 && (
          <Cristal ancho={inner} hijos={[
            <Etiqueta key="e" texto="Si hoy solo haces tres cosas" />,
            <div key="l" style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
              {cosas.map((cosa, i) => (
                <div key={cosa.p.nombre} style={{
                  display: 'flex', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12,
                  borderBottom: i === cosas.length - 1 ? '0px solid transparent' : `1px solid rgba(255,255,255,0.10)`,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, marginRight: 14, marginTop: 4,
                    border: '1px solid rgba(255,255,255,0.40)',
                  }} />
                  <Frase
                    ancho={dentroCristal - 34} tam={21} altura={1.42} color={C.texto} colorFuerte={C.tinta}
                    partes={cosa.partes}
                  />
                </div>
              ))}
            </div>,
          ]} />
        )}
      </div>
    )
  },
}

export default diseno
