import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getSession } from '@/lib/auth'
import { can, canEdit } from '@/lib/permissions'

export async function POST(request: Request) {
    const session = await getSession()
    if (!session || !canEdit(session.user, 'MANAGE_MAGAZINES')) {
        return NextResponse.json({ 
            error: 'Autenticación Rechazada', 
            details: 'Tu sesión no contiene el permiso MANAGE_MAGAZINES. Por favor, cierra sesión y vuelve a entrar.' 
        }, { status: 403 })
    }

    try {
        const formData = await request.formData()
        const file = formData.get('file') as File
        if (!file) return NextResponse.json({ error: 'No file found' }, { status: 400 })

        const buffer = Buffer.from(await file.arrayBuffer())
        const filename =  Date.now() + '_' + file.name.replaceAll(' ', '_')
        const uploadDir = path.join(process.cwd(), 'public', 'revistas_uploads')
        
        await mkdir(uploadDir, { recursive: true })
        await writeFile(path.join(uploadDir, filename), buffer)

        return NextResponse.json({ url: `/revistas_uploads/${filename}` })
    } catch (e: any) {
        console.error('=== SERVER UPLOAD ERROR ===', e)
        const isDev = process.env.NODE_ENV === 'development'
        
        return NextResponse.json({ 
            error: 'Error interno al procesar el archivo',
            details: e.message || String(e),
            stack: isDev ? e.stack : undefined
        }, { status: 500 })
    }
}
