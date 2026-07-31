import type { DatosParte, Diseno } from '@/lib/partes/tipos'
import { dineroPorCubrir } from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// DISEÑO «MISIONES» (gamer).
//
// Para plantilla joven y competitiva: el mes es una partida. Cada palanca es una
// misión con su recompensa en euros, hay nivel, barra de experiencia, insignias
// y un jefe final con el reto que queda por batir.
//
// El neón del catálogo (sombras de brillo) no existe en Satori, así que se imita
// con colores muy saturados sobre fondo casi negro y con filos de color en el
// borde izquierdo de cada misión. Se ve igual en cualquier buzón porque va como
// imagen.
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  fondo: '#080A16',
  tarjeta: '#0E1030',
  borde: '#2A2560',
  tinta: '#E6E9FF',
  suave: '#B9BEE8',
  tenue: '#9C8FD6',
  cian: '#22D3EE',
  morado: '#A855F7',
  lila: '#A78BFA',
  ambar: '#FDE68A',
  verde: '#6EE7B7',
  rosa: '#FDA4AF',
  pista: '#1A1533',
}

// Filo, chip y barra de cada misión según cómo va la palanca.
const PALETA = {
  cubierto: { filo: '#34D399', chipBg: '#06301F', chipTxt: C.verde, chipBrd: '#047857', barra: 'linear-gradient(90deg,#34D399,#6EE7B7)', premioBg: '#06301F', premioTxt: C.verde },
  medias: { filo: '#A855F7', chipBg: '#3B2A05', chipTxt: C.ambar, chipBrd: '#A16207', barra: 'linear-gradient(90deg,#A855F7,#22D3EE)', premioBg: '#31240A', premioTxt: C.ambar },
  cero: { filo: '#F43F5E', chipBg: '#3B0A18', chipTxt: C.rosa, chipBrd: '#9F1239', barra: 'linear-gradient(90deg,#F43F5E,#FB7185)', premioBg: '#2C0D19', premioTxt: C.rosa },
} as const

const paletaDe = (d: DatosParte, p: any) => PALETA[(d.a.estado(p) as keyof typeof PALETA)] || PALETA.medias

// ── Medidas ─────────────────────────────────────────────────────────────────
// Están sueltas y con nombre porque las usan a la vez el cálculo del alto y el
// dibujo: si se separan, la imagen se corta por abajo.
const LADO = 28
const HUECO = 16
const MS_TITULO = 36
const MS_FIJO = 141 // paddings + barra + márgenes de una tarjeta de misión

/** Ancho útil de texto dentro de una misión (se queda corto a propósito: sobra alto). */
const dentroMision = (ancho: number) => ancho - 48

// ── Cifras derivadas (todas salen de d, ninguna inventada) ──────────────────

const RANGOS = ['Recluta', 'Cazarrecompensas', 'Vendedor Pro', 'Veterano', 'Leyenda']

/** El «nivel» no es un dato del ERP: es sencillamente cuántas misiones lleva cerradas. */
function nivelDe(d: DatosParte) {
  const total = d.palancas.length
  const cubiertas = d.palancas.filter(p => d.a.estado(p) === 'cubierto').length
  const ratio = total > 0 ? cubiertas / total : 0
  const rango = cubiertas === 0 ? RANGOS[0]
    : ratio >= 1 ? RANGOS[4]
    : ratio >= 0.67 ? RANGOS[3]
    : ratio >= 0.34 ? RANGOS[2]
    : RANGOS[1]
  return { total, cubiertas, nivel: cubiertas + 1, rango }
}

/** La barra de experiencia va sobre la palanca con más dinero en juego. */
function datosXP(d: DatosParte) {
  const n = nivelDe(d)
  const p = d.destacada
  if (p && p.objetivo > 0) {
    const pct = Math.min(100, Math.max(0, p.pct))
    const fmt = (v: number) => (p.esImporte ? d.a.eur0(v) : d.a.num(v))
    const pie = p.falta > 0
      ? `${Math.round(p.pct)} % — faltan ${fmt(p.falta)} para subir de nivel`
      : `${Math.round(p.pct)} % — nivel superado: todo lo que venga ahora es botín extra`
    return { etiqueta: `XP DEL MES · ${p.nombre.toUpperCase()}`, marcador: `${fmt(p.llevamos)} / ${fmt(p.objetivo)}`, pct, pie }
  }
  // Sin objetivo en euros la experiencia se mide en misiones cerradas.
  const pct = n.total > 0 ? (n.cubiertas / n.total) * 100 : 0
  return {
    etiqueta: 'XP DEL MES',
    marcador: `${n.cubiertas} / ${n.total} misiones`,
    pct,
    pie: `${Math.round(pct)} % de las misiones del mes completadas`,
  }
}

/** Recompensa de la misión, en euros: lo cobrado si está hecha, lo que hay en juego si no. */
function chipDe(d: DatosParte, p: any) {
  if (d.a.estado(p) === 'cubierto') return `🏆 ${d.a.eur2(p.comision)}`
  // dineroPorCubrir es la MISMA función que usa la pantalla para traducir lo que
  // falta a euros; recalcularla aquí a mano sería inventarse la tarifa.
  const gana = dineroPorCubrir(p, p.falta)
  if (gana > 0) return `+${d.a.eur2(gana)} al completar`
  return p.llevamos > 0 ? 'En marcha' : 'Sin empezar'
}

/** El jefe final: lo que queda por batir en las tres misiones que más pagan. */
function jefeFinal(d: DatosParte) {
  const pendientes = d.palancas.filter(p => p.falta > 0).slice(0, 3)
  if (!pendientes.length) {
    return {
      reto: '¡Jefe final derrotado!',
      recompensa: `Todas las misiones del mes están completas. Botín acumulado: ${d.a.eur2(d.c.mes.comisionTotal)}.`,
    }
  }
  const reto = pendientes.map(p => {
    if (p.esImporte) return `${d.a.eur0(p.falta)} de ${p.nombre}`
    const uds = Math.ceil(p.falta)
    return `${uds} ${d.a.unidad(p.nombre, uds)}`
  }).join('  +  ')
  const botin = pendientes.reduce((s, p) => s + dineroPorCubrir(p, p.falta), 0)
  const recompensa = botin > 0
    ? `Recompensa: ${d.a.eur2(botin)} de comisión. Ahora mismo llevas ${d.a.eur2(d.c.mes.comisionTotal)} de botín este mes.`
    : `Ahora mismo llevas ${d.a.eur2(d.c.mes.comisionTotal)} de botín este mes.`
  return { reto, recompensa }
}

function insigniasDe(d: DatosParte) {
  return d.palancas.map(p => {
    const est = d.a.estado(p)
    const icono = d.a.iconoDe(p.nombre)
    const texto = est === 'cubierto' ? `✅ ${p.nombre}`
      : est === 'cero' ? `${icono} ${p.nombre} · 0`
      : `${icono} ${p.nombre} · ${Math.round(p.pct)} %`
    return { texto, est }
  })
}

// ── Frases con negritas (patrón heredado del diseño original) ───────────────
type Trozo = { t: string; b?: boolean }

/** Los trozos normales se parten por palabras: si no, un trozo largo salta entero
 *  de línea y deja el punto huérfano al principio de la siguiente. */
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

// ── Alto ────────────────────────────────────────────────────────────────────

const altoMision = (d: DatosParte, p: any, ancho: number) => {
  const dentro = dentroMision(ancho)
  const falta = d.a.textoFalta(p)
  return MS_FIJO
    + d.a.lineas(d.a.textoAyer(p), dentro, 20) * 27
    + d.a.lineas(falta, dentro - 30, 20) * 27
    + d.a.lineas(d.a.textoAnimo(p), dentro, 19) * 26
}

const altoCabecera = (d: DatosParte) => {
  const ancho = d.ancho - 56
  const xp = datosXP(d)
  const l1 = d.a.lineas(textoVeredicto(d), ancho, 22)
  const l2 = d.a.lineas(textoBotin(d), ancho, 21)
  return 246 + d.a.lineas(xp.pie, ancho, 19) * 0 + l1 * 30 + l2 * 28
}

const altoInsignias = (d: DatosParte) => {
  const disponible = d.ancho - LADO * 2
  let fila = 0
  let filas = 1
  for (const i of insigniasDe(d)) {
    const w = 34 + i.texto.length * 10 + 8
    if (fila + w > disponible) { filas++; fila = w } else { fila += w }
  }
  return filas * 42
}

const altoJefe = (d: DatosParte) => {
  const j = jefeFinal(d)
  const ancho = d.ancho - LADO * 2 - 44
  return 110 + d.a.lineas(j.reto, ancho, 30) * 40 + d.a.lineas(j.recompensa, ancho, 21) * 28
}

// Textos largos de la cabecera: se calculan igual para medir y para dibujar.
const textoVeredicto = (d: DatosParte) => {
  const c = d.c
  return `${d.a.dia.El} fue ${d.veredicto.calificacion}: ${c.ayer.ops} operaciones`
    + (c.ayer.importe > 0 ? ` por ${d.a.eur0(c.ayer.importe)}` : '')
    + (c.ayer.ops > 0 && c.posicionDia > 0 ? `, ${c.posicionDia}.º del equipo` : '')
    + (c.ayer.ops > 0 && d.data.equipo.media > 0
      ? ` y un ${d.a.num(Math.abs(d.pctMedia))} % ${d.pctMedia >= 0 ? 'por encima' : 'por debajo'} de la media`
      : '')
    + `. ${d.veredicto.cierre}`
}

const textoBotin = (d: DatosParte) =>
  `Botín ${d.a.dia.del}: ${d.a.eur2(d.c.ayer.comision)} · botín del mes: ${d.a.eur2(d.c.mes.comisionTotal)} · ${d.c.mes.ops} ventas en la partida.`

// ── Dibujo ──────────────────────────────────────────────────────────────────

const Titulo = ({ texto }: { texto: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', margin: '26px 0 12px 0' }}>
    <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 4, color: C.cian }}>{texto}</div>
    <div style={{
      display: 'flex', flexGrow: 1, height: 2, marginLeft: 14,
      backgroundImage: 'linear-gradient(90deg,#22D3EE,rgba(34,211,238,0))',
    }} />
  </div>
)

const Mision = ({ d, p, ancho }: any) => {
  const pal = paletaDe(d, p)
  const est = d.a.estado(p)
  const delDia = d.c.ayer.porPalanca.find((x: any) => x.palanca === p.nombre)
  const pct = Math.min(100, Math.max(0, p.pct))
  const dentro = ancho - 44
  const tamTitulo = ancho > 700 ? 27 : 22
  return (
    <div style={{
      display: 'flex', width: ancho, backgroundColor: C.tarjeta, border: `1px solid ${C.borde}`,
      borderRadius: 12, overflow: 'hidden', marginBottom: 12,
    }}>
      {/* El filo de color es un hijo y no un borderLeft: Satori pinta antes un
          bloque de color que un borde de un solo lado. */}
      <div style={{ display: 'flex', width: 6, backgroundColor: pal.filo }} />
      <div style={{ display: 'flex', flexDirection: 'column', width: ancho - 8, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: MS_TITULO }}>
          <div style={{ display: 'flex', fontSize: tamTitulo, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
            {`${d.a.iconoDe(p.nombre)} ${p.nombre}`}
          </div>
          <div style={{
            display: 'flex', fontSize: 18, fontWeight: 700, color: pal.chipTxt, backgroundColor: pal.chipBg,
            border: `1px solid ${pal.chipBrd}`, borderRadius: 7, padding: '3px 10px', whiteSpace: 'nowrap', marginLeft: 12,
          }}>{chipDe(d, p)}</div>
        </div>
        <div style={{ display: 'flex', marginTop: 8 }}>
          <Frase
            ancho={dentro} tam={20} color={C.suave} colorFuerte="#fff"
            partes={[
              ...(delDia && delDia.uds > 0
                ? [{ t: `${d.a.dia.El} sumaste ` },
                   { t: p.esImporte ? d.a.eur0(delDia.importe) : `${delDia.uds} ${d.a.unidad(p.nombre, delDia.uds)}`, b: true },
                   { t: '. ' }]
                : [{ t: `${d.a.dia.El}, ` }, { t: 'ninguna', b: true }, { t: '. ' }]),
              { t: 'Llevas ' },
              { t: p.esImporte ? d.a.eur2(p.llevamos) : d.a.num(p.llevamos), b: true },
              ...(p.objetivo > 0
                ? [{ t: ' de ' }, { t: p.esImporte ? d.a.eur0(p.objetivo) : d.a.num(p.objetivo) }]
                : []),
              { t: '.' },
            ]}
          />
        </div>
        <div style={{ display: 'flex', height: 10, backgroundColor: C.pista, borderRadius: 5, marginTop: 10 }}>
          <div style={{
            display: 'flex', width: `${Math.max(est === 'cero' ? 0 : 2, pct)}%`, height: 10,
            borderRadius: 5, backgroundImage: pal.barra,
          }} />
        </div>
        <div style={{
          display: 'flex', fontSize: 20, fontWeight: 700, color: pal.premioTxt, backgroundColor: pal.premioBg,
          borderRadius: 8, padding: '9px 13px', marginTop: 10, width: dentro,
        }}>{d.a.textoFalta(p)}</div>
        <div style={{ display: 'flex', fontSize: 19, fontWeight: 700, color: C.cian, marginTop: 9, width: dentro }}>
          {`⚡ ${d.a.textoAnimo(p)}`}
        </div>
      </div>
    </div>
  )
}

const diseno: Diseno = {
  clave: 'misiones',
  nombre: 'Misiones (gamer)',

  alto: (d: DatosParte) => {
    const anchoMitad = (d.ancho - LADO * 2 - HUECO) / 2
    let resto = 0
    for (let i = 0; i < d.resto.length; i += 2) {
      resto += Math.max(
        altoMision(d, d.resto[i], anchoMitad),
        d.resto[i + 1] ? altoMision(d, d.resto[i + 1], anchoMitad) : 0)
    }
    return Math.round(
      altoCabecera(d)
      + 64 + (d.destacada ? altoMision(d, d.destacada, d.ancho - LADO * 2) : 0) + resto
      + 64 + altoInsignias(d)
      + altoJefe(d)
      + 30
      + 24, // colchón: más vale sobrar que cortar la imagen
    )
  },

  render: (d: DatosParte) => {
    const c = d.c
    const n = nivelDe(d)
    const xp = datosXP(d)
    const jefe = jefeFinal(d)
    const anchoTexto = d.ancho - 56
    const anchoMitad = (d.ancho - LADO * 2 - HUECO) / 2
    const inicial = String(c.nombre || '?').trim().charAt(0).toUpperCase()

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', width: d.ancho, height: diseno.alto(d),
        backgroundColor: C.fondo, fontFamily: 'Liberation Sans',
      }}>
        {/* Cabecera: el resplandor morado del catálogo, en degradado lineal
            porque los radiales de Satori no son de fiar. */}
        <div style={{
          display: 'flex', flexDirection: 'column', padding: '26px 28px', borderBottom: '1px solid #251E4A',
          backgroundImage: 'linear-gradient(165deg,#3B1D8A 0%,#1B1240 52%,#0B0C22 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 72 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', width: 68, height: 68,
              borderRadius: 18, marginRight: 16, fontSize: 34, fontWeight: 700, color: '#0E0A24',
              backgroundImage: 'linear-gradient(140deg,#7C3AED,#22D3EE)',
            }}>{inicial}</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: '#fff' }}>{c.nombre}</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 3, color: C.lila }}>
                {`NIVEL ${n.nivel} · ${n.rango.toUpperCase()} · ${n.cubiertas} DE ${n.total} MISIONES`}
              </div>
            </div>
            {(c.rachaDias || 0) >= 2 && (
              <div style={{
                display: 'flex', marginLeft: 'auto', backgroundColor: '#2A1440', border: '1px solid #7C3AED',
                borderRadius: 10, padding: '8px 14px', fontSize: 20, fontWeight: 700, color: C.ambar,
              }}>{`🔥 Racha ${c.rachaDias} días`}</div>
            )}
          </div>

          {/* Barra de experiencia. El texto va DEBAJO y no dentro: superponerlo
              exigiría posición absoluta, que en Satori se descoloca. */}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: anchoTexto, marginTop: 18 }}>
            <div style={{ display: 'flex', fontSize: 17, fontWeight: 700, letterSpacing: 2, color: C.tenue }}>{xp.etiqueta}</div>
            <div style={{ display: 'flex', fontSize: 17, fontWeight: 700, letterSpacing: 2, color: C.tenue }}>{xp.marcador}</div>
          </div>
          <div style={{
            display: 'flex', width: anchoTexto, height: 16, marginTop: 8, borderRadius: 8,
            backgroundColor: C.pista, border: '1px solid #34285F',
          }}>
            <div style={{
              display: 'flex', width: `${Math.max(1, xp.pct)}%`, height: 14, borderRadius: 7,
              backgroundImage: 'linear-gradient(90deg,#22D3EE,#A855F7)',
            }} />
          </div>
          <div style={{ display: 'flex', fontSize: 19, fontWeight: 700, color: C.ambar, marginTop: 8 }}>{xp.pie}</div>

          <div style={{ display: 'flex', marginTop: 16 }}>
            <Frase
              ancho={anchoTexto} tam={22} color="#C7CCF5" colorFuerte="#fff"
              partes={[
                { t: `${d.a.dia.El} fue ` }, { t: d.veredicto.calificacion, b: true }, { t: ': ' },
                { t: `${c.ayer.ops} ${c.ayer.ops === 1 ? 'operación' : 'operaciones'}`, b: true },
                c.ayer.importe > 0 ? { t: ' por ' } : null,
                c.ayer.importe > 0 ? { t: d.a.eur0(c.ayer.importe), b: true } : null,
                c.ayer.ops > 0 && c.posicionDia > 0 ? { t: ', ' } : null,
                c.ayer.ops > 0 && c.posicionDia > 0 ? { t: `${c.posicionDia}.º del equipo`, b: true } : null,
                c.ayer.ops > 0 && d.data.equipo.media > 0 ? { t: ' y un ' } : null,
                c.ayer.ops > 0 && d.data.equipo.media > 0 ? { t: `${d.a.num(Math.abs(d.pctMedia))} %`, b: true } : null,
                c.ayer.ops > 0 && d.data.equipo.media > 0
                  ? { t: d.pctMedia >= 0 ? ' por encima de la media' : ' por debajo de la media' } : null,
                { t: `. ${d.veredicto.cierre}` },
              ]}
            />
          </div>
          <div style={{ display: 'flex', marginTop: 8 }}>
            <Frase
              ancho={anchoTexto} tam={21} color={C.tenue} colorFuerte={C.verde}
              partes={[
                { t: `Botín ${d.a.dia.del}: ` }, { t: d.a.eur2(c.ayer.comision), b: true },
                { t: ' · botín del mes: ' }, { t: d.a.eur2(c.mes.comisionTotal), b: true },
                { t: ' · ' }, { t: `${c.mes.ops}`, b: true }, { t: ' ventas en la partida.' },
              ]}
            />
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: `0 ${LADO}px` }}>
          <Titulo texto="MISIONES ACTIVAS" />
          {d.destacada && <Mision d={d} p={d.destacada} ancho={d.ancho - LADO * 2} />}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {d.resto.map(p => <Mision key={p.nombre} d={d} p={p} ancho={anchoMitad} />)}
          </div>

          <Titulo texto="INSIGNIAS" />
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {insigniasDe(d).map((i, k) => (
              <div key={k} style={{
                display: 'flex', fontSize: 18, fontWeight: 700, borderRadius: 8, padding: '7px 12px',
                marginRight: 8, marginBottom: 8, backgroundColor: C.tarjeta,
                border: `1px solid ${i.est === 'cubierto' ? '#34D399' : C.borde}`,
                color: i.est === 'cubierto' ? C.verde : i.est === 'cero' ? '#5B5686' : '#C7CCF5',
              }}>{i.texto}</div>
            ))}
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', marginTop: 22, padding: 22, borderRadius: 16,
            border: '1px solid #A855F7', backgroundImage: 'linear-gradient(135deg,#4C1D95,#831843)',
          }}>
            <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, letterSpacing: 4, color: C.ambar }}>
              JEFE FINAL DEL MES
            </div>
            <div style={{
              display: 'flex', fontSize: 30, fontWeight: 700, color: '#fff', marginTop: 10,
              width: d.ancho - LADO * 2 - 44, lineHeight: 1.3,
            }}>{jefe.reto}</div>
            <div style={{
              display: 'flex', fontSize: 21, color: '#E9D5FF', marginTop: 8,
              width: d.ancho - LADO * 2 - 44, lineHeight: 1.3,
            }}>{jefe.recompensa}</div>
          </div>
        </div>
      </div>
    )
  },
}

export default diseno
