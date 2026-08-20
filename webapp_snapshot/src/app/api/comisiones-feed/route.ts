import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { norm } from '@/lib/comercialRoster';

// ─── Feed de comisiones publicado por el ERP (mi-nuevo-erp) ─────────────────
// Cuando el ERP aprueba el pago de comisiones (regla N+3) POSTea aquí los
// importes por comercial. Se escriben en la tabla ComisionFFVVTienda, que es la
// que pinta la carta "Comisiones Tiendas y FFVV v3" de /liquidacion.
//
// CORRESPONDENCIA DE PERIODOS: el título de la carta v3 (ComisionesV3.tsx:14-21)
// dice «LIQUIDACIÓN DE VENTAS DE {mes(P)} SE PAGA EN LA NÓMINA DE {mes(P+3)}»,
// es decir, la fila de periodKey P contiene las ventas de P. El ERP manda el MES
// DE VENTA, así que periodKeyDestino = periodKey recibido (sin conversión).
//
// RESPETO A EDICIONES MANUALES: en comisiones_feed_state.json (volumen) se
// guarda el último importe publicado por el ERP para cada (periodo, tipo,
// nombre). Si el importe actual de la BD ya no coincide con lo último publicado
// (el dueño lo tocó a mano), NO se pisa salvo force=true.
//
// Body: { periodKey: "YYYY_MM", canal: "FFVV"|"TIENDA",
//         rows: [{ nombre: "Javier", importe: 831.5 }], force?: false }
// Auth: cabecera x-prv-secret === PRV_FEED_SECRET (mismo patrón que /api/prv-feed).
// ─────────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const STATE_PATH = process.env.SQLITE_VOLUME_PATH
    ? path.join(process.env.SQLITE_VOLUME_PATH, 'comisiones_feed_state.json')
    : path.join(process.cwd(), 'comisiones_feed_state.json');

// En producción hay que fijar PRV_FEED_SECRET (mismo valor en el ERP). Si no está
// fijado: en desarrollo se usa un default; en producción se RECHAZA todo (cerrado).
const SECRET: string | null = process.env.PRV_FEED_SECRET
    || (process.env.NODE_ENV === 'production' ? null : 'dev-prv-secret');

// Estado: { [periodKey]: { [tipo]: { [nombreNormalizado]: ultimoImportePublicado } } }
type FeedState = Record<string, Record<string, Record<string, number>>>;

function readState(): { state: FeedState; updatedAt?: string } {
    try {
        if (!fs.existsSync(STATE_PATH)) return { state: {} };
        const j = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
        if (j && typeof j === 'object' && j.state && typeof j.state === 'object') {
            return { state: j.state, updatedAt: j.updatedAt };
        }
        if (j && typeof j === 'object') return { state: j };
        return { state: {} };
    } catch {
        return { state: {} };
    }
}

function writeState(state: FeedState) {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify({ state, updatedAt: new Date().toISOString() }, null, 2));
}

const eq = (a: number, b: number) => Math.abs(a - b) < 0.005; // tolerancia céntimos/float

// Fórmulas de la carta v3 (ComisionesV3.tsx:88-108)
function recalc(tipo: 'FFVV' | 'TIENDA', row: {
    importe: number; aceleradores: number; descuentos: number;
    dietas: number; km: number; o2Varios: number;
}): { total: number; incentivos: number | null } {
    if (tipo === 'FFVV') {
        const total = row.importe + row.aceleradores - row.descuentos;
        return { total, incentivos: total - row.dietas - row.km };
    }
    // TIENDA (incentivos no aplica: se deja como esté)
    return { total: row.importe + row.o2Varios - row.descuentos, incentivos: null };
}

function authorized(request: Request): boolean {
    const secret = request.headers.get('x-prv-secret') || '';
    return !!SECRET && secret === SECRET;
}

export async function GET(request: Request) {
    if (!authorized(request)) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const { state, updatedAt } = readState();
    return NextResponse.json({ ok: true, state, updatedAt: updatedAt || null });
}

export async function POST(request: Request) {
    if (!authorized(request)) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    try {
        const body = await request.json();
        const periodKey = String(body?.periodKey || '');
        const canal = String(body?.canal || '');
        const rows = body?.rows;
        const force = body?.force === true;

        if (!/^\d{4}_\d{2}$/.test(periodKey)) {
            return NextResponse.json({ ok: false, error: 'periodKey inválido (formato YYYY_MM)' }, { status: 400 });
        }
        if (canal !== 'FFVV' && canal !== 'TIENDA') {
            return NextResponse.json({ ok: false, error: "canal inválido (debe ser 'FFVV' o 'TIENDA')" }, { status: 400 });
        }
        if (!Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ ok: false, error: 'rows vacío o ausente' }, { status: 400 });
        }
        for (const r of rows) {
            if (!r || !String(r.nombre || '').trim() || r.importe === null || r.importe === undefined || isNaN(Number(r.importe))) {
                return NextResponse.json({ ok: false, error: 'cada row necesita nombre e importe numérico' }, { status: 400 });
            }
        }

        // La fila de periodKey P contiene las VENTAS de P (título v3) y el ERP
        // manda el mes de venta → destino = mismo periodKey.
        const periodKeyDestino = periodKey;

        // Filas existentes del periodo+tipo, indexadas por nombre normalizado
        const existing = await prisma.comisionFFVVTienda.findMany({
            where: { periodKey: periodKeyDestino, tipo: canal },
            orderBy: { createdAt: 'asc' }
        });
        const byNorm = new Map<string, typeof existing[number]>();
        for (const e of existing) {
            const k = norm(e.nombre);
            if (!byNorm.has(k)) byNorm.set(k, e); // ante duplicados, la más antigua
        }

        const { state } = readState();
        const stPeriod = (state[periodKeyDestino] = state[periodKeyDestino] || {});
        const stTipo = (stPeriod[canal] = stPeriod[canal] || {});

        const acciones: { nombre: string; accion: string; importeAnterior: number | null; importeNuevo: number }[] = [];

        for (const r of rows) {
            const nombre = String(r.nombre).trim();
            const nKey = norm(nombre);
            const importeNuevo = Number(r.importe);
            const row = byNorm.get(nKey);

            if (!row) {
                // 3. No existe → crear con importe y resto de numéricos a 0
                const { total, incentivos } = recalc(canal, {
                    importe: importeNuevo, aceleradores: 0, descuentos: 0, dietas: 0, km: 0, o2Varios: 0
                });
                const created = await prisma.comisionFFVVTienda.create({
                    data: {
                        periodKey: periodKeyDestino,
                        tipo: canal,
                        nombre,
                        importe: importeNuevo,
                        aceleradores: 0, descuentos: 0, dietas: 0, km: 0, gasolina: 0, o2Varios: 0,
                        total,
                        incentivos: canal === 'FFVV' ? incentivos : 0,
                    }
                });
                byNorm.set(nKey, created);
                acciones.push({ nombre, accion: 'creada', importeAnterior: null, importeNuevo });
            } else {
                const importeActual = row.importe ?? 0;
                const ultimoPublicado = stTipo[nKey];
                const sinEdicionManual = importeActual === 0
                    || (ultimoPublicado !== undefined && eq(importeActual, ultimoPublicado));

                if (sinEdicionManual || force) {
                    // 4/forzada. Solo importe + recálculo; se respetan el resto de
                    // numéricos y todas las notas tecleadas por el dueño.
                    const { total, incentivos } = recalc(canal, {
                        importe: importeNuevo,
                        aceleradores: row.aceleradores ?? 0,
                        descuentos: row.descuentos ?? 0,
                        dietas: row.dietas ?? 0,
                        km: row.km ?? 0,
                        o2Varios: row.o2Varios ?? 0,
                    });
                    await prisma.comisionFFVVTienda.update({
                        where: { id: row.id },
                        data: {
                            importe: importeNuevo,
                            total,
                            ...(canal === 'FFVV' ? { incentivos } : {}),
                        }
                    });
                    acciones.push({
                        nombre, accion: sinEdicionManual ? 'actualizada' : 'forzada',
                        importeAnterior: importeActual, importeNuevo
                    });
                } else {
                    // 5. Editada a mano por el dueño → no tocar (importeNuevo = lo
                    // que mandó el ERP y NO se aplicó)
                    acciones.push({ nombre, accion: 'respetada_manual', importeAnterior: importeActual, importeNuevo });
                }
            }

            // 6. El estado registra siempre lo último publicado por el ERP
            stTipo[nKey] = importeNuevo;
        }

        writeState(state);
        return NextResponse.json({ ok: true, periodKeyDestino, acciones });
    } catch (e: any) {
        console.error('POST /api/comisiones-feed error:', e);
        return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
}
