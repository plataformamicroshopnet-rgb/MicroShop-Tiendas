import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { getDbPaths } from '@/lib/dbPath'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin Access Required.' }, { status: 401 })
    }

    // Archivos estructurales de SQLite con WAL
    const { dbPath, walPath, shmPath } = getDbPaths();
    
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ success: false, error: 'File database.sqlite not found' }, { status: 404 })
    }

    const zip = new AdmZip()
    
    // El usuario requiere contractualmente que los 3 archivos estén siempre presentes en el ZIP
    if (!fs.existsSync(walPath)) await fs.promises.writeFile(walPath, '');
    if (!fs.existsSync(shmPath)) await fs.promises.writeFile(shmPath, '');

    // Agregamos la base principal y sus hermanos WAL
    zip.addLocalFile(dbPath)
    zip.addLocalFile(walPath)
    zip.addLocalFile(shmPath)

    const zipBuffer = zip.toBuffer()
    
    const now = new Date()
    const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`
    
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="MicroShop_Bunker_${dateStr}.zip"`
      }
    })

  } catch (err: any) {
    console.error('Error in download-db (ZIP generator):', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
