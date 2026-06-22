import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import AdmZip from 'adm-zip'
import { uploadToFTP, cleanupOldBackups } from '@/lib/ftpClient'
import { isB2Configured, uploadToB2, cleanupOldB2 } from '@/lib/b2Client'
import { getDbPaths } from '@/lib/dbPath'

export async function POST(request: Request) {
  try {
    let isAuthorized = false;
    const session = await getSession()
    
    if (session && session.user?.role === 'ADMIN') {
        isAuthorized = true;
    } else {
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET_KEY
        if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Admin Access or valid Cron Token required.' }, { status: 401 })
    }

    const { dbPath, walPath, shmPath } = getDbPaths();

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ success: false, error: 'File database.sqlite not found' }, { status: 404 })
    }

    const zip = new AdmZip()
    
    if (!fs.existsSync(walPath)) await fs.promises.writeFile(walPath, '');
    if (!fs.existsSync(shmPath)) await fs.promises.writeFile(shmPath, '');

    zip.addLocalFile(dbPath)
    zip.addLocalFile(walPath)
    zip.addLocalFile(shmPath)

    const zipBuffer = zip.toBuffer()

    const now = new Date()
    const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`
    const filename = `MicroShop_Tiendas_Backup_${dateStr}.zip`

    // Subimos a LAS DOS: nube (B2, offsite) Y NAS (FTP→QNAP, onsite). Independientes:
    // si una falla, la otra se conserva.
    let b2Ok = false, nasOk = false
    let b2Err = '', nasErr = ''
    if (isB2Configured()) {
        try {
            await uploadToB2(filename, zipBuffer)
            await cleanupOldB2(31).catch(e => { console.error('Limpieza B2 falló:', e); return 0 })
            b2Ok = true
        } catch (e: any) { b2Err = e.message; console.error('Backup B2 falló:', e) }
    }
    try {
        await uploadToFTP(filename, zipBuffer)
        await cleanupOldBackups(31, 'MicroShop_Tiendas_').catch(e => { console.error('Limpieza FTP falló:', e); return 0 })
        nasOk = true
    } catch (e: any) { nasErr = e.message; console.error('Backup NAS (FTP) falló:', e) }

    const destinos = [b2Ok ? 'Nube B2' : null, nasOk ? 'NAS' : null].filter(Boolean).join(' + ')
    const success = b2Ok || nasOk
    const message = success
        ? `Copia subida con éxito a: ${destinos}.` + (b2Err ? ` (B2 falló: ${b2Err})` : '') + (nasErr ? ` (NAS falló: ${nasErr})` : '')
        : `No se pudo subir la copia. B2: ${b2Err || 'no configurado'}. NAS: ${nasErr}.`

    return NextResponse.json({ success, message, b2: b2Ok, nas: nasOk, filename })

  } catch (err: any) {
    console.error('Error in ftp-backup (QNAP generator):', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
