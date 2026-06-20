import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/permissions'

// Versión editable del panel "Ganancias desde el 2014". Si existe en BD, sustituye al
// Excel estático (data.ts) como base; encima se aplican las cifras en vivo (Caja,
// Comisiones, PRV, Totales). Guardado/edición solo para quien tenga acceso a Dirección.

const prisma = new PrismaClient()
const KEY = 'ganancias_data_v1'

export async function GET() {
    try {
        const setting = await prisma.appSetting.findUnique({ where: { key: KEY } })
        const data = setting && setting.value ? JSON.parse(setting.value) : null
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await getSession()
    if (!session || !can(session.user, 'MODULE_DIRECCION')) {
        return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }
    try {
        const { data } = await request.json()
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return NextResponse.json({ success: false, error: 'Datos inválidos' }, { status: 400 })
        }
        await prisma.appSetting.upsert({
            where: { key: KEY },
            update: { value: JSON.stringify(data) },
            create: { key: KEY, value: JSON.stringify(data) },
        })
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
