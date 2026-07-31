import type { DatosParte, Diseno } from '@/lib/partes/tipos'
import type { ParteDiarioPalanca } from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// DISEÑO 9 · REVISTA
//
// Portada naranja a sangre con el importe de ayer en tamaño de titular, franja
// negra con las cuatro cifras, mosaico de palancas por colores y una página
// entera en negro para el reto del mes. Es el diseño más «marca»: se lee de un
// vistazo en el móvil y aguanta pegado en el corcho de la trastienda.
//
// Todo son bloques de color plano y tipografía gorda, que es justo lo que
// sobrevive tanto a Satori como al correo.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  papel: '#FFF6E9',
  tinta: '#141210',
  naranja: '#FF4D1F',
  verde: '#0E7A4A',
  amarillo: '#FFE04D',
  gris: '#C7C0B6',
  salmon: '#FFB199',
  cremaSuave: '#E7D9C6',
}

const PAD_LAT = 48
/** Ancho útil del cuerpo de la revista (los bloques de color van a sangre). */
const dentro = (d: DatosParte) => d.ancho - PAD_LAT * 2

// ── Piezas de texto ──────────────────────────────────────────────────────────
// Se definen fuera del render porque `alto()` tiene que medir EXACTAMENTE las
// mismas frases que luego se dibujan; si se escriben dos veces, se descuadran.

type Trozo = { t: string; b?: boolean }
const plano = (ps: (Trozo | null)[]) => ps.filter(Boolean).map(p => (p as Trozo).t).join('')

/** € que se lleva si cubre lo que falta. Misma fórmula que `dineroPorCubrir`. */
const dineroDe = (p: ParteDiarioPalanca) =>
  p.falta <= 0 ? 0 : (p.esImporte ? p.falta * (p.tarifaActual / 100) : p.falta * p.tarifaActual)

const titularPortada = (d: DatosParte): Trozo[] => [
  { t: `Hola ${d.c.nombre}: ayer fue ` },
  { t: d.veredicto.calificacion, b: true },
  { t: '. ' },
  { t: `${d.c.ayer.ops} ${d.c.ayer.ops === 1 ? 'operación' : 'operaciones'}`, b: true },
  { t: `. ${d.veredicto.cierre}` },
]

const frasesMes = (d: DatosParte): Trozo[] => {
  const { c, a } = d
  const pr = c.ritmo.palanca ? c.palancas.find(p => p.nombre === c.ritmo.palanca) : undefined
  const cifra = (v: number) => (pr && pr.esImporte ? a.eur0(v) : a.num(v))
  return [
    { t: 'Llevas ' },
    { t: a.eur0(c.mes.importe), b: true },
    { t: ' vendidos en ' },
    { t: `${c.mes.ops} ${c.mes.ops === 1 ? 'operación' : 'operaciones'}`, b: true },
    { t: '. De la comisión, ' },
    { t: a.eur2(c.mes.consolidada), b: true },
    { t: ' ya están firmados y ' },
    { t: a.eur2(c.mes.pendiente), b: true },
    { t: ' esperan a activarse.' },
    ...(pr
      ? [
          { t: ` En ${pr.nombre} vas a ` },
          { t: `${cifra(c.ritmo.ritmoDiarioActual)} al día`, b: true },
          { t: ' y harían falta ' },
          { t: cifra(c.ritmo.ritmoNecesario), b: true },
          { t: ': a este paso el mes cierra en el ' },
          { t: `${a.num(c.ritmo.pctProyeccion)} %`, b: true },
          { t: ' del objetivo.' },
        ]
      : []),
  ]
}

const frasesAyer = (d: DatosParte, p: ParteDiarioPalanca): Trozo[] => {
  const { c, a } = d
  const delDia = c.ayer.porPalanca.find(x => x.palanca === p.nombre)
  return [
    // En las palancas que se miden en euros lo que importa es el importe: «Ayer
    // sumaste 14 140 €» no se entiende.
    ...(delDia && delDia.uds > 0
      ? [
          { t: 'Ayer sumaste ' },
          { t: p.esImporte ? a.eur0(delDia.importe) : `${delDia.uds} ${a.unidad(p.nombre, delDia.uds)}`, b: true },
          { t: '. ' },
        ]
      : [{ t: 'Ayer, ' }, { t: 'ninguna', b: true }, { t: '. ' }]),
    { t: 'Llevas ' },
    { t: p.esImporte ? a.eur2(p.llevamos) : a.num(p.llevamos), b: true },
    ...(p.objetivo > 0 ? [{ t: ' de ' }, { t: p.esImporte ? a.eur0(p.objetivo) : a.num(p.objetivo) }] : []),
    { t: '.' },
  ]
}

const tituloPalanca = (d: DatosParte, p: ParteDiarioPalanca) => {
  const est = d.a.estado(p)
  const cola = est === 'cubierto' ? 'objetivo cubierto' : est === 'cero' ? 'sin estrenar' : `${Math.round(p.pct)} %`
  return `${d.a.iconoDe(p.nombre)} ${p.nombre} · ${cola}`
}

/** Las tres palancas que se cuentan a fondo: la destacada y dos más. */
const aFondo = (d: DatosParte) => [d.destacada, ...d.resto].filter(Boolean).slice(0, 3) as ParteDiarioPalanca[]

/** Los deberes de hoy: lo que queda por rascar y NO se ha contado ya a fondo. */
const hoyTres = (d: DatosParte) => {
  const contadas = new Set(aFondo(d).map(p => p.nombre))
  return d.palancas
    .filter(p => p.falta > 0 && !contadas.has(p.nombre))
    .sort((x, y) => dineroDe(y) - dineroDe(x))
    .slice(0, 3)
}

/** El reto del mes: lo que falta, sumado en piezas y en dinero. */
const reto = (d: DatosParte) => {
  const { a, c } = d
  const pendientes = d.palancas.filter(p => p.falta > 0).sort((x, y) => dineroDe(y) - dineroDe(x)).slice(0, 3)
  const sub = `Quedan ${c.ritmo.diasLaborablesRestantes} días laborables. `
    + `Llevas ${a.eur2(c.mes.consolidada)} firmados y ${a.eur2(c.mes.pendiente)} pendientes de activar.`
  if (!pendientes.length) {
    return { titular: `Todo cubierto: ${a.eur2(c.mes.comisionTotal)} de comisión este mes.`, sub }
  }
  const piezas = pendientes.map(p =>
    p.esImporte ? `${a.eur0(p.falta)} en ${p.nombre}` : `${Math.ceil(p.falta)} ${a.unidad(p.nombre, Math.ceil(p.falta))}`)
  const dinero = pendientes.reduce((s, p) => s + dineroDe(p), 0)
  return { titular: `${piezas.join(' + ')} = ${a.eur0(dinero)} más para ti`, sub }
}

const chipsPortada = (d: DatosParte) => {
  const { c, a, data } = d
  const out: string[] = []
  if (c.ayer.ops > 0 && c.posicionDia > 0) out.push(`${c.posicionDia}.º DEL EQUIPO`)
  if (data.equipo.media > 0 && c.ayer.ops > 0) {
    out.push(`${a.num(Math.abs(d.pctMedia))} % ${d.pctMedia >= 0 ? 'SOBRE' : 'BAJO'} LA MEDIA`)
  }
  out.push(`${a.eur2(c.mes.comisionTotal)} ESTE MES`)
  if ((c.rachaDias || 0) >= 2) out.push(`RACHA ${c.rachaDias} DÍAS`)
  return out
}

/** Valor grande de cada baldosa del mosaico. */
const valorMosaico = (d: DatosParte, p: ParteDiarioPalanca) =>
  p.objetivo > 0 ? `${Math.round(p.pct)} %` : (p.esImporte ? d.a.eur0(p.llevamos) : d.a.num(p.llevamos))

// El número de portada se encoge si el importe es largo: con siete cifras a
// 150 px se salía del papel y Satori lo parte por la mitad.
const tamHuge = (texto: string) => (texto.length > 9 ? 100 : texto.length > 7 ? 124 : 150)

// ── Piezas dibujadas ─────────────────────────────────────────────────────────

/**
 * Frase con partes en NEGRITA (el patrón de la referencia).
 *
 * Satori: un recuadro con más de un hijo TIENE que declarar «display: flex», y
 * como cada trozo es un hijo hace falta `flexWrap` para que la frase parta en
 * varias líneas. Los trozos normales se cortan POR PALABRAS antes de dibujar:
 * si no, un trozo largo salta entero de línea y deja el punto huérfano.
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

const Frase = ({ partes, tam, color, colorFuerte, ancho, alto }: any) => (
  <div style={{
    display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
    width: ancho, fontSize: tam, color, lineHeight: alto / tam,
  }}>
    {porPalabras(partes).map((p: Trozo, i: number) => (
      <div key={i} style={{
        display: 'flex', fontSize: tam, fontWeight: p.b ? 700 : 400,
        color: p.b ? (colorFuerte || color) : color,
        whiteSpace: 'pre-wrap',
      }}>{p.t}</div>
    ))}
  </div>
)

/** Titular de sección: caja negra con la palabra dentro, como los ladillos. */
const Ladillo = ({ texto }: { texto: string }) => (
  <div style={{ display: 'flex', margin: '34px 0 18px 0' }}>
    <div style={{
      display: 'flex', backgroundColor: C.tinta, color: C.papel,
      fontSize: 38, fontWeight: 700, letterSpacing: -1, padding: '6px 14px',
    }}>{texto.toUpperCase()}</div>
  </div>
)

/** Artículo: filete de color a la izquierda y el texto pegado a él. */
const Articulo = ({ color, children }: any) => (
  <div style={{ display: 'flex', width: '100%', marginBottom: 24 }}>
    <div style={{ display: 'flex', width: 8, alignSelf: 'stretch', backgroundColor: color }} />
    <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 22, flexGrow: 1 }}>{children}</div>
  </div>
)

// ── Alturas ──────────────────────────────────────────────────────────────────
// Satori no mide solo: si nos quedamos cortos la imagen se corta por abajo. Cada
// bloque se cuenta con los mismos textos y los mismos tamaños que el dibujo.

const A_LADILLO = 34 + 50 + 18
const A_STRIP = 26 + 44 + 8 + 20 + 26

const altoArticulo = (d: DatosParte, p: ParteDiarioPalanca, ancho: number) => {
  const t = ancho - 30
  return 34
    + 10 + d.a.lineas(plano(frasesAyer(d, p)), t, 22) * 33
    + 12 + d.a.lineas(d.a.textoFalta(p), t, 21) * 31
    + 10 + d.a.lineas(d.a.textoAnimo(p), t, 20) * 28
    + 24
}

const diseno: Diseno = {
  clave: 'revista',
  nombre: 'Revista',

  alto: (d: DatosParte) => {
    const util = dentro(d)
    const anchoArt = util - 30

    // Portada
    const huge = d.a.eur0(d.c.ayer.importe)
    const lTitular = d.a.lineas(plano(titularPortada(d)), 860, 30)
    let filas = 1, x = 0
    for (const t of chipsPortada(d)) {
      const w = t.length * 11 + 32 + 10
      if (x + w > util && x > 0) { filas++; x = w } else { x += w }
    }
    const altoPortada = 40 + 26 + 6 + Math.round(tamHuge(huge) * 0.86)
      + 14 + lTitular * 40 + 22 + filas * 40 + (filas - 1) * 10 + 44

    // El mes
    const altoMes = 34 + 10 + d.a.lineas(plano(frasesMes(d)), anchoArt, 22) * 33 + 24

    // Mosaico de palancas: 4 baldosas por fila, todas de la misma altura.
    const nombres = d.palancas.map(p => d.a.lineas(p.nombre.toUpperCase(), 222, 16))
    const lNombre = Math.max(2, ...(nombres.length ? nombres : [2]))
    const altoBaldosa = 18 + 36 + 8 + lNombre * 19 + 22
    const filasMos = Math.max(1, Math.ceil(d.palancas.length / 4))
    const altoMosaico = filasMos * altoBaldosa + (filasMos - 1) * 12

    // A fondo
    const altoFondo = aFondo(d).reduce((s, p) => s + altoArticulo(d, p, util), 0)

    // El reto (página negra a sangre)
    const r = reto(d)
    const altoFull = 34 + 36 + 26 + 12 + d.a.lineas(r.titular, util, 54) * 58
      + 16 + d.a.lineas(r.sub, util, 22) * 31 + 36

    // Hoy, tres cosas
    const tres = hoyTres(d)
    const altoTres = tres.length
      ? A_LADILLO + tres.reduce((s, p) => s + 6 + 36 + d.a.lineas(`${p.nombre}. ${d.a.textoAnimo(p)}`, 968, 22) * 32, 0)
        + (tres.length - 1) * 12 + 44
      : 44

    return Math.round(
      altoPortada + A_STRIP
      + A_LADILLO + altoMes
      + A_LADILLO + altoMosaico
      + A_LADILLO + altoFondo
      + altoFull
      + altoTres
      + 24)
  },

  render: (d: DatosParte) => {
    const { c, a, data } = d
    const util = dentro(d)
    const huge = a.eur0(c.ayer.importe)
    const anchoCelda = (util - 4 * 12) / 4
    const r = reto(d)
    const tres = hoyTres(d)

    const colorEstado = (p: ParteDiarioPalanca) => {
      const e = a.estado(p)
      return e === 'cubierto' ? C.verde : e === 'cero' ? C.tinta : C.naranja
    }

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', width: d.ancho,
        backgroundColor: C.papel, fontFamily: 'Liberation Sans',
      }}>
        {/* ── Portada ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          backgroundColor: C.naranja, padding: `40px ${PAD_LAT}px 44px ${PAD_LAT}px`,
        }}>
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: C.papel, letterSpacing: 6 }}>
            {`PARTE DEL DÍA · ${a.fechaLarga(data.fecha).toUpperCase()}`}
          </div>
          <div style={{
            display: 'flex', fontSize: tamHuge(huge), fontWeight: 700, color: C.papel,
            letterSpacing: -4, lineHeight: 0.86, marginTop: 6,
          }}>{huge}</div>
          <div style={{ display: 'flex', marginTop: 14 }}>
            <Frase
              ancho={860} tam={30} alto={40} color="rgba(255,246,233,0.92)" colorFuerte={C.papel}
              partes={titularPortada(d)}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 22 }}>
            {chipsPortada(d).map(t => (
              <div key={t} style={{
                display: 'flex', alignItems: 'center', height: 40, marginRight: 10, marginBottom: 10,
                backgroundColor: C.tinta, color: C.papel, borderRadius: 3,
                padding: '0 16px', fontSize: 19, fontWeight: 700, letterSpacing: 1,
              }}>{t}</div>
            ))}
          </div>
        </div>

        {/* ── Franja negra con las cuatro cifras ──────────────────────────── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          backgroundColor: C.tinta, padding: `26px ${PAD_LAT}px`,
        }}>
          {[
            { k: `${c.ayer.ops}`, t: 'OPS AYER' },
            { k: a.eur2(c.ayer.comision), t: 'COMISIÓN AYER' },
            { k: `${c.mes.ops}`, t: 'VENTAS DEL MES' },
            { k: a.eur2(c.mes.comisionTotal), t: 'COMISIÓN DEL MES' },
          ].map(m => (
            <div key={m.t} style={{ display: 'flex', flexDirection: 'column', width: (util - 48) / 4 }}>
              <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: C.papel, letterSpacing: -1, lineHeight: 1 }}>
                {m.k}
              </div>
              <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: C.salmon, letterSpacing: 2, marginTop: 8 }}>
                {m.t}
              </div>
            </div>
          ))}
        </div>

        {/* ── Cuerpo de la revista ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: `0 ${PAD_LAT}px` }}>
          <Ladillo texto="El mes" />
          <Articulo color={C.verde}>
            <div style={{ display: 'flex', fontSize: 27, fontWeight: 700, color: C.tinta, letterSpacing: -1 }}>
              {`${c.mes.ops} operaciones · ${a.eur0(c.mes.importe)} · ${a.eur2(c.mes.comisionTotal)} de comisión`}
            </div>
            <div style={{ display: 'flex', marginTop: 10 }}>
              <Frase ancho={util - 30} tam={22} alto={33} color={C.tinta} colorFuerte={C.tinta} partes={frasesMes(d)} />
            </div>
          </Articulo>

          <Ladillo texto="Palancas" />
          {/* Satori no entiende rejillas: el mosaico va con flexWrap y anchos
              calculados a mano. */}
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {d.palancas.map(p => {
              const e = a.estado(p)
              const fondo = e === 'cubierto' ? C.verde : e === 'cero' ? C.gris : C.amarillo
              const tinta = e === 'cubierto' ? C.papel : C.tinta
              return (
                <div key={p.nombre} style={{
                  display: 'flex', flexDirection: 'column', width: anchoCelda,
                  marginRight: 12, marginBottom: 12, borderRadius: 4,
                  backgroundColor: fondo, padding: '18px 18px 22px 18px',
                }}>
                  <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: tinta, letterSpacing: -1, lineHeight: 1 }}>
                    {valorMosaico(d, p)}
                  </div>
                  <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: tinta, letterSpacing: 1, marginTop: 8 }}>
                    {p.nombre.toUpperCase()}
                  </div>
                </div>
              )
            })}
          </div>

          <Ladillo texto="A fondo" />
          {aFondo(d).map(p => (
            <Articulo key={p.nombre} color={colorEstado(p)}>
              <div style={{ display: 'flex', fontSize: 27, fontWeight: 700, color: C.tinta, letterSpacing: -1 }}>
                {tituloPalanca(d, p)}
              </div>
              <div style={{ display: 'flex', marginTop: 10 }}>
                <Frase ancho={util - 30} tam={22} alto={33} color={C.tinta} colorFuerte={C.tinta} partes={frasesAyer(d, p)} />
              </div>
              <div style={{
                display: 'flex', width: util - 30, fontSize: 21, fontWeight: 700,
                color: colorEstado(p), lineHeight: 31 / 21, marginTop: 12,
              }}>{a.textoFalta(p)}</div>
              <div style={{
                display: 'flex', width: util - 30, fontSize: 20, fontWeight: 700,
                color: C.naranja, lineHeight: 28 / 20, marginTop: 10,
              }}>{a.textoAnimo(p)}</div>
            </Articulo>
          ))}
        </div>

        {/* ── Página a sangre: el reto del mes ────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', backgroundColor: C.tinta,
          marginTop: 34, padding: `36px ${PAD_LAT}px`,
        }}>
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: C.amarillo, letterSpacing: 5 }}>
            EL RETO DEL MES
          </div>
          <div style={{
            display: 'flex', width: util, fontSize: 54, fontWeight: 700, color: C.papel,
            letterSpacing: -2, lineHeight: 58 / 54, marginTop: 12,
          }}>{r.titular}</div>
          <div style={{
            display: 'flex', width: util, fontSize: 22, color: C.cremaSuave,
            lineHeight: 31 / 22, marginTop: 16,
          }}>{r.sub}</div>
        </div>

        {/* ── Los deberes de hoy ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: `0 ${PAD_LAT}px 44px ${PAD_LAT}px` }}>
          {tres.length > 0 && <Ladillo texto="Hoy, tres cosas" />}
          {tres.map((p, i) => (
            <div key={p.nombre} style={{
              display: 'flex', alignItems: 'flex-start', backgroundColor: '#FFFFFF',
              border: `3px solid ${C.tinta}`, padding: '18px 20px', marginBottom: 12,
            }}>
              <div style={{ display: 'flex', width: 62, fontSize: 30, fontWeight: 700, color: C.naranja, lineHeight: 32 / 30 }}>
                {`0${i + 1}`}
              </div>
              <div style={{ display: 'flex', marginTop: 0 }}>
                <Frase
                  ancho={968} tam={22} alto={32} color={C.tinta} colorFuerte={C.tinta}
                  partes={[{ t: p.nombre, b: true }, { t: `. ${a.textoAnimo(p)}` }]}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
}

export default diseno
