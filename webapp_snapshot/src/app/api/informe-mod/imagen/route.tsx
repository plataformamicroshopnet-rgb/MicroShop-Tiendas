import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'
import { GET as informeJSON } from '../route'

// ─────────────────────────────────────────────────────────────────────────────
// EL INFORME MOD DIARIO, COMO IMAGEN (PNG vertical, ancho 1400).
//
// Mismo planteamiento que el parte diario: el correo destroza el HTML, una
// imagen se ve igual en todas partes. Se dibuja con next/og (Satori).
//
// Los datos salen de la MISMA función que atiende /api/informe-mod (se llama
// aquí dentro, sin salir a la red — en producción el contenedor no puede
// llamarse a sí mismo por su dominio): una sola implementación de las cifras.
//
// Tres bloques apilados, con la pinta de sus pantallas (fondo claro, líneas
// finas, cabeceras azules):
//   1) MOD — tabla comparativa año anterior / mes actual / estimación.
//   2) Seguimiento de Tramitación — la matriz por tienda + filas resumen + O2.
//   3) Resumen de Métricas MOD — la tabla de grupos con Real y Proyección.
//
// Ojo con Satori: SOLO flexbox (nada de <table>), no hereda estilos y la
// fuente se carga de public/fonts (Liberation Sans, como el parte).
//
// GET /api/informe-mod/imagen — Auth: x-prv-secret (el ERP) o sesión.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ANCHO = 1400
const PAD = 24
const INTERIOR = ANCHO - PAD * 2   // 1352

// Paleta clara, calcada de las pantallas del seguimiento de ventas.
const C = {
  fondo: '#F1F5F9',
  card: '#FFFFFF',
  borde: '#E2E8F0',
  tinta: '#0F172A',
  gris: '#64748B',
  azulCab: '#0EA5E9',      // cabeceras de tabla de las 3 pantallas
  azulOscuro: '#0284C7',   // fila de estimación de la MOD
  verdeFila: '#84CC16',    // fila del mes actual de la MOD
  rosa: '#EC4899',         // columna Tram
  cian: '#00ADEF',         // Obj2 (uds. de dispositivos)
  verde: '#10B981',
  rojo: '#EF4444',
  celeste: '#E0F2FE',      // fila "Necesitamos Hoy Deficit"
  grisFila: '#F8FAFC',
  objBg: '#F3F4F6',        // celdas Obj
  proyBg: '#E5E7EB',       // celdas Proy
}

// Formato español a mano (mismo motivo que el parte diario: toLocaleString en
// el servidor perdía el separador de miles).
const _miles = (e: string) => e.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const num2 = (v: number) => {
  const n = Number(v) || 0
  const s = n < 0 ? '-' : ''
  const [e, d] = Math.abs(n).toFixed(2).split('.')
  return `${s}${_miles(e)},${d}`
}
const eur2 = (v: number) => num2(v) + ' €'
const intES = (v: number) => {
  const n = Math.round(Number(v) || 0)
  return (n < 0 ? '-' : '') + _miles(String(Math.abs(n)))
}
// formatNum del Seguimiento de Tramitación, tal cual la página (sin miles en
// las unidades, con miles en los euros).
const fmtNum = (val: number, isCurrency = false) => {
  if (!val) return isCurrency ? '0 €' : '0'
  return isCurrency ? intES(val) + ' €' : String(Math.round(val))
}
const fmtPct = (val: number) => {
  if (!val || isNaN(val) || !isFinite(val)) return '0%'
  return Math.round(val * 100) + '%'
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url)

  const secreto = request.headers.get('x-prv-secret')
  const cabeceras: Record<string, string> = secreto
    ? { 'x-prv-secret': secreto }
    : { cookie: request.headers.get('cookie') || '' }
  const res = await informeJSON(new Request(`${origin}/api/informe-mod`, { headers: cabeceras }))
  if (!res.ok) {
    return new Response('No autorizado o sin datos', { status: res.status })
  }
  const data: any = await res.json()

  const [regular, bold] = await Promise.all([
    readFile(path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Regular.ttf')),
    readFile(path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Bold.ttf')),
  ])

  const { mod, tramitacion: tram, resumen } = data

  // ── Piezas básicas (todo flex, alturas fijas para poder medir el PNG) ─────
  const Cell = ({ w, h, children, bold: b, color, bg, align = 'center', size = 12, right, italic }: any) => (
    <div style={{
      display: 'flex', width: w, height: h, alignItems: 'center',
      justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
      paddingLeft: align === 'left' ? 8 : 2, paddingRight: align === 'right' ? 8 : 2,
      fontSize: size, fontWeight: b ? 700 : 400, color: color || C.tinta,
      backgroundColor: bg || 'transparent',
      borderRight: right ? `2px solid ${C.borde}` : `1px solid ${C.borde}`,
      fontStyle: italic ? 'italic' : 'normal',
    }}>{String(children)}</div>
  )

  const Row = ({ h, children, bg, top }: any) => (
    <div style={{
      display: 'flex', width: INTERIOR, height: h, backgroundColor: bg || C.card,
      borderBottom: `1px solid ${C.borde}`, borderTop: top ? `2px solid ${C.borde}` : 'none',
    }}>{children}</div>
  )

  const Titulo = ({ children }: any) => (
    <div style={{
      display: 'flex', width: INTERIOR, height: 44, alignItems: 'flex-end',
      paddingBottom: 8, fontSize: 19, fontWeight: 700, color: C.tinta, letterSpacing: 0.5,
    }}>{String(children)}</div>
  )

  // ════════════════════════════════════ BLOQUE 1 · MOD ══════════════════════
  const W1 = [200, 170, 140, 200, 190, 240, 212]   // suma 1352
  const H1_HEAD = 32, H1_ROW = 34
  const modAlto = H1_HEAD + H1_ROW * 3

  const ModBloque = (
    <div style={{ display: 'flex', flexDirection: 'column', width: INTERIOR, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.borde}` }}>
      <Row h={H1_HEAD} bg={C.azulCab}>
        {['Año y Mes', 'Operaciones Realizadas', 'Días Trabajados', 'Media de Operaciones Diaria', 'Media por Operación', 'Importe Mensual', 'Media Importe Diario']
          .map((t, i) => <Cell key={i} w={W1[i]} h={H1_HEAD} bold color="#fff" bg={C.azulCab}>{t}</Cell>)}
      </Row>
      <Row h={H1_ROW}>
        <Cell w={W1[0]} h={H1_ROW} bold>{mod.anioAnterior.etiqueta}</Cell>
        <Cell w={W1[1]} h={H1_ROW} bold>{intES(mod.anioAnterior.ops)}</Cell>
        <Cell w={W1[2]} h={H1_ROW} bold>{intES(mod.anioAnterior.dias)}</Cell>
        <Cell w={W1[3]} h={H1_ROW} bold>{num2(mod.anioAnterior.mediaOpsDiaria)}</Cell>
        <Cell w={W1[4]} h={H1_ROW} bold>{num2(mod.anioAnterior.mediaPorOp) + ' €'}</Cell>
        <Cell w={W1[5]} h={H1_ROW} bold>{num2(mod.anioAnterior.importe) + ' €'}</Cell>
        <Cell w={W1[6]} h={H1_ROW} bold>{num2(mod.anioAnterior.mediaImporteDiario) + ' €'}</Cell>
      </Row>
      <Row h={H1_ROW} bg={C.verdeFila}>
        <Cell w={W1[0]} h={H1_ROW} bold color="#fff" bg={C.verdeFila}>{mod.mesActual.etiqueta}</Cell>
        <Cell w={W1[1]} h={H1_ROW} bold color="#fff" bg={C.verdeFila}>{intES(mod.mesActual.ops)}</Cell>
        <Cell w={W1[2]} h={H1_ROW} bold color="#fff" bg={C.verdeFila}>{intES(mod.mesActual.dias)}</Cell>
        <Cell w={W1[3]} h={H1_ROW} bold color="#fff" bg={C.verdeFila}>{num2(mod.mesActual.mediaOpsDiaria)}</Cell>
        <Cell w={W1[4]} h={H1_ROW} bold color="#fff" bg={C.verdeFila}>{num2(mod.mesActual.mediaPorOp) + ' €'}</Cell>
        <Cell w={W1[5]} h={H1_ROW} bold color="#fff" bg={C.verdeFila}>{num2(mod.mesActual.importe) + ' €'}</Cell>
        <Cell w={W1[6]} h={H1_ROW} bold color="#fff" bg={C.verdeFila}>{num2(mod.mesActual.mediaImporteDiario) + ' €'}</Cell>
      </Row>
      <Row h={H1_ROW} bg={C.azulOscuro}>
        <Cell w={W1[0]} h={H1_ROW} color="#fff" bg={C.azulOscuro}>Estimación Operaciones</Cell>
        <Cell w={W1[1]} h={H1_ROW} bold color="#fff" bg={C.azulOscuro}>{intES(Math.round(mod.estimacion.estOps))}</Cell>
        <Cell w={W1[2]} h={H1_ROW} color="#fff" bg={C.azulOscuro}>Operaciones en %</Cell>
        <Cell w={W1[3]} h={H1_ROW} bold bg={C.azulOscuro} color={mod.estimacion.pctOps >= 0 ? '#BBF7D0' : '#FECDD3'}>
          {(mod.estimacion.pctOps > 0 ? '+' : '') + mod.estimacion.pctOps.toFixed(2) + '%'}
        </Cell>
        <Cell w={W1[4]} h={H1_ROW} color="#fff" bg={C.azulOscuro}>Estimación Rentabilidad</Cell>
        <Cell w={W1[5]} h={H1_ROW} bold color="#fff" bg={C.azulOscuro}>{num2(mod.estimacion.estRentabilidad) + ' €'}</Cell>
        <Cell w={W1[6]} h={H1_ROW} bold bg={C.azulOscuro} color={mod.estimacion.pctImporte >= 0 ? '#BBF7D0' : '#FECDD3'}>
          {(mod.estimacion.pctImporte > 0 ? '+' : '') + mod.estimacion.pctImporte.toFixed(2) + '%'}
        </Cell>
      </Row>
    </div>
  )

  // ══════════════════════ BLOQUE 2 · SEGUIMIENTO DE TRAMITACIÓN ═════════════
  // Anchos: 3 primeras columnas + 7 grupos (unidad u = 36 px, € = 54 px).
  const W_STORE = 118, W_PERS = 28, W_ALTAS = 36
  const W_FIRST = W_STORE + W_PERS + W_ALTAS       // 182
  const u = 36, e = 54
  const G = {
    baf: [u, u, u, u, u],            // Obj Vent Tram Proy %      (180)
    conv: [u, u, u, u, u],           // (180)
    tv: [u, u, u, u],                // Obj Vent Proy %           (144)
    disp: [u, e, e, e, u],           // Obj2 Obj€ Vent€ Proy€ %   (234)
    repos: [u, u, u, u],             // (144)
    fttr: [u, u, u, u],              // (144)
    alarmas: [u, u, u, u],           // (144)
  }
  const gw = (cols: number[]) => cols.reduce((a, b) => a + b, 0)
  const H2_G = 30, H2_S = 24, H2_R = 26

  const movistarRows: any[] = tram.rows || []
  const o2Rows: any[] = tram.o2Rows || []
  const t = tram.totals
  const rsm = tram.resumen

  const GrupoHdr = ({ w, children }: any) => (
    <Cell w={w} h={H2_G} bold color="#fff" bg={C.azulCab} size={11.5} right>{children}</Cell>
  )
  const SubHdr = ({ w, children, color, right }: any) => (
    <Cell w={w} h={H2_S} bold color={color || C.gris} bg={C.grisFila} size={10.5} right={right}>{children}</Cell>
  )

  // Una fila de tienda Movistar completa, en el mismo orden que la pantalla.
  const FilaTienda = (r: any, i: number) => (
    <Row key={r.store} h={H2_R} bg={i % 2 === 0 ? C.card : '#FCFCFD'}>
      <Cell w={W_STORE} h={H2_R} bold align="left" size={11.5}>{r.store}</Cell>
      <Cell w={W_PERS} h={H2_R} color={C.gris} size={11.5}>{r.pers}</Cell>
      <Cell w={W_ALTAS} h={H2_R} bold size={11.5} right>{r.altasTotales}</Cell>
      {/* BAF */}
      <Cell w={u} h={H2_R} bg={C.objBg} size={11.5}>{fmtNum(r.bafNoTrasl_obj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5}>{fmtNum(r.bafNoTrasl_vent)}</Cell>
      <Cell w={u} h={H2_R} bold color={C.rosa} size={11.5}>{fmtNum(r.bafNoTrasl_tram)}</Cell>
      <Cell w={u} h={H2_R} bg={C.proyBg} color="#374151" size={11.5}>{fmtNum(r.bafNoTrasl_proj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5} right color={(r.bafNoTrasl_obj > 0 ? r.bafNoTrasl_proj / r.bafNoTrasl_obj : 0) >= 1 ? C.verde : C.rojo}>{fmtPct(r.bafNoTrasl_obj > 0 ? r.bafNoTrasl_proj / r.bafNoTrasl_obj : 0)}</Cell>
      {/* BAF Conv MS */}
      <Cell w={u} h={H2_R} bg={C.objBg} size={11.5}>{fmtNum(r.bafConvMS_obj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5}>{fmtNum(r.bafConvMS_vent)}</Cell>
      <Cell w={u} h={H2_R} bold color={C.rosa} size={11.5}>{fmtNum(r.bafConvMS_tram)}</Cell>
      <Cell w={u} h={H2_R} bg={C.proyBg} color="#374151" size={11.5}>{fmtNum(r.bafConvMS_proj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5} right color={(r.bafConvMS_obj > 0 ? r.bafConvMS_proj / r.bafConvMS_obj : 0) >= 1 ? C.verde : C.rojo}>{fmtPct(r.bafConvMS_obj > 0 ? r.bafConvMS_proj / r.bafConvMS_obj : 0)}</Cell>
      {/* TV + Fútbol */}
      <Cell w={u} h={H2_R} bg={C.objBg} size={11.5}>{fmtNum(r.tvFutbol_obj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5}>{fmtNum(r.tvFutbol_vent)}</Cell>
      <Cell w={u} h={H2_R} bg={C.proyBg} color="#374151" size={11.5}>{fmtNum(r.tvFutbol_proj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5} right color={(r.tvFutbol_obj > 0 ? r.tvFutbol_proj / r.tvFutbol_obj : 0) >= 1 ? C.verde : C.rojo}>{fmtPct(r.tvFutbol_obj > 0 ? r.tvFutbol_proj / r.tvFutbol_obj : 0)}</Cell>
      {/* Dispositivos + Seguro */}
      <Cell w={u} h={H2_R} bold color={C.cian} size={11.5}>{fmtNum(r.dispUnidades_vent)}</Cell>
      <Cell w={e} h={H2_R} bg={C.objBg} size={11.5}>{fmtNum(r.dispSegEuros_obj, true)}</Cell>
      <Cell w={e} h={H2_R} bold size={11.5}>{fmtNum(r.dispSegEuros_vent, true)}</Cell>
      <Cell w={e} h={H2_R} bg={C.proyBg} color="#374151" size={11.5}>{fmtNum(r.dispSegEuros_proj, true)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5} right color={(r.dispSegEuros_obj > 0 ? r.dispSegEuros_proj / r.dispSegEuros_obj : 0) >= 1 ? C.verde : C.rojo}>{fmtPct(r.dispSegEuros_obj > 0 ? r.dispSegEuros_proj / r.dispSegEuros_obj : 0)}</Cell>
      {/* Repos */}
      <Cell w={u} h={H2_R} bg="#F0F9FF" bold color="#0284C7" size={11.5}>{r.repos_obj}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5}>{fmtNum(r.repos_vent)}</Cell>
      <Cell w={u} h={H2_R} bg={C.proyBg} color="#374151" size={11.5}>{fmtNum(r.repos_proj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5} right color={(r.repos_obj > 0 ? r.repos_proj / r.repos_obj : 0) >= 1 ? C.verde : C.rojo}>{fmtPct(r.repos_obj > 0 ? r.repos_proj / r.repos_obj : 0)}</Cell>
      {/* FTTR */}
      <Cell w={u} h={H2_R} bg={C.objBg} size={11.5}>{fmtNum(r.fttr_obj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5}>{fmtNum(r.fttr_vent)}</Cell>
      <Cell w={u} h={H2_R} bg={C.proyBg} color="#374151" size={11.5}>{fmtNum(r.fttr_proj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5} right color={(r.fttr_obj > 0 ? r.fttr_proj / r.fttr_obj : 0) >= 1 ? C.verde : C.rojo}>{fmtPct(r.fttr_obj > 0 ? r.fttr_proj / r.fttr_obj : 0)}</Cell>
      {/* Alarmas */}
      <Cell w={u} h={H2_R} bg={C.objBg} size={11.5}>{fmtNum(r.alarmas_obj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5}>{fmtNum(r.alarmas_vent)}</Cell>
      <Cell w={u} h={H2_R} bg={C.proyBg} color="#374151" size={11.5}>{fmtNum(r.alarmas_proj)}</Cell>
      <Cell w={u} h={H2_R} bold size={11.5} color={(r.alarmas_obj > 0 ? r.alarmas_proj / r.alarmas_obj : 0) >= 1 ? C.verde : C.rojo}>{fmtPct(r.alarmas_obj > 0 ? r.alarmas_proj / r.alarmas_obj : 0)}</Cell>
    </Row>
  )

  // Fila resumen (Déficit / % / Media): una etiqueta + una celda por grupo.
  const FilaResumen = ({ etiqueta, bg, valores }: { etiqueta: string, bg: string, valores: { texto: string, color?: string }[] }) => (
    <Row h={H2_R} bg={bg}>
      <Cell w={W_FIRST} h={H2_R} bold align="right" size={11.5} right bg={bg} color="#0369A1">{etiqueta}</Cell>
      {[G.baf, G.conv, G.tv, G.disp, G.repos, G.fttr, G.alarmas].map((cols, i) => (
        <Cell key={i} w={gw(cols)} h={H2_R} bold size={11.5} right bg={bg} color={valores[i].color || C.tinta}>{valores[i].texto}</Cell>
      ))}
    </Row>
  )

  const colDef = (v: number) => (v <= 0 ? C.verde : C.rojo)
  const colPct = (v: number) => (v >= 1 ? C.verde : C.rojo)

  const tramMovAlto = H2_G + H2_S + movistarRows.length * H2_R + H2_R /*totales*/ + 3 * H2_R
  const tieneO2 = o2Rows.length > 0
  const tramO2Alto = tieneO2 ? (14 + H2_G + H2_S + o2Rows.length * H2_R + 3 * H2_R) : 0

  // Bloque O2: 3 + 5 + 5 columnas anchas.
  const O_STORE = 300, O_PERS = 80, O_ALTAS = 100
  const O_FIRST = O_STORE + O_PERS + O_ALTAS       // 480
  const oc = 87                                     // 5 × 87 = 435 por grupo
  const o2t = tram.o2Totals
  const o2r = tram.o2Resumen

  const FilaO2Resumen = ({ etiqueta, bg, valores }: { etiqueta: string, bg: string, valores: { texto: string, color?: string }[] }) => (
    <Row h={H2_R} bg={bg}>
      <Cell w={O_FIRST} h={H2_R} bold align="right" size={11.5} right bg={bg} color="#0369A1">{etiqueta}</Cell>
      <Cell w={oc * 5} h={H2_R} bold size={11.5} right bg={bg} color={valores[0].color || C.tinta}>{valores[0].texto}</Cell>
      <Cell w={oc * 5} h={H2_R} bold size={11.5} bg={bg} color={valores[1].color || C.tinta}>{valores[1].texto}</Cell>
    </Row>
  )

  // ═════════════════════ BLOQUE 3 · RESUMEN DE MÉTRICAS MOD ═════════════════
  const W3 = [700, 326, 326]
  const H3_HEAD = 34, H3_ROW = 32, H3_TOT = 38
  const resAlto = H3_HEAD + (resumen.rows?.length || 0) * H3_ROW + H3_TOT

  // ── Altura total exacta ───────────────────────────────────────────────────
  const HEADER_H = 96
  const TIT_H = 44
  const alto = PAD * 2 + HEADER_H
    + TIT_H + modAlto + 2
    + TIT_H + tramMovAlto + tramO2Alto + 2
    + TIT_H + resAlto + 2
    + 12

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column', width: ANCHO, height: alto,
        backgroundColor: C.fondo, padding: PAD, fontFamily: 'Liberation Sans',
      }}>
        {/* Cabecera */}
        <div style={{
          display: 'flex', width: INTERIOR, height: HEADER_H, borderRadius: 14,
          backgroundImage: `linear-gradient(90deg, ${C.azulCab}, ${C.azulOscuro})`,
          alignItems: 'center', justifyContent: 'space-between', padding: '0 28px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: 2 }}>
              MICROSHOP TIENDAS · INFORME MOD DIARIO
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', marginTop: 2 }}>
              {`${mod.monthName} ${mod.year}`}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>Generado (hora de Madrid)</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#fff' }}>
              {`${data.generado.fecha.split('-').reverse().join('/')} · ${data.generado.hora}`}
            </div>
          </div>
        </div>

        {/* ── 1 · MOD ── */}
        <Titulo>{`MOD · Media Operaciones Diaria (${mod.monthName} ${mod.year})`}</Titulo>
        {ModBloque}

        {/* ── 2 · Seguimiento de Tramitación ── */}
        <Titulo>Seguimiento de Tramitación</Titulo>
        <div style={{ display: 'flex', flexDirection: 'column', width: INTERIOR, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.borde}` }}>
          {/* Cabecera de grupos */}
          <Row h={H2_G} bg={C.azulCab}>
            <GrupoHdr w={W_FIRST}>{tram.fechaCabecera}</GrupoHdr>
            <GrupoHdr w={gw(G.baf)}>Total Altas BAF (No trasl.)</GrupoHdr>
            <GrupoHdr w={gw(G.conv)}>Altas BAF Movistar Conv.</GrupoHdr>
            <GrupoHdr w={gw(G.tv)}>TV + Altas Futbol</GrupoHdr>
            <GrupoHdr w={gw(G.disp)}>Disp. + Seguro Móvil</GrupoHdr>
            <GrupoHdr w={gw(G.repos)}>REPOS</GrupoHdr>
            <GrupoHdr w={gw(G.fttr)}>FTTR</GrupoHdr>
            <GrupoHdr w={gw(G.alarmas)}>ALARMAS MPA</GrupoHdr>
          </Row>
          {/* Subcabecera */}
          <Row h={H2_S} bg={C.grisFila}>
            <SubHdr w={W_STORE}>Tiendas</SubHdr>
            <SubHdr w={W_PERS}>Pers</SubHdr>
            <SubHdr w={W_ALTAS} right>Altas</SubHdr>
            {['baf', 'conv'].map(k => (
              ['Obj', 'Vent', 'Tram', 'Proy', '%'].map((s, i) => (
                <SubHdr key={k + s} w={(G as any)[k][i]} color={s === 'Tram' ? C.rosa : undefined} right={i === 4}>{s}</SubHdr>
              ))
            ))}
            {['Obj', 'Vent', 'Proy', '%'].map((s, i) => <SubHdr key={'tv' + s} w={G.tv[i]} right={i === 3}>{s}</SubHdr>)}
            {['Obj2', 'Obj', 'Vent', 'Proy', '%'].map((s, i) => <SubHdr key={'d' + s} w={G.disp[i]} right={i === 4}>{s}</SubHdr>)}
            {['Obj', 'Vent', 'Proy', '%'].map((s, i) => <SubHdr key={'r' + s} w={G.repos[i]} right={i === 3}>{s}</SubHdr>)}
            {['Obj', 'Vent', 'Proy', '%'].map((s, i) => <SubHdr key={'f' + s} w={G.fttr[i]} right={i === 3}>{s}</SubHdr>)}
            {['Obj', 'Vent', 'Proy', '%'].map((s, i) => <SubHdr key={'a' + s} w={G.alarmas[i]} right={i === 3}>{s}</SubHdr>)}
          </Row>
          {movistarRows.map((r, i) => FilaTienda(r, i))}
          {/* Totales */}
          <Row h={H2_R} bg={C.grisFila} top>
            <Cell w={W_STORE} h={H2_R} bold align="left" size={11.5} bg={C.grisFila}>{t.store}</Cell>
            <Cell w={W_PERS} h={H2_R} bold size={11.5} bg={C.grisFila}>{t.pers}</Cell>
            <Cell w={W_ALTAS} h={H2_R} bold size={11.5} right bg={C.grisFila}>{t.altasTotales}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.bafNoTrasl_obj)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.bafNoTrasl_vent)}</Cell>
            <Cell w={u} h={H2_R} bold color={C.rosa} size={11.5} bg={C.grisFila}>{fmtNum(t.bafNoTrasl_tram)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.bafNoTrasl_proj)}</Cell>
            <Cell w={u} h={H2_R} size={11.5} right bg={C.grisFila}>{''}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.bafConvMS_obj)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.bafConvMS_vent)}</Cell>
            <Cell w={u} h={H2_R} bold color={C.rosa} size={11.5} bg={C.grisFila}>{fmtNum(t.bafConvMS_tram)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.bafConvMS_proj)}</Cell>
            <Cell w={u} h={H2_R} size={11.5} right bg={C.grisFila}>{''}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.tvFutbol_obj)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.tvFutbol_vent)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.tvFutbol_proj)}</Cell>
            <Cell w={u} h={H2_R} size={11.5} right bg={C.grisFila}>{''}</Cell>
            <Cell w={u} h={H2_R} bold color={C.cian} size={11.5} bg={C.grisFila}>{fmtNum(t.dispUnidades_vent)}</Cell>
            <Cell w={e} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.dispSegEuros_obj, true)}</Cell>
            <Cell w={e} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.dispSegEuros_vent, true)}</Cell>
            <Cell w={e} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.dispSegEuros_proj, true)}</Cell>
            <Cell w={u} h={H2_R} size={11.5} right bg={C.grisFila}>{''}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.repos_obj)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.repos_vent)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.repos_proj)}</Cell>
            <Cell w={u} h={H2_R} size={11.5} right bg={C.grisFila}>{''}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.fttr_obj)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.fttr_vent)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.fttr_proj)}</Cell>
            <Cell w={u} h={H2_R} size={11.5} right bg={C.grisFila}>{''}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.alarmas_obj)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.alarmas_vent)}</Cell>
            <Cell w={u} h={H2_R} bold size={11.5} bg={C.grisFila}>{fmtNum(t.alarmas_proj)}</Cell>
            <Cell w={u} h={H2_R} size={11.5} bg={C.grisFila}>{''}</Cell>
          </Row>
          <FilaResumen etiqueta="Necesitamos Hoy Deficit" bg={C.celeste} valores={[
            { texto: fmtNum(rsm.bafNoTrasl.deficit), color: colDef(rsm.bafNoTrasl.deficit) },
            { texto: fmtNum(rsm.bafConvMS.deficit), color: colDef(rsm.bafConvMS.deficit) },
            { texto: fmtNum(rsm.tvFutbol.deficit), color: colDef(rsm.tvFutbol.deficit) },
            { texto: fmtNum(rsm.dispSegEuros.deficit, true), color: colDef(rsm.dispSegEuros.deficit) },
            { texto: fmtNum(rsm.repos.deficit), color: colDef(rsm.repos.deficit) },
            { texto: fmtNum(rsm.fttr.deficit), color: colDef(rsm.fttr.deficit) },
            { texto: fmtNum(rsm.alarmas.deficit), color: colDef(rsm.alarmas.deficit) },
          ]} />
          <FilaResumen etiqueta="Proyect Porcentaje" bg={C.grisFila} valores={[
            { texto: fmtPct(rsm.bafNoTrasl.pct), color: colPct(rsm.bafNoTrasl.pct) },
            { texto: fmtPct(rsm.bafConvMS.pct), color: colPct(rsm.bafConvMS.pct) },
            { texto: fmtPct(rsm.tvFutbol.pct), color: colPct(rsm.tvFutbol.pct) },
            { texto: fmtPct(rsm.dispSegEuros.pct), color: colPct(rsm.dispSegEuros.pct) },
            { texto: fmtPct(rsm.repos.pct), color: colPct(rsm.repos.pct) },
            { texto: fmtPct(rsm.fttr.pct), color: colPct(rsm.fttr.pct) },
            { texto: fmtPct(rsm.alarmas.pct), color: colPct(rsm.alarmas.pct) },
          ]} />
          <FilaResumen etiqueta="Proyect una Media de" bg={C.card} valores={[
            { texto: fmtNum(rsm.bafNoTrasl.media) },
            { texto: fmtNum(rsm.bafConvMS.media) },
            { texto: fmtNum(rsm.tvFutbol.media) },
            { texto: fmtNum(rsm.dispSegEuros.media, true) },
            { texto: fmtNum(rsm.repos.media) },
            { texto: fmtNum(rsm.fttr.media) },
            { texto: fmtNum(rsm.alarmas.media) },
          ]} />
        </div>

        {/* ── 2b · Tiendas O2 ── */}
        {tieneO2 && (
          <div style={{ display: 'flex', flexDirection: 'column', width: INTERIOR, marginTop: 14, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.borde}` }}>
            <Row h={H2_G} bg={C.azulCab}>
              <GrupoHdr w={O_FIRST}>Tiendas O2</GrupoHdr>
              <GrupoHdr w={oc * 5}>Altas/Portas Fibra</GrupoHdr>
              <GrupoHdr w={oc * 5}>Internas Fibra</GrupoHdr>
            </Row>
            <Row h={H2_S} bg={C.grisFila}>
              <SubHdr w={O_STORE}>Nombre Comercial PdV</SubHdr>
              <SubHdr w={O_PERS}>Pers</SubHdr>
              <SubHdr w={O_ALTAS} right>Total Altas</SubHdr>
              {['Obj', 'Vent', 'Tram', 'Proy', '%'].map((s, i) => <SubHdr key={'o1' + s} w={oc} color={s === 'Tram' ? C.rosa : undefined} right={i === 4}>{s}</SubHdr>)}
              {['Obj', 'Vent', 'Tram', 'Proy', '%'].map((s, i) => <SubHdr key={'o2' + s} w={oc} color={s === 'Tram' ? C.rosa : undefined}>{s}</SubHdr>)}
            </Row>
            {o2Rows.map((r: any) => (
              <Row key={r.store} h={H2_R}>
                <Cell w={O_STORE} h={H2_R} bold align="left" size={11.5}>{r.store}</Cell>
                <Cell w={O_PERS} h={H2_R} color={C.gris} size={11.5}>{r.pers}</Cell>
                <Cell w={O_ALTAS} h={H2_R} bold size={11.5} right>{r.altasTotales}</Cell>
                <Cell w={oc} h={H2_R} bg="#F0F9FF" bold color="#0284C7" size={11.5}>{r.bafNoTrasl_obj}</Cell>
                <Cell w={oc} h={H2_R} bold size={11.5}>{fmtNum(r.bafNoTrasl_vent)}</Cell>
                <Cell w={oc} h={H2_R} bold color={C.rosa} size={11.5}>{fmtNum(r.bafNoTrasl_tram)}</Cell>
                <Cell w={oc} h={H2_R} bg={C.proyBg} color="#374151" size={11.5}>{fmtNum(r.bafNoTrasl_proj)}</Cell>
                <Cell w={oc} h={H2_R} bold size={11.5} right color={(r.bafNoTrasl_obj > 0 ? r.bafNoTrasl_proj / r.bafNoTrasl_obj : 0) >= 1 ? C.verde : C.rojo}>{fmtPct(r.bafNoTrasl_obj > 0 ? r.bafNoTrasl_proj / r.bafNoTrasl_obj : 0)}</Cell>
                <Cell w={oc} h={H2_R} bg="#F0F9FF" bold color="#0284C7" size={11.5}>{r.bafConvMS_obj}</Cell>
                <Cell w={oc} h={H2_R} bold size={11.5}>{fmtNum(r.bafConvMS_vent)}</Cell>
                <Cell w={oc} h={H2_R} bold color={C.rosa} size={11.5}>{fmtNum(r.bafConvMS_tram)}</Cell>
                <Cell w={oc} h={H2_R} bg={C.proyBg} color="#374151" size={11.5}>{fmtNum(r.bafConvMS_proj)}</Cell>
                <Cell w={oc} h={H2_R} bold size={11.5} color={(r.bafConvMS_obj > 0 ? r.bafConvMS_proj / r.bafConvMS_obj : 0) >= 1 ? C.verde : C.rojo}>{fmtPct(r.bafConvMS_obj > 0 ? r.bafConvMS_proj / r.bafConvMS_obj : 0)}</Cell>
              </Row>
            ))}
            <FilaO2Resumen etiqueta="Necesitamos Hoy Deficit" bg={C.celeste} valores={[
              { texto: fmtNum(o2r.bafNoTrasl.deficit), color: colDef(o2r.bafNoTrasl.deficit) },
              { texto: fmtNum(o2r.bafConvMS.deficit), color: colDef(o2r.bafConvMS.deficit) },
            ]} />
            <FilaO2Resumen etiqueta="Proyect Porcentaje" bg={C.grisFila} valores={[
              { texto: fmtPct(o2r.bafNoTrasl.pct), color: colPct(o2r.bafNoTrasl.pct) },
              { texto: fmtPct(o2r.bafConvMS.pct), color: colPct(o2r.bafConvMS.pct) },
            ]} />
            <FilaO2Resumen etiqueta="Proyect una Media de" bg={C.card} valores={[
              { texto: fmtNum(o2r.bafNoTrasl.media) },
              { texto: fmtNum(o2r.bafConvMS.media) },
            ]} />
          </div>
        )}

        {/* ── 3 · Resumen de Métricas MOD ── */}
        <Titulo>{`Resumen de Métricas MOD · Días laborables ${resumen.workingDaysElapsed} / ${resumen.totalWorkingDays}`}</Titulo>
        <div style={{ display: 'flex', flexDirection: 'column', width: INTERIOR, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.borde}` }}>
          <Row h={H3_HEAD} bg={C.azulCab}>
            <Cell w={W3[0]} h={H3_HEAD} bold color="#fff" bg={C.azulCab} align="left" size={13}>Grupo</Cell>
            <Cell w={W3[1]} h={H3_HEAD} bold color="#fff" bg={C.azulCab} align="right" size={13}>Importe Real</Cell>
            <Cell w={W3[2]} h={H3_HEAD} bold color="#fff" bg={C.azulCab} align="right" size={13}>Importe Proyección</Cell>
          </Row>
          {(resumen.rows || []).map((row: any) => (
            <Row key={row.name} h={H3_ROW} bg={row.isSubtotal ? '#EEF1F5' : C.card}>
              <Cell w={W3[0]} h={H3_ROW} bold align="left" size={12.5} italic={!!row.isSubtotal}>{row.name}</Cell>
              <Cell w={W3[1]} h={H3_ROW} bold align="right" size={12.5}>{eur2(row.real)}</Cell>
              <Cell w={W3[2]} h={H3_ROW} bold align="right" size={12.5} color={C.azulOscuro}>{eur2(row.projection)}</Cell>
            </Row>
          ))}
          <Row h={H3_TOT} bg="#E0F2FE" top>
            <Cell w={W3[0]} h={H3_TOT} bold align="left" size={13.5} bg="#E0F2FE">TOTAL</Cell>
            <Cell w={W3[1]} h={H3_TOT} bold align="right" size={13.5} bg="#E0F2FE" color="#15803D">{eur2(resumen.totalReal)}</Cell>
            <Cell w={W3[2]} h={H3_TOT} bold align="right" size={13.5} bg="#E0F2FE" color={C.azulOscuro}>{eur2(resumen.totalProjection)}</Cell>
          </Row>
        </div>
      </div>
    ),
    {
      width: ANCHO,
      height: alto,
      fonts: [
        { name: 'Liberation Sans', data: regular, weight: 400, style: 'normal' },
        { name: 'Liberation Sans', data: bold, weight: 700, style: 'normal' },
      ],
    },
  )
}
