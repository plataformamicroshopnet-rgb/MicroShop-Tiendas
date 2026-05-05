import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
}

export async function GET(
    request: Request,
    props: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: filePathArray } = await props.params
        const filePath = filePathArray.join('/')
        
        // Ensure no directory traversal
        if (filePath.includes('..')) {
            return new NextResponse('Invalid path', { status: 400 })
        }

        const absolutePath = path.join(process.cwd(), 'public', 'revistas_uploads', filePath)
        const fileBuffer = await readFile(absolutePath)
        
        const ext = path.extname(absolutePath).toLowerCase()
        const contentType = mimeTypes[ext] || 'application/octet-stream'

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200'
            }
        })
    } catch (e: any) {
        if (e.code === 'ENOENT') {
            return new NextResponse('File not found', { status: 404 })
        }
        console.error('Error serving media file:', e)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
