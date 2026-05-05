import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import fs from 'fs'
import AdmZip from 'adm-zip'
import { uploadToFTP, cleanupOldBackups } from '@/lib/ftpClient'
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
    const filename = `MicroShop_QNAP_Backup_${dateStr}.zip`

    // Subida FTP
    const fileId = await uploadToFTP(filename, zipBuffer)

    // Limpieza (Rutina Mantenimiento a 14 días)
    const deletedCount = await cleanupOldBackups(14).catch(e => {
        console.error("No se pudieron limpiar las copias antiguas FTP:", e)
        return 0
    });

    return NextResponse.json({ success: true, message: 'Copia inyectada con éxito en tu QNAP.', fileId, deletedOld: deletedCount })

  } catch (err: any) {
    console.error('Error in ftp-backup (QNAP generator):', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
