import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Feed del PRV publicado por el ERP (mi-nuevo-erp). El scheduler del ERP calcula el
// "Beneficio Neto Total" (neto) de cada mes y lo POSTea aquí con un secreto; se guarda
// como JSON en el volumen persistente. El panel de Ganancias lo lee (GET) y rellena la
// fila "PRV" desde Septiembre 2025. Formato: { "YYYY_MM": neto, ... }.

const FEED_PATH = process.env.SQLITE_VOLUME_PATH
    ? path.join(process.env.SQLITE_VOLUME_PATH, 'prv_feed.json')
    : path.join(process.cwd(), 'prv_feed.json')

// En producción hay que fijar PRV_FEED_SECRET (mismo valor en el ERP). Si no está fijado:
// en desarrollo se usa un default; en producción se RECHAZA todo POST (endpoint cerrado).
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
        // Fusiona con lo existente: el ERP puede mandar solo los meses nuevos/cambiados.
        const merged: Record<string, number> = { ...readFeed() }
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
