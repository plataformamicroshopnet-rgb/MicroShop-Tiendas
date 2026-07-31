import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import path from 'path'
import { GET as parteDiarioJSON } from '../route'
import type { ParteDiarioResponse } from '@/lib/parteDiario'

// ─────────────────────────────────────────────────────────────────────────────
// EL RESUMEN DEL EQUIPO, COMO IMAGEN (para los jefes).
//
// Cada comercial recibe su parte; el jefe no quiere seis correos, quiere UNA
// foto con todo el equipo: quién vendió ayer, por cuánto, lo que se llevó de
// comisión y cómo va el mes. Eso es esto.
//
// Las cifras salen del MISMO endpoint que los partes individuales, llamado aquí
// dentro (sin salir a la red: el contenedor no puede llamarse a sí mismo por su
// dominio en producción). Así el resumen del jefe y el parte del comercial no
// pueden decir números distintos.
//
// GET /api/parte-diario/imagen-equipo?fecha=YYYY-MM-DD&periodKey=YYYY_MM
// Auth: cabecera x-prv-secret (el ERP) o la sesión del navegador.
//
// Ojo con Satori (el dibujante de next/og): solo flexbox, no hereda estilos, un
// recuadro con más de un hijo tiene que declarar display:flex, y el alto hay que
// dárselo calculado — si te quedas corto, la imagen se corta por abajo.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ANCHO = 1180

const C = {
  fondo: '#0B1524',
  tarjeta: '#132239',
  borde: '#22354F',
  raya: '#1B2C45',
  tinta: '#EAF2FB',
  suave: '#9FB6D0',
  tenue: '#7089A6',
  ok: '#34D399',
  oro: '#FBBF24',
  azul: '#2563EB',
}

const _miles = (entero: string) => entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const eur0 = (v: number) => _miles(String(Math.round(Number(v) || 0))) + ' €'
const eur2 = (v: number) => {
  const n = Number(v) || 0
  const signo = n < 0 ? '-' : ''
  const [ent, dec] = Math.abs(n).toFixed(2).split('.')
  return `${signo}${_miles(ent)},${dec} €`
}

const fechaLarga = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const t = new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Anchos de columna. Suman el ancho útil de la tarjeta; si se tocan hay que
// recalcularlos a mano, que Satori no reparte sobrantes como una tabla HTML.
const COL = { nombre: 240, ops: 90, importe: 160, comision: 160, opsMes: 90, importeMes: 176, comisionMes: 180 }
const ANCHO_TARJETA = ANCHO - 48
const DENTRO = ANCHO_TARJETA - 36
const ALTO_FILA = 46

function Celda({ texto, ancho, color, peso, derecha, tam }: {
  texto: string; ancho: number; color: string; peso?: number; derecha?: boolean; tam?: number
}) {
  return (
    <div style={{
      display: 'flex', width: ancho, justifyContent: derecha ? 'flex-end' : 'flex-start',
      alignItems: 'center', color, fontSize: tam || 21, fontWeight: peso || 400,
    }}>{texto}</div>
  )
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const fecha = (searchParams.get('fecha') || '').trim()
  const periodKey = (searchParams.get('periodKey') || '').trim()
  const titulo = (searchParams.get('titulo') || 'Tiendas').trim()

  const qs = new URLSearchParams()
  if (fecha) qs.set('fecha', fecha)
  if (periodKey) qs.set('periodKey', periodKey)

  const secreto = request.headers.get('x-prv-secret')
  const cabeceras: Record<string, string> = secreto
    ? { 'x-prv-secret': secreto }
    : { cookie: request.headers.get('cookie') || '' }
  const res = await parteDiarioJSON(
    new Request(`${origin}/api/parte-diario?${qs.toString()}`, { headers: cabeceras }))
  if (!res.ok) return new Response('No autorizado o sin datos', { status: res.status })

  const data: ParteDiarioResponse = await res.json()
  const lista = data.comerciales || []
  if (!lista.length) return new Response('Sin comerciales ese día', { status: 404 })

  // Orden: el que más vendió AYER arriba; a igualdad, el que más lleva del mes.
  const filas = [...lista].sort(
    (a, b) => b.ayer.importe - a.ayer.importe || b.mes.importe - a.mes.importe)

  const tot = filas.reduce((acc, c) => ({
    ops: acc.ops + c.ayer.ops,
    importe: acc.importe + c.ayer.importe,
    comision: acc.comision + c.ayer.comision,
    opsMes: acc.opsMes + c.mes.ops,
    importeMes: acc.importeMes + c.mes.importe,
    comisionMes: acc.comisionMes + c.mes.comisionTotal,
  }), { ops: 0, importe: 0, comision: 0, opsMes: 0, importeMes: 0, comisionMes: 0 })

  const conVentas = filas.filter(c => c.ayer.ops > 0).length
  const sinVentas = filas.length - conVentas

  const [regular, bold] = await Promise.all([
    readFile(path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Regular.ttf')),
    readFile(path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Bold.ttf')),
  ])

  // Alto: cabecera + tira de cifras + tarjeta (2 filas de encabezado + N filas +
  // total) + pie. Todo contado, nada a ojo.
  const altoCabecera = 26 + 30 + 60 + 26
  const altoCifras = 104 + 18
  const altoTabla = 18 + 26 + 40 + filas.length * ALTO_FILA + 10 + 56 + 18
  const alto = Math.round(24 + altoCabecera + 18 + altoCifras + altoTabla + 20 + 44)

  const cifras: { rotulo: string; valor: string; color: string }[] = [
    { rotulo: 'OPERACIONES DE AYER', valor: String(tot.ops), color: C.tinta },
    { rotulo: 'IMPORTE DE AYER', valor: eur0(tot.importe), color: C.tinta },
    { rotulo: 'COMISIÓN DE AYER', valor: eur2(tot.comision), color: C.ok },
    { rotulo: 'COMISIÓN DEL MES', valor: eur2(tot.comisionMes), color: C.oro },
  ]
  const anchoCifra = (DENTRO - 3 * 14) / 4

  const encabezados: { texto: string; ancho: number; derecha?: boolean }[] = [
    { texto: 'COMERCIAL', ancho: COL.nombre },
    { texto: 'OPS.', ancho: COL.ops, derecha: true },
    { texto: 'IMPORTE', ancho: COL.importe, derecha: true },
    { texto: 'COMISIÓN', ancho: COL.comision, derecha: true },
    { texto: 'OPS.', ancho: COL.opsMes, derecha: true },
    { texto: 'IMPORTE', ancho: COL.importeMes, derecha: true },
    { texto: 'COMISIÓN', ancho: COL.comisionMes, derecha: true },
  ]

  return new ImageResponse(
    (
      <div style={{
        width: ANCHO, height: alto, display: 'flex', flexDirection: 'column',
        backgroundColor: C.fondo, padding: '24px 24px 0', fontFamily: 'Liberation Sans',
      }}>
        {/* Cabecera azul */}
        <div style={{
          display: 'flex', flexDirection: 'column', backgroundColor: C.azul,
          borderRadius: 22, padding: '26px 32px', marginBottom: 18,
        }}>
          <div style={{
            display: 'flex', color: '#BFD5FF', fontSize: 17, fontWeight: 700,
            letterSpacing: 2, marginBottom: 4,
          }}>{`${fechaLarga(data.fecha)} · RESUMEN DEL EQUIPO`}</div>
          <div style={{ display: 'flex', color: '#FFFFFF', fontSize: 46, fontWeight: 700 }}>
            {`MicroShop ${titulo}`}
          </div>
          <div style={{ display: 'flex', color: '#DBE7FF', fontSize: 22, marginTop: 6 }}>
            {sinVentas === 0
              ? `Ayer vendió todo el equipo: ${conVentas} de ${filas.length}.`
              : `Ayer vendieron ${conVentas} de ${filas.length}; ${sinVentas === 1 ? 'uno se quedó' : `${sinVentas} se quedaron`} a cero.`}
          </div>
        </div>

        {/* Las cuatro cifras del día */}
        <div style={{ display: 'flex', marginBottom: 18 }}>
          {cifras.map((k, i) => (
            <div key={k.rotulo} style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              width: anchoCifra, marginRight: i < 3 ? 14 : 0, height: 104,
              backgroundColor: C.tarjeta, border: `1px solid ${C.borde}`,
              borderRadius: 18, padding: '0 20px',
            }}>
              <div style={{ display: 'flex', color: C.tenue, fontSize: 14, fontWeight: 700, letterSpacing: 1.4 }}>
                {k.rotulo}
              </div>
              <div style={{ display: 'flex', color: k.color, fontSize: 34, fontWeight: 700, marginTop: 6 }}>
                {k.valor}
              </div>
            </div>
          ))}
        </div>

        {/* La tabla */}
        <div style={{
          display: 'flex', flexDirection: 'column', backgroundColor: C.tarjeta,
          border: `1px solid ${C.borde}`, borderRadius: 20, padding: 18,
        }}>
          {/* Banda de agrupación: qué es de ayer y qué es del mes */}
          <div style={{ display: 'flex', height: 26, alignItems: 'center' }}>
            <div style={{ display: 'flex', width: COL.nombre }} />
            <div style={{
              display: 'flex', width: COL.ops + COL.importe + COL.comision,
              justifyContent: 'flex-end', color: C.suave, fontSize: 15,
              fontWeight: 700, letterSpacing: 2,
            }}>AYER</div>
            <div style={{
              display: 'flex', width: COL.opsMes + COL.importeMes + COL.comisionMes,
              justifyContent: 'flex-end', color: C.suave, fontSize: 15,
              fontWeight: 700, letterSpacing: 2,
            }}>ESTE MES</div>
          </div>

          {/* Encabezados de columna */}
          <div style={{
            display: 'flex', height: 40, alignItems: 'center',
            borderBottom: `2px solid ${C.borde}`,
          }}>
            {encabezados.map((h, i) => (
              <Celda key={`${h.texto}-${i}`} texto={h.texto} ancho={h.ancho}
                     color={C.tenue} peso={700} derecha={h.derecha} tam={14} />
            ))}
          </div>

          {/* Una fila por comercial */}
          {filas.map((c, i) => {
            const cero = c.ayer.ops <= 0
            return (
              <div key={c.nombre} style={{
                display: 'flex', height: ALTO_FILA, alignItems: 'center',
                borderBottom: i < filas.length - 1 ? `1px solid ${C.raya}` : '0',
              }}>
                <Celda texto={c.nombre} ancho={COL.nombre} color={cero ? C.suave : C.tinta} peso={700} />
                <Celda texto={String(c.ayer.ops)} ancho={COL.ops} color={cero ? C.tenue : C.tinta} derecha peso={700} />
                <Celda texto={eur0(c.ayer.importe)} ancho={COL.importe} color={cero ? C.tenue : C.tinta} derecha />
                <Celda texto={eur2(c.ayer.comision)} ancho={COL.comision} color={cero ? C.tenue : C.ok} derecha peso={700} />
                <Celda texto={String(c.mes.ops)} ancho={COL.opsMes} color={C.suave} derecha />
                <Celda texto={eur0(c.mes.importe)} ancho={COL.importeMes} color={C.suave} derecha />
                <Celda texto={eur2(c.mes.comisionTotal)} ancho={COL.comisionMes} color={C.oro} derecha peso={700} />
              </div>
            )
          })}

          {/* Total */}
          <div style={{
            display: 'flex', height: 56, alignItems: 'center', marginTop: 10,
            borderTop: `2px solid ${C.borde}`,
          }}>
            <Celda texto="TOTAL EQUIPO" ancho={COL.nombre} color={C.tinta} peso={700} tam={19} />
            <Celda texto={String(tot.ops)} ancho={COL.ops} color={C.tinta} derecha peso={700} tam={22} />
            <Celda texto={eur0(tot.importe)} ancho={COL.importe} color={C.tinta} derecha peso={700} tam={22} />
            <Celda texto={eur2(tot.comision)} ancho={COL.comision} color={C.ok} derecha peso={700} tam={22} />
            <Celda texto={String(tot.opsMes)} ancho={COL.opsMes} color={C.suave} derecha peso={700} tam={22} />
            <Celda texto={eur0(tot.importeMes)} ancho={COL.importeMes} color={C.suave} derecha peso={700} tam={22} />
            <Celda texto={eur2(tot.comisionMes)} ancho={COL.comisionMes} color={C.oro} derecha peso={700} tam={22} />
          </div>
        </div>

        <div style={{
          display: 'flex', height: 44, alignItems: 'center', justifyContent: 'center',
          color: C.tenue, fontSize: 15,
        }}>
          {'Las mismas cifras que cada comercial ve en su parte y en el Panel de Comisiones.'}
        </div>
      </div>
    ),
    {
      width: ANCHO,
      height: alto,
      emoji: 'twemoji',
      fonts: [
        { name: 'Liberation Sans', data: regular, weight: 400, style: 'normal' },
        { name: 'Liberation Sans', data: bold, weight: 700, style: 'normal' },
      ],
    },
  )
}
