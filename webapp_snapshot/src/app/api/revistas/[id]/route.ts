import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { can, canEdit } from '@/lib/permissions'

const prisma = new PrismaClient()

export async function PATCH(
    request: Request, 
    context: { params: any }
) {
    console.log('BACKEND PATCH context:', context)
    
    // Bypass Next 15 Proxy Promise bug by awaiting resolving it securely
    const resolvedParams = await context.params
    console.log('BACKEND PATCH params:', resolvedParams)
    
    const id = resolvedParams?.id
    console.log('BACKEND PATCH id:', id)

    if (!id) {
        return NextResponse.json({ 
            error: 'ID no recibido en backend', 
            contextParams: resolvedParams ?? null 
        }, { status: 400 })
    }

    const session = await getSession()
    if (!session || !canEdit(session.user, 'MANAGE_MAGAZINES')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    try {
        const body = await request.json()
        
        // Auto feature fallback if they toggle "isFeatured" -> We only want 1 featured at a time per type.
        if (body.isFeatured === true) {
            const currentDoc = await prisma.magazine.findUnique({ where: { id: id } })
            if (currentDoc) {
                let typeFilter = {}
                const slug = currentDoc.slug
                if (slug.startsWith('catalogo-')) typeFilter = { slug: { startsWith: 'catalogo-' } }
                else if (slug.startsWith('dosier-')) typeFilter = { slug: { startsWith: 'dosier-' } }
                else typeFilter = { AND: [ { NOT: { slug: { startsWith: 'catalogo-' } } }, { NOT: { slug: { startsWith: 'dosier-' } } } ] }

                await prisma.magazine.updateMany({
                    where: { isFeatured: true, id: { not: id }, ...typeFilter },
                    data: { isFeatured: false }
                })
            }
        }

        const updated = await prisma.magazine.update({
            where: { id: id },
            data: body 
        })
        return NextResponse.json(updated)
    } catch (e: any) {
        console.error('=== MAGAZINE PATCH ERROR ===', e)
        const isDev = process.env.NODE_ENV === 'development'
        return NextResponse.json({ 
            error: 'Error al actualizar revista',
            details: e.message || String(e),
            stack: isDev ? e.stack : undefined
        }, { status: 500 })
    }
}

export async function DELETE(
    request: Request, 
    context: { params: any }
) {
    console.log('BACKEND DELETE context:', context)
    const resolvedParams = await context.params
    console.log('BACKEND DELETE params:', resolvedParams)
    
    const id = resolvedParams?.id
    console.log('BACKEND DELETE id:', id)

    if (!id) {
        return NextResponse.json({ 
            error: 'ID no recibido en backend', 
            contextParams: resolvedParams ?? null 
        }, { status: 400 })
    }

    const session = await getSession()
    if (!session || !canEdit(session.user, 'MANAGE_MAGAZINES')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    try {
        await prisma.magazine.delete({
            where: { id: id }
        })
        return NextResponse.json({ success: true })
    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'Error al borrar revista' }, { status: 500 })
    }
}
// Cache invalidate
