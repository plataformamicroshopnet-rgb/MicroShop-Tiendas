import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Feed del "TOTAL COBRADO IVA Inc" = "Resumen Evolutivo: Ingresos Totales
// Telefónica/Movistar" del ERP (mi-nuevo-erp), por mes de VENTAS. El panel de Ganancias lo
// lee (GET) y rellena la fila "TOTAL COBRADO IVA Inc"; "TOTAL COBRADO sin IVA" se calcula
// = IVA Inc / 1,21. Mismo secreto que el feed del PRV (PRV_FEED_SECRET).
// Formato: { "YYYY_MM": importeCobradoConIVA, ... } (mes de ventas).

const FEED_PATH = process.env.SQLITE_VOLUME_PATH
    ? path.join(process.env.SQLITE_VOLUME_PATH, 'cobrado_feed.json')
    : path.join(process.cwd(), 'cobrado_feed.json')

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
        // Por defecto FUSIONA; con {replace:true} el ERP manda la foto completa y sustituye.
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
