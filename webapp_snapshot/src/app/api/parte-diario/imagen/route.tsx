import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'
import { GET as parteDiarioJSON } from '../route'
import type { DatosParte, Diseno } from '@/lib/partes/tipos'
import appleglass from './disenos/appleglass'
import marcador from './disenos/marcador'
import misiones from './disenos/misiones'
import revista from './disenos/revista'
import pizarra from './disenos/pizarra'

/** Los diseños que se pueden pedir con ?diseno=. El original va aparte, abajo. */
const DISENOS: Record<string, Diseno> = {
  appleglass, marcador, misiones, revista, pizarra,
}

/** Para el selector del ERP: qué diseños hay y cómo se llaman. */
export const CATALOGO = [
  { clave: 'original', nombre: '★ El original' },
  ...Object.values(DISENOS).map(x => ({ clave: x.clave, nombre: x.nombre })),
]
import { estadoDePalanca, fraseAnimo, traducirFalta, unidadDePalanca, veredictoDelDia } from '@/lib/parteDiario'
import type { ParteDiarioComercial, ParteDiarioResponse } from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// EL PARTE DIARIO, COMO IMAGEN.
//
// Por qué: el parte vive en el buzón de cada comercial, y el correo destroza el
// diseño —Outlook dibuja con el motor de Word, Gmail tira las variables de
// color, el modo oscuro del móvil invierte los fondos—. Una imagen se ve
// EXACTAMENTE igual en todas partes, así que el parte va como imagen incrustada
// en el cuerpo del correo (que es lo que el dueño ya hacía a mano copiando y
// pegando un PNG, y quedaba perfecto).
//
// Se dibuja con next/og (Satori), que va DENTRO del propio programa: no hace
// falta instalar ningún navegador en el servidor.
//
// Ojo con Satori: solo entiende flexbox (nada de rejillas), no hereda estilos y
// necesita el fichero de la fuente —no usa las del sistema—. Por eso las
// Liberation Sans viven en public/fonts.
//
// GET /api/parte-diario/imagen?seller=Carlos&fecha=YYYY-MM-DD&periodKey=YYYY_MM
// Auth: cabecera x-prv-secret (el ERP) o la sesión del navegador.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ANCHO = 1180

// Paleta: la versión OSCURA del diseño original, que es la que el dueño usa.
const C = {
  fondo: '#0B1524',
  tarjeta: '#132239',
  borde: '#22354F',
  tinta: '#EAF2FB',
  suave: '#9FB6D0',
  tenue: '#7089A6',
  ok: '#34D399', okBg: '#12332A',
  falta: '#FBBF24', faltaBg: '#3A2A12',
  cero: '#94A3B8', ceroBg: '#1B2A3F',
}

// Formato español a mano. No se usa toLocaleString con decimales porque en el
// servidor salía SIN separador de miles («1830,30 €» en vez de «1.830,30 €»),
// y quedaba incoherente con los importes redondos, que sí lo llevaban.
const _miles = (entero: string) => entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const eur0 = (v: number) => _miles(String(Math.round(Number(v) || 0))) + ' €'
const eur2 = (v: number) => {
  const n = Number(v) || 0
  const signo = n < 0 ? '-' : ''
  const [ent, dec] = Math.abs(n).toFixed(2).split('.')
  return `${signo}${_miles(ent)},${dec} €`
}
const num = (v: number) => {
  const n = Number(v) || 0
  const r = Math.round(n * 10) / 10
  const [ent, dec] = String(Math.abs(r)).split('.')
  return (n < 0 ? '-' : '') + _miles(ent) + (dec ? ',' + dec : '')
}

const fechaLarga = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const t = new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const ICONOS: { clave: string; icono: string }[] = [
  { clave: 'dispositivo', icono: '📱' }, { clave: 'convergente', icono: '🔗' },
  { clave: 'baf', icono: '🌐' }, { clave: 'arpu', icono: '📈' },
  { clave: 'futbol', icono: '⚽' }, { clave: 'fttr', icono: '🏠' },
  { clave: 'mpa', icono: '🚨' }, { clave: 'alarma', icono: '🚨' },
  { clave: 'swap', icono: '🔄' }, { clave: 'seguro', icono: '🛡️' },
  { clave: 'tv', icono: '📺' }, { clave: 'o2', icono: '🟦' },
]
const iconoDe = (nombre: string) => {
  const n = String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return (ICONOS.find(i => n.includes(i.clave)) || { icono: '🎯' }).icono
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const seller = (searchParams.get('seller') || '').trim()
  const fecha = (searchParams.get('fecha') || '').trim()
  const periodKey = (searchParams.get('periodKey') || '').trim()

  // Los datos salen del MISMO endpoint que la pantalla, no de una copia: así la
  // imagen y lo que ve en el navegador no pueden decir cifras distintas.
  const qs = new URLSearchParams()
  if (fecha) qs.set('fecha', fecha)
  if (periodKey) qs.set('periodKey', periodKey)
  if (seller) qs.set('seller', seller)

  // Se llama a la MISMA función que atiende /api/parte-diario, aquí dentro, sin
  // salir a la red.
  //
  // Antes esto era un fetch a la propia dirección pública. En local iba, pero
  // en producción el contenedor no puede llamarse a sí mismo por su dominio y
  // el fetch reventaba: la imagen respondía 500 y no había forma de verlo hasta
  // desplegar. Llamando a la función se acabó el problema, y además sigue
  // habiendo UNA sola implementación de las cifras.
  const secreto = request.headers.get('x-prv-secret')
  const cabeceras: Record<string, string> = secreto
    ? { 'x-prv-secret': secreto }
    : { cookie: request.headers.get('cookie') || '' }
  const res = await parteDiarioJSON(
    new Request(`${origin}/api/parte-diario?${qs.toString()}`, { headers: cabeceras }))
  if (!res.ok) {
    return new Response('No autorizado o sin datos', { status: res.status })
  }
  const data: ParteDiarioResponse = await res.json()
  const c: ParteDiarioComercial | undefined = data.comerciales?.[0]
  if (!c) return new Response('Sin parte para ese comercial', { status: 404 })

  const [regular, bold] = await Promise.all([
    readFile(path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Regular.ttf')),
    readFile(path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Bold.ttf')),
  ])

  const veredicto = veredictoDelDia(c.nombre, data.fecha, c.ayer.ops, c.ayer.importe, data.equipo.media)
  const pctMedia = data.equipo.media > 0 ? (c.ayer.importe / data.equipo.media - 1) * 100 : 0
  const principal = c.ritmo.palanca ? c.palancas.find(p => p.nombre === c.ritmo.palanca) : undefined

  // Orden: primero lo que está a medias, luego lo cubierto y al final lo que ni
  // se ha estrenado, que es donde queda dinero suelto.
  const orden: Record<string, number> = { medias: 0, cubierto: 1, cero: 2 }
  const palancas = [...c.palancas].sort(
    (a, b) => orden[estadoDePalanca(a)] - orden[estadoDePalanca(b)] || b.comision - a.comision)
  const destacada = principal || palancas[0]
  const resto = palancas.filter(p => p.nombre !== destacada?.nombre)

  // ── Cuánto va a medir de alto ────────────────────────────────────────────
  // Hay que dárselo hecho: si se deja que lo calcule solo se queda corto y
  // recorta la última fila, y si se pone un número a ojo, los textos largos
  // parten en dos líneas y se salen. Así que se cuenta, para cada frase, en
  // cuántas líneas va a partir según su longitud y el ancho de su tarjeta.
  const lineas = (texto: string, anchoPx: number, tam: number) => {
    const porLinea = Math.max(12, Math.floor(anchoPx / (tam * 0.5)))
    return Math.max(1, Math.ceil(String(texto || '').length / porLinea))
  }

  const textoAyer = (p: any) => {
    const d = c.ayer.porPalanca.find((x: any) => x.palanca === p.nombre)
    const ini = d && d.uds > 0
      ? (p.esImporte ? `Ayer sumaste ${eur0(d.importe)}. ` : `Ayer sumaste ${d.uds} ${unidadDePalanca(p.nombre, d.uds)}. `)
      : 'Ayer, ninguna. '
    return ini + `Llevas ${p.esImporte ? eur2(p.llevamos) : num(p.llevamos)}${p.objetivo > 0 ? ` de ${p.esImporte ? eur0(p.objetivo) : num(p.objetivo)}` : ''}.`
  }

  const altoTarjeta = (p: any, ancho: number) => {
    const dentro = ancho - 44
    return 18 + 34
      + 10 + lineas(textoAyer(p), dentro, 19) * 25
      + 12 + 9
      + 12 + lineas(traducirFalta(p, c.ritmo.diasLaborablesRestantes), dentro, 19) * 25 + 20
      + 10 + lineas(fraseAnimo(estadoDePalanca(p), c.nombre, data.fecha, p.nombre), dentro, 18) * 24
      + 18 + 16
  }

  const anchoDest = ANCHO - 48
  const anchoMitad = (ANCHO - 48 - 16) / 2
  let altoResto = 0
  for (let i = 0; i < resto.length; i += 2) {
    altoResto += Math.max(
      altoTarjeta(resto[i], anchoMitad),
      resto[i + 1] ? altoTarjeta(resto[i + 1], anchoMitad) : 0)
  }
  const textoVeredicto = `Ayer fue ${veredicto.calificacion}: cerraste ${c.ayer.ops} operaciones`
    + (c.ayer.importe > 0 ? ` por ${eur0(c.ayer.importe)}` : '') + `. ${veredicto.cierre}`
  const altoHero = 26 + 62 + 14 + lineas(textoVeredicto, ANCHO - 108, 25) * 33 + 16 + 46 + 26
  const alto = Math.round(
    24 + altoHero + 20 + 152 + 22 + 32 + 14
    + (destacada ? altoTarjeta(destacada, anchoDest) : 0) + altoResto + 24)

  // ── ¿Otro diseño? ────────────────────────────────────────────────────────
  // El original se dibuja aquí abajo tal cual; los demás viven cada uno en su
  // fichero de ./disenos y reciben las cifras ya masticadas, para que ninguno
  // pueda inventarse un número por su cuenta.
  const otro = DISENOS[String(searchParams.get('diseno') || '').toLowerCase()]
  if (otro) {
    const d: DatosParte = {
      c, data, veredicto, palancas, destacada, resto, pctMedia, ancho: ANCHO,
      a: {
        eur0, eur2, num, fechaLarga, iconoDe, lineas,
        textoAyer,
        textoFalta: (p: any) => traducirFalta(p, c.ritmo.diasLaborablesRestantes),
        textoAnimo: (p: any) => fraseAnimo(estadoDePalanca(p), c.nombre, data.fecha, p.nombre),
        estado: (p: any) => estadoDePalanca(p),
        unidad: unidadDePalanca,
      },
    }
    return new ImageResponse(otro.render(d), {
      width: ANCHO,
      height: Math.round(otro.alto(d)),
      emoji: 'twemoji',
      fonts: [
        { name: 'Liberation Sans', data: regular, weight: 400, style: 'normal' },
        { name: 'Liberation Sans', data: bold, weight: 700, style: 'normal' },
      ],
    })
  }

  /**
   * Frase con partes en NEGRITA.
   *
   * Es lo que hace que la vista salte sola a los números («cerraste **8
   * operaciones** por **2.418 €**»). Se le pasan trozos: los `strong` van en
   * negrita y en color fuerte, el resto normal.
   *
   * OJO Satori: un recuadro con más de un hijo TIENE que declarar
   * «display: flex», y como cada trozo es un hijo, hace falta `flexWrap` para
   * que la frase pueda partir en varias líneas.
   */
  type Trozo = { t: string; b?: boolean }

  /**
   * Los trozos normales se parten POR PALABRAS antes de dibujarlos.
   *
   * Cada trozo es una pieza suelta y se coloca entera o salta de línea: un
   * trozo largo se iba abajo completo y dejaba el punto huérfano al principio
   * de la línea siguiente («… por 240 €» / «. Sigue así…»). Partido en
   * palabras, la frase fluye como texto normal. Las negritas se dejan enteras
   * porque son cortas y no interesa que se rompa un importe por la mitad.
   */
  const porPalabras = (partes: Trozo[]): Trozo[] => {
    const fuera: Trozo[] = []
    for (const p of partes.filter(Boolean) as Trozo[]) {
      if (!p.t) continue
      if (p.b) { fuera.push(p); continue }
      for (const trozo of (String(p.t).match(/\S+\s*|\s+/g) || [])) {
        fuera.push({ t: trozo })
      }
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
          display: 'flex',
          fontSize: tam,
          fontWeight: p.b ? 700 : 400,
          color: p.b ? (colorFuerte || color) : color,
          // «pre-wrap» y no «pre»: hay que conservar los espacios de los
          // extremos, pero SIN impedir que el trozo parta. Con «pre», un trozo
          // largo saltaba entero a la línea siguiente y dejaba el punto
          // huérfano: «… por 240 €» / «. Sigue así y te sale un buen mes.»
          whiteSpace: 'pre-wrap',
        }}>{p.t}</div>
      ))}
    </div>
  )
  const Chip = ({ texto }: { texto: string }) => (
    <div style={{
      display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)',
      border: '1px solid rgba(255,255,255,0.28)', borderRadius: 999,
      padding: '8px 18px', fontSize: 21, fontWeight: 700, color: '#fff', marginRight: 12,
    }}>{texto}</div>
  )

  const Mini = ({ et, valor, sub, color }: any) => (
    <div style={{
      display: 'flex', flexDirection: 'column', width: (ANCHO - 96 - 32) / 3,
      backgroundColor: C.tarjeta, border: `1px solid ${C.borde}`, borderRadius: 16, padding: '18px 22px',
    }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.tenue, letterSpacing: 1 }}>{et}</div>
      <div style={{ fontSize: 40, fontWeight: 700, color: color || C.tinta, marginTop: 4 }}>{valor}</div>
      <div style={{ fontSize: 18, color: C.suave, marginTop: 2 }}>{sub}</div>
    </div>
  )

  const Palanca = ({ p, ancho }: any) => {
    const est = estadoDePalanca(p)
    const delDia = c.ayer.porPalanca.find((x: any) => x.palanca === p.nombre)
    const pct = Math.min(100, Math.max(0, p.pct))
    const colorEstado = est === 'cubierto' ? C.ok : est === 'cero' ? C.cero : C.falta
    const fondoEstado = est === 'cubierto' ? C.okBg : est === 'cero' ? C.ceroBg : C.faltaBg
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', width: ancho, backgroundColor: C.tarjeta,
        border: `1px solid ${C.borde}`, borderRadius: 16, padding: '18px 22px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 25, fontWeight: 700, color: C.tinta }}>
            {`${iconoDe(p.nombre)} ${p.nombre}`}
          </div>
          <div style={{
            display: 'flex', fontSize: 17, fontWeight: 700, color: colorEstado,
            backgroundColor: fondoEstado, borderRadius: 999, padding: '5px 14px',
          }}>
            {est === 'cubierto' ? '¡Objetivo cubierto!' : est === 'cero' ? 'Sin estrenar' : `${Math.round(p.pct)} % del objetivo`}
          </div>
        </div>
        {/* En las palancas que se miden en euros lo que importa es el importe,
            no el número de líneas: «Ayer sumaste 14 140 €» no se entiende. */}
        <div style={{ display: 'flex', marginTop: 10 }}>
          <Frase
            ancho={ancho - 44} tam={19} color={C.suave} colorFuerte={C.tinta}
            partes={[
              ...(delDia && delDia.uds > 0
                ? [{ t: 'Ayer sumaste ' },
                   { t: p.esImporte ? eur0(delDia.importe) : `${delDia.uds} ${unidadDePalanca(p.nombre, delDia.uds)}`, b: true },
                   { t: '. ' }]
                : [{ t: 'Ayer, ' }, { t: 'ninguna', b: true }, { t: '. ' }]),
              { t: 'Llevas ' },
              { t: p.esImporte ? eur2(p.llevamos) : num(p.llevamos), b: true },
              ...(p.objetivo > 0
                ? [{ t: ' de ' }, { t: p.esImporte ? eur0(p.objetivo) : num(p.objetivo) }]
                : []),
              { t: '.' },
            ]}
          />
        </div>
        <div style={{ display: 'flex', height: 9, backgroundColor: C.ceroBg, borderRadius: 5, marginTop: 12 }}>
          <div style={{
            display: 'flex', width: `${pct}%`, height: 9, borderRadius: 5,
            backgroundImage: est === 'cubierto'
              ? 'linear-gradient(135deg,#34D399,#059669)'
              : 'linear-gradient(135deg,#0052CC,#0747A6)',
          }} />
        </div>
        <div style={{
          display: 'flex', fontSize: 19, fontWeight: 700, color: colorEstado, backgroundColor: fondoEstado,
          borderRadius: 10, padding: '10px 14px', marginTop: 12,
        }}>
          {traducirFalta(p, c.ritmo.diasLaborablesRestantes)}
        </div>
        <div style={{ display: 'flex', fontSize: 18, color: C.suave, marginTop: 10 }}>
          {fraseAnimo(est, c.nombre, data.fecha, p.nombre)}
        </div>
      </div>
    )
  }

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column', width: ANCHO, height: alto,
        backgroundColor: C.fondo, padding: 24, fontFamily: 'Liberation Sans',
      }}>
        {/* Cabecera */}
        <div style={{
          display: 'flex', flexDirection: 'column', borderRadius: 20, padding: '26px 30px',
          backgroundImage: 'linear-gradient(135deg, #0052CC 0%, #0747A6 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 62, height: 62, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)',
              fontSize: 32, marginRight: 18,
            }}>👋</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'rgba(255,255,255,0.78)', letterSpacing: 2 }}>
                {`${fechaLarga(data.fecha).toUpperCase()} · TU PARTE DE AYER`}
              </div>
              <div style={{ fontSize: 44, fontWeight: 700, color: '#fff' }}>{`Hola ${c.nombre}`}</div>
            </div>
          </div>
          <div style={{ display: 'flex', marginTop: 14 }}>
            <Frase
              ancho={ANCHO - 108} tam={25} color="rgba(255,255,255,0.92)" colorFuerte="#fff"
              partes={[
                { t: 'Ayer fue ' },
                { t: veredicto.calificacion, b: true },
                { t: ': cerraste ' },
                { t: `${c.ayer.ops} ${c.ayer.ops === 1 ? 'operación' : 'operaciones'}`, b: true },
                c.ayer.importe > 0 ? { t: ' por ' } : null,
                c.ayer.importe > 0 ? { t: eur0(c.ayer.importe), b: true } : null,
                { t: `. ${veredicto.cierre}` },
              ].filter(Boolean)}
            />
          </div>
          <div style={{ display: 'flex', marginTop: 16 }}>
            {c.ayer.ops > 0 && c.posicionDia > 0 && (
              <Chip texto={`${c.posicionDia === 1 ? '🥇' : c.posicionDia === 2 ? '🥈' : c.posicionDia === 3 ? '🥉' : '📊'} ${c.posicionDia}.º del equipo ayer`} />
            )}
            {data.equipo.media > 0 && c.ayer.ops > 0 && (
              <Chip texto={`📈 Un ${num(Math.abs(pctMedia))} % ${pctMedia >= 0 ? 'por encima' : 'por debajo'} de la media`} />
            )}
            <Chip texto={`💶 ${eur2(c.mes.comisionTotal)} este mes`} />
            {(c.rachaDias || 0) >= 2 && (
              <Chip texto={`🔥 ${c.rachaDias} días seguidos vendiendo`} />
            )}
          </div>
        </div>

        {/* Tres cifras de ayer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <Mini et="AYER VENDISTE" valor={`${c.ayer.ops}`} sub={`El equipo hizo ${data.equipo.ops}`} />
          <Mini et="VALOR DE AYER" valor={eur0(c.ayer.importe)} sub={`Media del equipo: ${eur0(data.equipo.media)}`} />
          <Mini et="COMISIÓN GANADA AYER" valor={eur2(c.ayer.comision)} sub={`Llevas ${eur2(c.mes.comisionTotal)} este mes`} color={C.ok} />
        </div>

        <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: C.tenue, letterSpacing: 2, margin: '22px 0 14px 0' }}>
          CÓMO VAS EN CADA PALANCA
        </div>

        {destacada && <Palanca p={destacada} ancho={ANCHO - 48} />}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {resto.map(p => <Palanca key={p.nombre} p={p} ancho={(ANCHO - 48 - 16) / 2} />)}
        </div>
      </div>
    ),
    {
      width: ANCHO,
      height: alto,
      // Los emojis los pone Satori pidiéndolos fuera; si el servidor no llegara,
      // el resto de la imagen sale igual.
      emoji: 'twemoji',
      fonts: [
        { name: 'Liberation Sans', data: regular, weight: 400, style: 'normal' },
        { name: 'Liberation Sans', data: bold, weight: 700, style: 'normal' },
      ],
    },
  )
}
