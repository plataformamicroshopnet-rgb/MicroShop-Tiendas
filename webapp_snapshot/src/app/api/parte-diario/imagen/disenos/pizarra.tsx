import type { DatosParte, Diseno } from '@/lib/partes/tipos'
import type { ParteDiarioPalanca } from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// DISEÑO «PIZARRA DE TIENDA».
//
// La idea: que parezca que el encargado lo ha escrito con tiza al abrir la
// tienda. Nada corporativo, nada de tarjetas de oficina: encerado verde, marcos
// de tiza, flechas amarillas y un pósit pegado con lo poco que hay que hacer hoy.
//
// Lo que NO se puede tener con Satori y cómo se ha resuelto:
//  · Letra manuscrita: solo hay «Liberation Sans». La voz de pizarra se consigue
//    con el color (tiza blanca, amarilla, verde y rosa sobre verde oscuro), con
//    marcos finos de esquinas desiguales y con el tono de los textos.
//  · Marcos y pósit torcidos: no hay rotación fiable, así que los marcos van
//    rectos y el pósit se distingue por color y sombra, no por el ángulo.
//  · Subrayados de tiza: en vez de «text-decoration» van como borde inferior de
//    un recuadro que se ajusta al texto (alignSelf: flex-start).
// ─────────────────────────────────────────────────────────────────────────────

// Paleta del encerado. Los mismos valores del catálogo original.
const P = {
  encerado: '#2A3630',
  tiza: '#F2F5EE',
  blanco: '#FFFFFF',
  claro: '#E3EADF',
  gris: '#A9BBAE',
  amarillo: '#FFD84D',
  verde: '#8FE388',
  rosa: '#FF9BA8',
  borde: 'rgba(255,255,255,0.50)',
  bordeAmarillo: 'rgba(255,216,77,0.75)',
  notaFondo: '#FFF7C2',
  notaTinta: '#3B3520',
  notaEtiqueta: '#8A7C3F',
}

// ── Medidas ─────────────────────────────────────────────────────────────────
// Todo lo que se mide aquí lo usan POR IGUAL `alto()` y `render()`: si se toca
// un número hay que tocarlo una sola vez o la imagen se corta por abajo.
const MADERA = 16          // grosor del marco de madera que rodea el encerado
const PAD_X = 34           // márgenes de tiza a izquierda y derecha
const PAD_TOP = 30
const PAD_BOT = 34
const PAD_M = 18           // relleno interior de cada marco de tiza
const BORDE_M = 2
const HUECO = 20           // separación entre las dos columnas de marcos

const TAM_H1 = 50, LH_H1 = 55
const TAM_LEDE = 25, LH_LEDE = 34
const TAM_TXT = 20, LH_TXT = 28
const TAM_ANIMO = 19, LH_ANIMO = 26
const ALTO_ROTULO = 32     // rótulo del marco + su hueco inferior
const ALTO_CIFRA = 74      // cifra grande + su pie
const ALTO_FILA = 34       // una línea del listado de palancas
const ANCHO_FLECHA = 34    // la columna de la flecha «→»

const interior = (d: DatosParte) => d.ancho - 2 * MADERA - 2 * PAD_X
const dentroDe = (ancho: number) => ancho - 2 * PAD_M - 2 * BORDE_M

// ── Textos ──────────────────────────────────────────────────────────────────
type Trozo = { t: string; b?: boolean }

/** El texto pelado de una frase con negritas, que es lo que hay que medir. */
const plano = (partes: Trozo[]) => partes.map(p => p.t).join('')

const colorDe = (estado: string) =>
  estado === 'cubierto' ? P.verde : estado === 'cero' ? P.rosa : P.amarillo

/** «71 %», «cubierto» o «sin estrenar» para el listado y el rótulo del marco. */
const marcador = (d: DatosParte, p: ParteDiarioPalanca) => {
  const est = d.a.estado(p)
  if (est === 'cero') return 'sin estrenar'
  if (p.objetivo > 0) return `${Math.round(p.pct)} %`
  return 'cubierto'
}

/** Entradilla: lo de ayer, el puesto, la media y la frase de cierre. */
const partesLede = (d: DatosParte): Trozo[] => {
  const ops = d.c.ayer.ops
  const partes: Trozo[] = [{ t: `${ops} ${ops === 1 ? 'operación' : 'operaciones'}`, b: true }]
  if (d.c.ayer.importe > 0) partes.push({ t: ' por ' }, { t: d.a.eur0(d.c.ayer.importe), b: true })
  partes.push({ t: '. ' })

  const pct = `${d.a.num(Math.abs(d.pctMedia))} % ${d.pctMedia >= 0 ? 'por encima' : 'por debajo'}`
  if (ops > 0 && d.c.posicionDia > 0) {
    partes.push({ t: 'Quedaste ' }, { t: `${d.c.posicionDia}.º del equipo`, b: true })
    if (d.data.equipo.media > 0) partes.push({ t: ' y un ' }, { t: pct, b: true }, { t: ' de la media' })
    partes.push({ t: '. ' })
  } else if (ops > 0 && d.data.equipo.media > 0) {
    partes.push({ t: 'Un ' }, { t: pct, b: true }, { t: ' de la media del equipo. ' })
  }

  if ((d.c.rachaDias || 0) >= 2) {
    partes.push({ t: 'Y van ' }, { t: `${d.c.rachaDias} días seguidos vendiendo`, b: true }, { t: '. ' })
  }
  partes.push({ t: d.veredicto.cierre })
  return partes
}

/** «Ayer sumaste 4 fibras. Llevas 11 de 17.», con los números en tiza amarilla. */
const partesAyer = (d: DatosParte, p: ParteDiarioPalanca): Trozo[] => {
  const del = d.c.ayer.porPalanca.find(x => x.palanca === p.nombre)
  const cabeza: Trozo[] = del && del.uds > 0
    ? [
        { t: 'Ayer sumaste ' },
        { t: p.esImporte ? d.a.eur0(del.importe) : `${del.uds} ${d.a.unidad(p.nombre, del.uds)}`, b: true },
        { t: '. ' },
      ]
    : [{ t: 'Ayer, ' }, { t: 'ninguna', b: true }, { t: '. ' }]
  const cuerpo: Trozo[] = [
    { t: 'Llevas ' },
    { t: p.esImporte ? d.a.eur2(p.llevamos) : d.a.num(p.llevamos), b: true },
  ]
  if (p.objetivo > 0) {
    cuerpo.push({ t: ' de ' }, { t: p.esImporte ? d.a.eur0(p.objetivo) : d.a.num(p.objetivo) })
  }
  cuerpo.push({ t: '.' })
  return [...cabeza, ...cuerpo]
}

/** Línea de tiza bajo «Lo de ayer»: qué hizo el equipo entero. */
const extraAyer = (d: DatosParte) =>
  `El equipo cerró ${d.data.equipo.ops} ${d.data.equipo.ops === 1 ? 'operación' : 'operaciones'}`
  + ` por ${d.a.eur0(d.data.equipo.importe)}`
  + (d.data.equipo.media > 0 ? ` (media de ${d.a.eur0(d.data.equipo.media)} por comercial).` : '.')

/** Línea de tiza bajo «El mes»: días que quedan y a dónde llega el ritmo actual. */
const extraMes = (d: DatosParte) => {
  const r = d.c.ritmo
  const dias = r.diasLaborablesRestantes
  const base = dias > 0
    ? `Quedan ${dias} ${dias === 1 ? 'día laborable' : 'días laborables'} de mes.`
    : 'Último empujón: ya no quedan días laborables.'
  const pal = r.palanca ? d.c.palancas.find(p => p.nombre === r.palanca) : undefined
  if (!pal || r.proyeccionMes <= 0) return base
  // La proyección va en € o en unidades según sea la palanca, así que se
  // formatea preguntándoselo a ella y no adivinando.
  const proy = pal.esImporte ? d.a.eur0(r.proyeccionMes) : `${d.a.num(r.proyeccionMes)} ${d.a.unidad(pal.nombre, r.proyeccionMes)}`
  return `${base} A este ritmo cerrarías ${pal.nombre} en ${proy}.`
}

/** Las tres cosas del pósit: primero lo sin estrenar, que es dinero suelto. */
const tareas = (d: DatosParte): ParteDiarioPalanca[] => {
  const cero = d.palancas.filter(p => d.a.estado(p) === 'cero')
  const medias = d.palancas.filter(p => d.a.estado(p) === 'medias')
  const candidatas = [...cero, ...medias]
  return (candidatas.length ? candidatas : d.palancas).slice(0, 3)
}

const textoTarea = (d: DatosParte, p: ParteDiarioPalanca) => `${p.nombre}: ${d.a.textoFalta(p)}`

// ── Alturas ─────────────────────────────────────────────────────────────────
const altoMarcoCifras = (d: DatosParte, extra: string, ancho: number) =>
  2 * BORDE_M + 2 * PAD_M + ALTO_ROTULO + ALTO_CIFRA
  + 14 + d.a.lineas(extra, dentroDe(ancho) - ANCHO_FLECHA, TAM_TXT) * LH_TXT

const altoMarcoLista = (d: DatosParte, ancho: number) =>
  2 * BORDE_M + 2 * PAD_M + ALTO_ROTULO + Math.ceil(d.palancas.length / 2) * ALTO_FILA

const altoMarcoPalanca = (d: DatosParte, p: ParteDiarioPalanca, ancho: number) => {
  const dentro = dentroDe(ancho)
  return 2 * BORDE_M + 2 * PAD_M
    + 34                                                                    // rótulo con el nombre y el marcador
    + 10 + d.a.lineas(plano(partesAyer(d, p)), dentro, TAM_TXT) * LH_TXT
    + 12 + d.a.lineas(d.a.textoFalta(p), dentro - ANCHO_FLECHA, TAM_TXT) * LH_TXT
    + 8 + d.a.lineas(d.a.textoAnimo(p), dentro, TAM_ANIMO) * LH_ANIMO
}

const ANCHO_NOTA = 760
const altoNota = (d: DatosParte, items: ParteDiarioPalanca[]) => {
  const texto = ANCHO_NOTA - 2 * PAD_M - 28
  let h = 2 * PAD_M + 24
  for (const p of items) h += 10 + d.a.lineas(textoTarea(d, p), texto, TAM_TXT) * LH_TXT
  return h
}

// ── Piezas del dibujo ───────────────────────────────────────────────────────
// Los trozos normales se parten POR PALABRAS: si no, un trozo largo salta
// entero de línea y deja el punto huérfano al principio de la siguiente.
const porPalabras = (partes: Trozo[]): Trozo[] => {
  const fuera: Trozo[] = []
  for (const p of partes.filter(Boolean) as Trozo[]) {
    if (!p.t) continue
    if (p.b) { fuera.push(p); continue }
    for (const trozo of (String(p.t).match(/\S+\s*|\s+/g) || [])) fuera.push({ t: trozo })
  }
  return fuera
}

/** Frase con trozos en tiza de color. Cada trozo es un hijo, así que el
 *  recuadro DEBE declarar display:flex y flexWrap para poder partir. */
const Frase = ({ partes, tam, lh, color, colorFuerte, ancho }: any) => (
  <div style={{
    display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
    width: ancho, fontSize: tam, color, lineHeight: lh,
  }}>
    {porPalabras(partes).map((p: Trozo, i: number) => (
      <div key={i} style={{
        display: 'flex', fontSize: tam, lineHeight: lh,
        fontWeight: p.b ? 700 : 400,
        color: p.b ? (colorFuerte || color) : color,
        whiteSpace: 'pre-wrap',
      }}>{p.t}</div>
    ))}
  </div>
)

/** Marco «de tiza»: esquinas con radios desiguales para que no parezca una
 *  tarjeta de oficina, que es lo más cerca del trazo a mano que permite Satori. */
const Marco = ({ ancho, color, mt, children }: any) => (
  <div style={{
    display: 'flex', flexDirection: 'column', width: ancho, marginTop: mt || 0,
    border: `${BORDE_M}px solid ${color || P.borde}`,
    borderTopLeftRadius: 16, borderTopRightRadius: 6,
    borderBottomRightRadius: 18, borderBottomLeftRadius: 8,
    padding: PAD_M,
  }}>{children}</div>
)

const Rotulo = ({ texto }: any) => (
  <div style={{
    display: 'flex', fontSize: 18, lineHeight: 1.2, letterSpacing: 3,
    color: P.gris, marginBottom: 10,
  }}>{String(texto).toUpperCase()}</div>
)

const Cifra = ({ v, k, color, ancho }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', width: ancho }}>
    <div style={{ display: 'flex', fontSize: 42, lineHeight: 1.05, color: color || P.blanco }}>{v}</div>
    <div style={{ display: 'flex', fontSize: 18, lineHeight: 1.2, color: P.gris, marginTop: 6 }}>{k}</div>
  </div>
)

/** Línea con flecha de tiza. La flecha es «→» (U+2192) y no «↗»: la primera sí
 *  está en Liberation Sans, la segunda saldría como un hueco. */
const Flecha = ({ texto, color, ancho, mt }: any) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', width: ancho, marginTop: mt }}>
    <div style={{ display: 'flex', width: ANCHO_FLECHA, fontSize: 22, lineHeight: 1.25, color: P.amarillo }}>→</div>
    <div style={{
      display: 'flex', width: ancho - ANCHO_FLECHA, fontSize: TAM_TXT,
      lineHeight: LH_TXT / TAM_TXT, color: color || P.claro,
    }}>{texto}</div>
  </div>
)

const diseno: Diseno = {
  clave: 'pizarra',
  nombre: 'Pizarra de tienda',

  alto: (d: DatosParte) => {
    const A = interior(d)
    const COL = (A - HUECO) / 2
    const lede = plano(partesLede(d))
    const items = tareas(d)

    let h = 2 * MADERA + PAD_TOP + PAD_BOT
    h += 24                                                                  // fecha
    h += 8 + d.a.lineas(`Hola ${d.c.nombre},`, A, TAM_H1) * LH_H1
    h += d.a.lineas(`ayer fue ${d.veredicto.calificacion}`, A, TAM_H1) * LH_H1 + 8 + 5
    h += 16 + d.a.lineas(lede, 900, TAM_LEDE) * LH_LEDE
    h += 22 + altoMarcoCifras(d, extraAyer(d), A)
    h += 18 + altoMarcoCifras(d, extraMes(d), A)
    if (d.palancas.length) h += 18 + altoMarcoLista(d, A)
    if (d.destacada) h += 20 + altoMarcoPalanca(d, d.destacada, A) + 18
    for (let i = 0; i < d.resto.length; i += 2) {
      h += Math.max(
        altoMarcoPalanca(d, d.resto[i], COL),
        d.resto[i + 1] ? altoMarcoPalanca(d, d.resto[i + 1], COL) : 0) + 18
    }
    if (items.length) h += 22 + altoNota(d, items)
    h += 20 + 26                                                             // firma
    return Math.round(h + 24)                                                // colchón: más vale pasarse
  },

  render: (d: DatosParte) => {
    const A = interior(d)
    const COL = (A - HUECO) / 2
    const items = tareas(d)

    const MarcoPalanca = ({ p, ancho }: any) => {
      const est = d.a.estado(p)
      const col = colorDe(est)
      const dentro = dentroDe(ancho)
      return (
        <Marco ancho={ancho} color={est === 'cubierto' ? 'rgba(143,227,136,0.55)' : P.borde}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', height: 34,
          }}>
            <div style={{ display: 'flex', fontSize: ancho > 700 ? 27 : 23, lineHeight: 1.2, color: P.blanco }}>
              {`${d.a.iconoDe(p.nombre)} ${p.nombre}`}
            </div>
            <div style={{ display: 'flex', fontSize: 20, lineHeight: 1.2, color: col }}>{marcador(d, p)}</div>
          </div>
          <div style={{ display: 'flex', marginTop: 10 }}>
            <Frase
              ancho={dentro} tam={TAM_TXT} lh={LH_TXT / TAM_TXT}
              color={P.claro} colorFuerte={P.amarillo}
              partes={partesAyer(d, p)}
            />
          </div>
          <Flecha texto={d.a.textoFalta(p)} color={col} ancho={dentro} mt={12} />
          <div style={{
            display: 'flex', width: dentro, fontSize: TAM_ANIMO,
            lineHeight: LH_ANIMO / TAM_ANIMO, color: P.gris, marginTop: 8,
          }}>{d.a.textoAnimo(p)}</div>
        </Marco>
      )
    }

    return (
      <div style={{
        display: 'flex', width: d.ancho, padding: MADERA, fontFamily: 'Liberation Sans',
        // El marco de madera de la pizarra: un degradado basta, y los degradados
        // son de lo poco que Satori dibuja igual que un navegador.
        backgroundImage: 'linear-gradient(135deg, #7A5A34 0%, #4E3A21 100%)',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', width: d.ancho - 2 * MADERA,
          backgroundColor: P.encerado,
          backgroundImage: 'linear-gradient(150deg, #35423B 0%, #2A3630 45%, #212B26 100%)',
          borderRadius: 6, padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOT}px ${PAD_X}px`,
        }}>
          {/* Cabecera escrita a mano */}
          <div style={{ display: 'flex', height: 24, fontSize: 18, lineHeight: 1.2, letterSpacing: 3, color: P.gris }}>
            {`${d.a.fechaLarga(d.data.fecha).toUpperCase()} · TU PARTE DE AYER`}
          </div>
          <div style={{ display: 'flex', fontSize: TAM_H1, lineHeight: LH_H1 / TAM_H1, color: P.blanco, marginTop: 8 }}>
            {`Hola ${d.c.nombre},`}
          </div>
          <div style={{
            display: 'flex', alignSelf: 'flex-start', fontSize: TAM_H1, lineHeight: LH_H1 / TAM_H1,
            color: P.blanco, paddingBottom: 8, borderBottom: `5px solid ${P.amarillo}`,
          }}>
            {`ayer fue ${d.veredicto.calificacion}`}
          </div>
          <div style={{ display: 'flex', marginTop: 16 }}>
            <Frase
              ancho={900} tam={TAM_LEDE} lh={LH_LEDE / TAM_LEDE}
              color={P.claro} colorFuerte={P.amarillo}
              partes={partesLede(d)}
            />
          </div>

          {/* Lo de ayer */}
          <Marco ancho={A} mt={22}>
            <Rotulo texto="Lo de ayer" />
            <div style={{ display: 'flex', justifyContent: 'space-between', height: ALTO_CIFRA }}>
              <Cifra ancho={dentroDe(A) / 3} v={`${d.c.ayer.ops}`} k={d.c.ayer.ops === 1 ? 'operación' : 'operaciones'} />
              <Cifra ancho={dentroDe(A) / 3} v={d.a.eur0(d.c.ayer.importe)} k="facturado" />
              <Cifra ancho={dentroDe(A) / 3} v={d.a.eur2(d.c.ayer.comision)} k="de comisión" color={P.verde} />
            </div>
            <Flecha texto={extraAyer(d)} ancho={dentroDe(A)} mt={14} />
          </Marco>

          {/* El mes */}
          <Marco ancho={A} color={P.bordeAmarillo} mt={18}>
            <Rotulo texto="El mes" />
            <div style={{ display: 'flex', justifyContent: 'space-between', height: ALTO_CIFRA }}>
              <Cifra ancho={dentroDe(A) / 3} v={`${d.c.mes.ops}`} k="ventas este mes" />
              <Cifra ancho={dentroDe(A) / 3} v={d.a.eur0(d.c.mes.importe)} k="facturado" color={P.amarillo} />
              <Cifra
                ancho={dentroDe(A) / 3} v={d.a.eur2(d.c.mes.comisionTotal)} color={P.verde}
                k={`${d.a.eur2(d.c.mes.consolidada)} firmados · ${d.a.eur2(d.c.mes.pendiente)} pendientes`}
              />
            </div>
            <Flecha texto={extraMes(d)} ancho={dentroDe(A)} mt={14} />
          </Marco>

          {/* Listado rápido: una línea por palanca, en dos columnas */}
          {d.palancas.length > 0 && (
            <Marco ancho={A} mt={18}>
              <Rotulo texto="Cómo van las palancas" />
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', width: dentroDe(A) }}>
                {d.palancas.map(p => {
                  const col = colorDe(d.a.estado(p))
                  return (
                    <div key={p.nombre} style={{
                      display: 'flex', alignItems: 'center',
                      width: (dentroDe(A) - 24) / 2, height: ALTO_FILA,
                    }}>
                      {/* La marca de tiza va como punto de color: un «✔» no está
                          en Liberation Sans y saldría como un hueco. */}
                      <div style={{
                        display: 'flex', width: 14, height: 14, borderRadius: 7,
                        backgroundColor: col, marginRight: 12,
                      }} />
                      <div style={{ display: 'flex', flexGrow: 1, fontSize: 20, lineHeight: 1.2, color: P.tiza }}>
                        {p.nombre}
                      </div>
                      <div style={{ display: 'flex', fontSize: 19, lineHeight: 1.2, color: col }}>
                        {marcador(d, p)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Marco>
          )}

          {/* La palanca con más dinero en juego, a lo ancho */}
          {d.destacada && (
            <div style={{ display: 'flex', marginTop: 20, marginBottom: 18 }}>
              <MarcoPalanca p={d.destacada} ancho={A} />
            </div>
          )}

          {/* Las demás, a dos columnas: Satori no tiene rejillas */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', width: A }}>
            {d.resto.map(p => (
              <div key={p.nombre} style={{ display: 'flex', marginBottom: 18 }}>
                <MarcoPalanca p={p} ancho={COL} />
              </div>
            ))}
          </div>

          {/* El pósit pegado en la esquina de la pizarra */}
          {items.length > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', width: ANCHO_NOTA, marginTop: 22,
              backgroundColor: P.notaFondo, borderRadius: 3, padding: PAD_M,
              boxShadow: '4px 6px 14px rgba(0,0,0,0.35)',
            }}>
              <div style={{
                display: 'flex', height: 24, fontSize: 18, lineHeight: 1.2,
                letterSpacing: 2, color: P.notaEtiqueta,
              }}>
                {`SI HOY SOLO HACES ${items.length === 1 ? 'UNA COSA' : `${items.length} COSAS`}`}
              </div>
              {items.map((p, i) => (
                <div key={p.nombre} style={{ display: 'flex', alignItems: 'flex-start', marginTop: 10 }}>
                  <div style={{
                    display: 'flex', width: 28, fontSize: TAM_TXT,
                    lineHeight: LH_TXT / TAM_TXT, color: P.notaEtiqueta,
                  }}>{`${i + 1}.`}</div>
                  <div style={{
                    display: 'flex', width: ANCHO_NOTA - 2 * PAD_M - 28, fontSize: TAM_TXT,
                    lineHeight: LH_TXT / TAM_TXT, color: P.notaTinta,
                  }}>{textoTarea(d, p)}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', height: 26, marginTop: 20 }}>
            <div style={{ display: 'flex', fontSize: 20, lineHeight: 1.2, color: P.gris }}>Buen día, </div>
            <div style={{
              display: 'flex', fontSize: 20, lineHeight: 1.2, color: P.blanco,
              borderBottom: '2px solid rgba(255,255,255,0.35)',
            }}>el encargado</div>
          </div>
        </div>
      </div>
    )
  },
}

export default diseno
