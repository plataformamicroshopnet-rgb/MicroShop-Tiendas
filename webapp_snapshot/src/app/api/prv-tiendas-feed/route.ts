import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Feed del "PRV Tiendas" = "Resumen Evolutivo: Retribuciones Base Tiendas (TCBP)" del ERP
// (mi-nuevo-erp), neto por mes. El ERP lo POSTea con el secreto compartido; el panel de
// Ganancias lo lee (GET) y rellena la fila "PRV Tiendas" desde Septiembre 2025.
// Formato: { "YYYY_MM": netoTcbp, ... }. Mismo secreto que el feed del PRV (PRV_FEED_SECRET).

const FEED_PATH = process.env.SQLITE_VOLUME_PATH
    ? path.join(process.env.SQLITE_VOLUME_PATH, 'prv_tiendas_feed.json')
    : path.join(process.cwd(), 'prv_tiendas_feed.json')

const SECRET: string | null = process.env.PRV_FEED_SECRET
    || (process.env.NODE_ENV === 'production' ? null : 'dev-prv-secret')

function readFeed(): Record<string, number> {
    try {
        if (!fs.existsSync(FEED_PATH)) return {}
        const j = JSON.parse(fs.readFileSync(FEED_PATH, 'utf-8'))
        if (j && typeof j === 'object' && j.data && typeof j.data === 'object') return j.data
        if (j && typeof j === 'object') return j
        return {}
    } catch {
        return {}
    }
}

export async function GET() {
    return NextResponse.json({ success: true, data: readFeed() })
}

export async function POST(request: Request) {
    const secret = request.headers.get('x-prv-secret') || ''
    if (!SECRET || secret !== SECRET) {
        return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
    }
    try {
        const body = await request.json()
        const incoming = (body && body.data && typeof body.data === 'object') ? body.data : body
        if (!incoming || typeof incoming !== 'object') {
            return NextResponse.json({ success: false, error: 'invalid payload' }, { status: 400 })
        }
        // Por defecto FUSIONA con lo existente; con {replace:true} el ERP manda la foto
        // COMPLETA y se sustituye todo (así los meses residuales/corregidos desaparecen).
        const replaceAll = !!(body && body.replace === true)
        const merged: Record<string, number> = replaceAll ? {} : { ...readFeed() }
        for (const [k, v] of Object.entries(incoming)) {
            if (/^\d{4}_\d{2}$/.test(k) && v !== null && v !== undefined && !isNaN(Number(v))) {
                merged[k] = Number(v)
            }
        }
        fs.mkdirSync(path.dirname(FEED_PATH), { recursive: true })
        fs.writeFileSync(FEED_PATH, JSON.stringify({ data: merged, updatedAt: new Date().toISOString() }, null, 2))
        return NextResponse.json({ success: true, count: Object.keys(merged).length })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
    }
}
