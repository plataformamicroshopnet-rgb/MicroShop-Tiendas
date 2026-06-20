import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Feed de "Producción Plus / Producción Básico" = "Total Acumulado PLUS/BÁSICO" de la
// Liquidación (Operaciones Telefónica) de MicroShop FFVV, por mes. La FFVV lo publica
// (vía su /api/produccion-publish, server-to-server con secreto) y Ganancias lo lee (GET)
// para las filas "Producción Plus" y "Producción Básico". Mismo secreto PRV_FEED_SECRET.
// Formato: { "YYYY_MM": { plus: number, basico: number }, ... }.

const FEED_PATH = process.env.SQLITE_VOLUME_PATH
    ? path.join(process.env.SQLITE_VOLUME_PATH, 'produccion_feed.json')
    : path.join(process.cwd(), 'produccion_feed.json')

const SECRET: string | null = process.env.PRV_FEED_SECRET
    || (process.env.NODE_ENV === 'production' ? null : 'dev-prv-secret')

function readFeed(): Record<string, { plus: number; basico: number }> {
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
        const merged = { ...readFeed() }
        for (const [k, v] of Object.entries(incoming as Record<string, any>)) {
            if (!/^\d{4}_\d{2}$/.test(k) || !v || typeof v !== 'object') continue
            const plus = Number((v as any).plus)
            const basico = Number((v as any).basico)
            merged[k] = {
                plus: isNaN(plus) ? 0 : plus,
                basico: isNaN(basico) ? 0 : basico,
            }
        }
        fs.mkdirSync(path.dirname(FEED_PATH), { recursive: true })
        fs.writeFileSync(FEED_PATH, JSON.stringify({ data: merged, updatedAt: new Date().toISOString() }, null, 2))
        return NextResponse.json({ success: true, count: Object.keys(merged).length })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 })
    }
}
