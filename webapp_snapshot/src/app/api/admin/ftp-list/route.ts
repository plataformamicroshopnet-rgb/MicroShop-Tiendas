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

    // Método principal: nube (Backblaze B2). FTP heredado como respaldo.
    let files
    if (isB2Configured()) {
      const b2 = await listB2Backups()
      files = b2.map(b => ({
        id: b.key,
        name: b.key.split('/').pop() || b.key,
        createdTime: b.date.toISOString(),
        sizeMB: b.sizeMb,
      }))
    } else {
      files = await listFTPFiles()
    }

    return NextResponse.json({ success: true, files })
  } catch (err: any) {
    console.error('Error in ftp-list:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
