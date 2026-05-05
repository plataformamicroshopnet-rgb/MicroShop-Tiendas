import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { can, canEdit } from '@/lib/permissions'

const prisma = new PrismaClient()

export async function GET(request: Request) {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const publishedOnly = searchParams.get('public') === 'true'
    const type = searchParams.get('type') || 'revista'

    let typeFilter = {}
    if (type === 'revista') {
        typeFilter = {
            AND: [
                { NOT: { slug: { startsWith: 'catalogo-' } } },
                { NOT: { slug: { startsWith: 'dosier-' } } }
            ]
        }
    } else {
        typeFilter = { slug: { startsWith: `${type}-` } }
    }

    try {
        const revistas = await prisma.magazine.findMany({
            where: {
               ...typeFilter,
               ...(publishedOnly ? { isPublished: true } : {})
            },
            orderBy: [
                { year: 'desc' },
                { month: 'desc' }
            ]
        })
        return NextResponse.json(revistas)
    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Fallo al obtener revistas' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MANAGE_MAGAZINES')) {
        return NextResponse.json({ error: 'No autorizado para gestionar revistas' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const { title, slug, month, year, description, pdfUrl, coverUrl, type } = body

        if (!title || !slug || !month || !year || !pdfUrl) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
        }

        // Si no es revista, inyectamos el prefijo si no lo tiene
        let forcedSlug = slug
        if (type && type !== 'revista') {
            if (!forcedSlug.startsWith(`${type}-`)) {
                forcedSlug = `${type}-${forcedSlug}`
            }
        }

        const newMag = await prisma.magazine.create({
            data: {
                title, 
                slug: forcedSlug, 
                month: Number(month), 
                year: Number(year),
                description: description || null, 
                pdfUrl, 
                coverUrl: coverUrl || null
            }
        })
        return NextResponse.json(newMag)
    } catch (e: any) {
        console.error(e)
        if (e.code === 'P2002') {
            return NextResponse.json({ error: 'El slug o identificador ya existe.' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Fallo al crear revista' }, { status: 500 })
    }
}
// Cache invalidate
