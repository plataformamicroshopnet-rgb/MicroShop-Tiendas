import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listFTPFiles } from '@/lib/ftpClient'
import { isB2Configured, listB2Backups } from '@/lib/b2Client'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Devolvemos LAS DOS listas: nube (B2, offsite) y NAS (FTP→QNAP, onsite).
    let b2files: any[] = []
    let nasfiles: any[] = []
    if (isB2Configured()) {
      try {
        const b2 = await listB2Backups()
        b2files = b2.map(b => ({
          id: b.key,
          name: b.key.split('/').pop() || b.key,
          createdTime: b.date.toISOString(),
          sizeMB: b.sizeMb,
        }))
      } catch (e: any) { console.error('Listado B2 falló:', e?.message) }
    }
    try {
      nasfiles = await listFTPFiles()
    } catch (e: any) { console.error('Listado NAS (FTP) falló:', e?.message) }

    // 'files' se mantiene por compatibilidad (= B2 si hay, si no NAS).
    return NextResponse.json({ success: true, b2: b2files, nas: nasfiles, files: b2files.length ? b2files : nasfiles })
  } catch (err: any) {
    console.error('Error in ftp-list:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
